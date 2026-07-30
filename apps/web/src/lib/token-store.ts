/**
 * Access token-ul JWT trăiește STRICT în memorie (nu localStorage/sessionStorage)
 * — reduce suprafața de atac XSS (un script injectat nu poate citi un
 * modul JS privat la fel de ușor cum ar citi localStorage). Refresh
 * token-ul e într-un cookie httpOnly, invizibil pentru JS — la refresh de
 * pagină, `AuthProvider` apelează `/auth/refresh` pentru un access token nou.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};
