import { precacheAndRoute } from "workbox-precaching";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push notifications (FCM) ──────────────────────────────────
// Delivery is server-side (see scripts/send-reminders.js, run on a GitHub Actions cron) so this fires whether
// or not the app was ever reopened before the scheduled time. Vite inlines
// these import.meta.env.VITE_* values at build time, same as src/firebase.js.
const messaging = getMessaging(initializeApp({
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}));

onBackgroundMessage(messaging, (payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title || "🍄 Mushroom ending soon!", {
    body: body || "Your mushroom battle is about to end.",
    icon: "/icon-192.png",
    tag: "mushroom-reminder",
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (list.length > 0) {
        list[0].focus();
      } else {
        self.clients.openWindow("/");
      }
    }),
  );
});
