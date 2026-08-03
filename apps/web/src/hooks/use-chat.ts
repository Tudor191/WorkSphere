import * as React from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ChatChannel, ChatMessage } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';
import { getChatSocket } from '@/lib/chat-socket';

export interface CreateChannelInput {
  name: string;
  isPrivate?: boolean;
  memberIds?: string[];
}

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useChatChannels() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['chat-channels', companyId],
    queryFn: () => apiFetch<ChatChannel[]>('/chat/channels'),
    enabled: Boolean(companyId),
  });
}

export function useCreateChatChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChannelInput) =>
      apiFetch<ChatChannel>('/chat/channels', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-channels'] }),
  });
}

function chatMessagesKey(companyId: string | undefined, channelId: string | undefined) {
  return ['chat-messages', companyId, channelId] as const;
}

/** Adaugă mesajul în cache dacă nu e deja acolo (după `id`) — idempotent la reconectare/eco propriu. */
function appendMessage(
  queryClient: QueryClient,
  companyId: string | undefined,
  channelId: string | undefined,
  message: ChatMessage,
) {
  queryClient.setQueryData<ChatMessage[]>(chatMessagesKey(companyId, channelId), (old) =>
    old?.some((m) => m.id === message.id) ? old : [...(old ?? []), message],
  );
}

/**
 * Livrare în timp real prin WebSocket (vezi `ChatGateway`, backend) — nu mai
 * face poll la fiecare 4s. Istoricul se încarcă o singură dată prin
 * `queryFn` (REST), apoi orice mesaj nou (trimis de oricine din canal,
 * inclusiv propriul cont — vezi `useSendChatMessage`) ajunge instant prin
 * evenimentul `new_message`, filtrat explicit după `channelId` (rooms
 * Socket.IO oricum izolează asta, dar un `leave_channel` aflat încă "în
 * zbor" la schimbarea rapidă de canal ar putea livra un ultim eveniment
 * vechi — filtrul e ieftin și elimină orice ambiguitate).
 */
export function useChatMessages(channelId: string | undefined) {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: chatMessagesKey(companyId, channelId),
    queryFn: () => apiFetch<ChatMessage[]>(`/chat/channels/${channelId}/messages`),
    enabled: Boolean(companyId) && Boolean(channelId),
  });

  React.useEffect(() => {
    if (!companyId || !channelId) return;
    const socket = getChatSocket();

    const join = () => socket.emit('join_channel', { channelId });
    const onNewMessage = (message: ChatMessage) => {
      if (message.channelId !== channelId) return;
      appendMessage(queryClient, companyId, channelId, message);
    };

    socket.on('connect', join);
    socket.on('new_message', onNewMessage);
    if (socket.connected) join();
    else socket.connect();

    return () => {
      socket.emit('leave_channel', { channelId });
      socket.off('connect', join);
      socket.off('new_message', onNewMessage);
    };
  }, [companyId, channelId, queryClient]);

  return query;
}

export function useSendChatMessage(channelId: string | undefined) {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<ChatMessage>(`/chat/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    // Fallback, nu sursa principală de livrare: mesajul propriu ajunge de
    // regulă și prin `new_message` (autorul e membru al camerei), dar dacă
    // socket-ul tocmai s-a reconectat, îl afișăm oricum imediat — `appendMessage`
    // deduplichează după `id`, deci nu apare de două ori când ambele sosesc.
    onSuccess: (message) => appendMessage(queryClient, companyId, channelId, message),
  });
}
