'use client';

import * as React from 'react';
import { Hash, Lock, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChatChannels, useChatMessages, useCreateChatChannel, useSendChatMessage } from '@/hooks/use-chat';
import { useEmployees } from '@/hooks/use-employees';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const { user } = useAuth();
  const { data: channels, isLoading: channelsLoading } = useChatChannels();
  const { data: employees } = useEmployees();
  const createChannel = useCreateChatChannel();

  const [selectedChannelId, setSelectedChannelId] = React.useState<string | undefined>();
  const { data: messages, isLoading: messagesLoading } = useChatMessages(selectedChannelId);
  const sendMessage = useSendChatMessage(selectedChannelId);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [channelName, setChannelName] = React.useState('');
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [memberIds, setMemberIds] = React.useState<string[]>([]);
  const [channelError, setChannelError] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const firstChannel = channels?.[0];
    if (!selectedChannelId && firstChannel) {
      setSelectedChannelId(firstChannel.id);
    }
  }, [channels, selectedChannelId]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedChannel = channels?.find((c) => c.id === selectedChannelId);

  const submitChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setChannelError(null);
    try {
      const channel = await createChannel.mutateAsync({
        name: channelName,
        isPrivate,
        memberIds: isPrivate ? memberIds : undefined,
      });
      setChannelName('');
      setIsPrivate(false);
      setMemberIds([]);
      setDialogOpen(false);
      setSelectedChannelId(channel.id);
    } catch (err) {
      setChannelError(err instanceof ApiError ? err.message : 'Eroare la crearea canalului.');
    }
  };

  const submitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const content = draft;
    setDraft('');
    await sendMessage.mutateAsync(content);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="w-64 shrink-0 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Canale</h2>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setChannelError(null); }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Canal nou</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitChannel} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nume</Label>
                  <Input value={channelName} onChange={(e) => setChannelName(e.target.value)} required />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  Canal privat (doar membri invitați)
                </label>
                {isPrivate && (
                  <div className="space-y-2">
                    <Label>Membri invitați</Label>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-input p-2">
                      {employees?.map((emp) => (
                        <label key={emp.user.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input accent-primary"
                            checked={memberIds.includes(emp.user.id)}
                            onChange={(e) =>
                              setMemberIds((ids) =>
                                e.target.checked
                                  ? [...ids, emp.user.id]
                                  : ids.filter((id) => id !== emp.user.id),
                              )
                            }
                          />
                          {emp.user.firstName} {emp.user.lastName}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {channelError && <p className="text-sm text-destructive">{channelError}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={createChannel.isPending}>
                    {createChannel.isPending ? 'Se creează...' : 'Creează'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {channelsLoading && <p className="text-xs text-muted-foreground">Se încarcă...</p>}
        {!channelsLoading && channels?.length === 0 && (
          <p className="text-xs text-muted-foreground">Niciun canal încă.</p>
        )}
        <div className="space-y-0.5">
          {channels?.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setSelectedChannelId(channel.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                channel.id === selectedChannelId
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {channel.isPrivate ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{channel.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-lg border border-border">
        {!selectedChannel ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Alege sau creează un canal.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              {selectedChannel.isPrivate ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
              <span className="font-medium">{selectedChannel.name}</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messagesLoading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
              {!messagesLoading && messages?.length === 0 && (
                <p className="text-sm text-muted-foreground">Niciun mesaj încă — scrie primul.</p>
              )}
              {messages?.map((msg) => {
                const isMine = msg.authorId === user?.id;
                return (
                  <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-md rounded-lg px-3 py-2 text-sm',
                        isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                      )}
                    >
                      {!isMine && (
                        <p className="mb-0.5 text-xs font-semibold opacity-80">
                          {msg.author.firstName} {msg.author.lastName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={submitMessage} className="flex gap-2 border-t border-border p-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Scrie un mesaj..."
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={sendMessage.isPending || !draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
