import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Fără persistență server-side încă — conversația trăiește doar în state-ul
 * paginii (se pierde la refresh). Fiecare cerere retrimite tot istoricul,
 * ca modelul să aibă context.
 */
export function useAiChat() {
  return useMutation({
    mutationFn: (messages: AiChatMessage[]) =>
      apiFetch<{ reply: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      }),
  });
}
