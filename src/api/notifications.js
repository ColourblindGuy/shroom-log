// src/api/notifications.js
// Push registration for mushroom-end reminders (Firebase Cloud Messaging).
//
// Delivery itself is server-side: a scheduled Cloud Function scans
// users/{uid}/logs for entries whose notifyAt has passed and pushes to
// every token below, so a reminder fires even if this device/app was
// closed the whole time. This file only manages "which devices should
// this user's reminders be sent to".
//
// Tokens live at: users/{uid}/fcmTokens/{token}  (doc id = token itself,
// so re-registering the same device is naturally idempotent).
import { db, auth, getMessagingInstance } from "../firebase";
import { getToken, deleteToken, onMessage } from "firebase/messaging";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function tokenDocRef(uid, token) {
  return doc(db, "users", uid, "fcmTokens", token);
}

// Request browser permission (if not already granted) and register this
// device's push token. Safe to call repeatedly / on every app load.
export async function enablePushNotifications() {
  if (!("Notification" in window)) throw new Error("Notifications aren't supported in this browser.");
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { granted: false, token: null };

  const messaging = await getMessagingInstance();
  if (!messaging) throw new Error("Push messaging isn't supported on this device/browser.");
  if (!VAPID_KEY) throw new Error("Missing VITE_FIREBASE_VAPID_KEY — see .env.example.");

  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  // getToken() normally throws on failure, but can also resolve with an
  // empty value (seen with some ad-blockers/privacy extensions silently
  // dropping the FCM registration request) — treat that as a failure too
  // instead of quietly reporting success with nothing actually registered.
  if (!token) throw new Error("Browser didn't return a push token — an ad blocker or privacy extension may be blocking Google's push service (fcm.googleapis.com).");

  await setDoc(tokenDocRef(uid, token), {
    userAgent: navigator.userAgent,
    updatedAt: serverTimestamp(),
  });

  return { granted: true, token };
}

// Stop push delivery to this device. Browser-level permission is left
// alone — that's the user's to revoke from their own browser settings.
export async function disablePushNotifications(token) {
  const uid = auth.currentUser?.uid;
  const messaging = await getMessagingInstance();
  if (messaging) {
    try { await deleteToken(messaging); } catch { /* already gone — fine */ }
  }
  if (uid && token) await deleteDoc(tokenDocRef(uid, token));
}

// FCM only auto-displays a notification while the app/tab isn't focused
// (handled by sw.js's onBackgroundMessage). When the tab IS focused, the
// message instead arrives here so the app can show it itself.
export async function listenForegroundMessages(onNotification) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, onNotification);
}
