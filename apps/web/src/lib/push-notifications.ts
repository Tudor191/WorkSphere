import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';

export const isPushConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && vapidKey);

export function isPushSupportedByBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  );
}

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Înregistrează service worker-ul cu config-ul Firebase transmis prin query
 * string — un fișier static din `public/` nu poate citi `.env`, deci nu
 * poate fi generat din build (vezi comentariul din `firebase-messaging-sw.js`).
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const query = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query.toString()}`);
}

/**
 * Cere permisiunea de notificări browser-ului și, dacă acordată, întoarce
 * un token FCM de înregistrat pe server. `null` STRICT dacă userul refuză
 * permisiunea — orice altă condiție care împiedică activarea (config
 * lipsă, browser nesuportat) aruncă o eroare explicită, ca butonul din UI
 * să nu pară că "nu face nimic" quando de fapt lipsește o variabilă de
 * mediu.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!isPushConfigured) {
    throw new Error(
      'Configurare Firebase incompletă — verifică variabilele NEXT_PUBLIC_FIREBASE_* (inclusiv VAPID key) din apps/web/.env, apoi repornește pnpm dev.',
    );
  }
  if (!isPushSupportedByBrowser()) {
    throw new Error('Browserul acesta nu suportă notificări push.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  await registerServiceWorker();
  // `register()` se rezolvă imediat ce înregistrarea e creată, nu neapărat
  // după ce worker-ul a devenit activ — `PushManager.subscribe()` (folosit
  // intern de `getToken`) cere un worker deja activ, altfel aruncă
  // `AbortError: no active Service Worker`. `serviceWorker.ready` așteaptă
  // exact tranziția asta, inclusiv la prima instalare.
  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  return token || null;
}

/** Mesaje primite cât timp tab-ul e activ (SW-ul de fundal nu se declanșează în acest caz). */
export function onForegroundPush(callback: (title: string, body: string) => void): () => void {
  if (!isPushConfigured || !isPushSupportedByBrowser()) return () => {};

  let messaging: Messaging;
  try {
    messaging = getMessaging(getFirebaseApp());
  } catch {
    return () => {};
  }
  return onMessage(messaging, (payload) => {
    callback(payload.notification?.title ?? 'WorkSphere', payload.notification?.body ?? '');
  });
}
