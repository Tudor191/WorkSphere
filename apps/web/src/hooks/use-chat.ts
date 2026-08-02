import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatChannel, ChatMessage } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

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

/**
 * Poll simplu la fiecare 4s cât timp canalul e deschis — nu e livrare
 * real-time (WebSocket), doar o aproximare suficientă pentru prima felie.
 * `refetchIntervalInBackground: false` (implicit) oprește pooling-ul dacă
 * tab-ul nu e activ.
 */
export function useChatMessages(channelId: string | undefined) {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['chat-messages', companyId, channelId],
    queryFn: () => apiFetch<ChatMessage[]>(`/chat/channels/${channelId}/messages`),
    enabled: Boolean(companyId) && Boolean(channelId),
    refetchInterval: 4000,
  });
}

export function useSendChatMessage(channelId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<ChatMessage>(`/chat/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-messages'] }),
  });
}
