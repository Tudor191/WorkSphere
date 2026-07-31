const STORAGE_KEY = 'worksphere_session_identity';

interface SessionIdentity {
  userId: string;
  companyId: string;
}

/**
 * Cookie-ul httpOnly de refresh e comun pentru tot browser-ul (per origine),
 * NU per filă — dacă o altă filă/fereastră se autentifică cu alt cont
 * (ex: înregistrează o companie nouă) în timp ce fila curentă e încă
 * deschisă pe o sesiune veche, cookie-ul e suprascris pentru TOATE filele.
 * Fila veche, la următoarea reînnoire (reload sau refresh silențios la
 * expirarea access token-ului, 15 min), ar prelua silențios noua sesiune —
 * fără nicio delogare vizibilă, arătând datele altei companii ca și cum ar
 * fi o continuare normală. `sessionStorage` (spre deosebire de cookie/
 * localStorage) e izolat per filă, deci îl folosim ca să reținem "ce cont
 * crede fila asta că are" și să detectăm o schimbare survenită din altă
 * filă înainte s-o afișăm.
 */
function decodeAccessTokenIdentity(token: string): SessionIdentity | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(normalized)) as { sub?: unknown; companyId?: unknown };
    if (typeof json.sub === 'string' && typeof json.companyId === 'string') {
      return { userId: json.sub, companyId: json.companyId };
    }
    return null;
  } catch {
    return null;
  }
}

function readRecordedIdentity(): SessionIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionIdentity) : null;
  } catch {
    return null;
  }
}

function writeRecordedIdentity(identity: SessionIdentity | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (identity) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage indisponibil (mod privat strict etc.) — verificarea devine no-op.
  }
}

/** Folosit la login/register explicit — fila își stabilește deliberat o nouă identitate. */
export function recordIdentityFromToken(accessToken: string): void {
  writeRecordedIdentity(decodeAccessTokenIdentity(accessToken));
}

export function clearRecordedIdentity(): void {
  writeRecordedIdentity(null);
}

/**
 * Folosit la restaurări PASIVE de sesiune (mount effect, refresh silențios
 * pe 401) — NU la login/register explicit. Dacă fila nu are încă nicio
 * identitate reținută, acceptă și o reține (prima restaurare din fila
 * asta). Dacă are deja una și nu coincide cu userId-ul din tokenul nou,
 * înseamnă că altă filă a schimbat cookie-ul comun de sub noi.
 */
export function checkAndRecordIdentity(accessToken: string): 'ok' | 'mismatch' {
  const incoming = decodeAccessTokenIdentity(accessToken);
  if (!incoming) return 'ok';
  const recorded = readRecordedIdentity();
  if (recorded && recorded.userId !== incoming.userId) {
    return 'mismatch';
  }
  writeRecordedIdentity(incoming);
  return 'ok';
}
