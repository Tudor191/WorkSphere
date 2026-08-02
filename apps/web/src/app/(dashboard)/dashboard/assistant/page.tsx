'use client';

import * as React from 'react';
import { Bot, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiChat, type AiChatMessage } from '@/hooks/use-ai-chat';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function AssistantPage() {
  const [messages, setMessages] = React.useState<AiChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const sendChat = useAiChat();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sendChat.isPending) return;
    setError(null);
    const nextMessages: AiChatMessage[] = [...messages, { role: 'user', content: draft }];
    setMessages(nextMessages);
    setDraft('');
    try {
      const { reply } = await sendChat.mutateAsync(nextMessages);
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eroare la comunicarea cu AI Assistant.');
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <span className="font-medium">Asistent AI</span>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            <Trash2 className="h-3.5 w-3.5" />
            Curăță conversația
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Întreabă orice — dar reține că, deocamdată, asistentul nu are acces la datele reale ale
            companiei tale (angajați, concedii, task-uri); pentru asta folosește paginile dedicate.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-lg whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm',
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sendChat.isPending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Se gândește...</div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Scrie o întrebare..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sendChat.isPending || !draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
