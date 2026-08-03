import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './token-store';

// `NEXT_PUBLIC_API_URL` include sufixul `/api` (prefixul global Nest, vezi
// `main.ts`) — dar `setGlobalPrefix` afectează STRICT rutele HTTP, nu
// namespace-urile Socket.IO (montate la rădăcină, `/socket.io/`), de-aia
// se conectează la origine, nu la `${API_URL}/chat`.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(
  /\/api\/?$/,
  '',
);

let socket: Socket | null = null;

/**
 * O singură conexiune Socket.IO per tab, refolosită de orice hook care are
 * nevoie de livrare live (azi doar chat) — nu una per canal/hook. `auth` e
 * o funcție (nu un obiect static): Socket.IO o reapelează la fiecare
 * (re)conectare, deci un access token reînnoit între timp (refresh silențios,
 * vezi `apiFetch`) ajunge folosit automat la următoarea reconectare, fără
 * cod suplimentar de sincronizare.
 */
export function getChatSocket(): Socket {
  if (!socket) {
    socket = io(`${API_ORIGIN}/chat`, {
      autoConnect: false,
      auth: (cb) => cb({ token: tokenStore.get() }),
    });
  }
  return socket;
}

/** Apelat din `logout()` — o conexiune autentificată nu are de ce să rămână deschisă după delogare. */
export function disconnectChatSocket(): void {
  socket?.disconnect();
  socket = null;
}
