// src/firebase.js
// ─────────────────────────────────────────────────────────────
// SETUP:
//  1. Create .env in project root (copy from .env.example)
//  2. Fill in your Firebase project values
//  3. Add the same vars to Vercel → Settings → Environment Variables
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db             = getFirestore(app);
export const auth           = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Cloud Messaging isn't available everywhere (older Safari, non-browser
// environments, no ServiceWorker/PushManager support) — always go through
// this instead of calling getMessaging(app) directly.
let messagingPromise = null;
export function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = isSupported().then(ok => (ok ? getMessaging(app) : null));
  }
  return messagingPromise;
}
