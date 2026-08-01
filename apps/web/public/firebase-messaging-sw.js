// Service worker pentru Firebase Cloud Messaging — livrează notificările
// push când tab-ul aplicației nu e activ/deschis.
//
// Config-ul Firebase (valori PUBLICE prin design, nu secrete) vine din
// query string-ul cu care e înregistrat acest worker (vezi
// `src/lib/push-notifications.ts`) — un fișier static din `public/` nu
// poate citi `process.env`, deci nu poate fi generat din `.env` la build.

importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

// Payload STRICT `data` (fără `notification` la nivelul mesajului FCM) —
// vezi comentariul din `firebase.service.ts` (`sendToTokens`). Cu un
// payload `notification`, SDK-ul ar afișa-o automat AICI, pe lângă
// `showNotification` de mai jos, rezultând 2 notificări identice.
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title ?? 'WorkSphere';
  const body = payload.data?.body ?? '';
  self.registration.showNotification(title, { body });
});
