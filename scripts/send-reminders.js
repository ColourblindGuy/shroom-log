// scripts/send-reminders.js
//
// Server-side delivery for mushroom-end reminders — run on a schedule by
// .github/workflows/mushroom-reminders.yml (GitHub Actions cron), NOT
// Firebase Cloud Functions. That keeps the project on Firestore's free
// Spark plan: no Blaze plan, no billing account, no card on file.
//
// Why this exists at all: the original client-only implementation
// scheduled a setTimeout/setInterval in the page. Mobile browsers (iOS
// Safari especially, but Android Chrome too under Doze/battery
// optimization) suspend or kill a backgrounded PWA's JS long before a
// timer scheduled days out can fire, and the timer was never even
// re-armed for entries loaded from a previous session. Running this
// check from outside the device — on a fixed schedule, independent of
// whether the app is open — is the fix.
//
// Every log entry (users/{uid}/logs/{logId}) that wants a reminder
// carries:
//   notifyAt  — epoch ms, 5 minutes before the mushroom's endTime
//   notified  — false until sent, then flipped to true; null/absent for
//               entries that don't want one (logged in "past" mode)
// See src/App.jsx submit() and src/api/friends.js for where these are set.
//
// Auth: expects the full service-account JSON in the FIREBASE_SERVICE_ACCOUNT
// env var (see .github/workflows/mushroom-reminders.yml + README below for
// how that secret gets there).
const admin = require("firebase-admin");

const STALE_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set.");
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const messaging = admin.messaging();
  const now = Date.now();

  const snap = await db.collectionGroup("logs")
    .where("notified", "==", false)
    .where("notifyAt", "<=", now)
    .get();

  if (snap.empty) {
    console.log("No reminders due.");
    return;
  }

  console.log(`${snap.size} reminder(s) due.`);
  const results = await Promise.allSettled(
    snap.docs.map(docSnap => sendReminder(db, messaging, docSnap, now)),
  );
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed++;
      console.error(`Reminder failed for ${snap.docs[i].ref.path}:`, r.reason);
    }
  });
  if (failed > 0) process.exitCode = 1; // surface it in the Actions run
}

async function sendReminder(db, messaging, docSnap, now) {
  const entry = docSnap.data();
  const uid = docSnap.ref.parent.parent.id; // users/{uid}/logs/{logId}
  const tokensRef = db.collection("users").doc(uid).collection("fcmTokens");
  const tokensSnap = await tokensRef.get();
  const tokens = tokensSnap.docs.map(d => d.id);

  if (tokens.length === 0) {
    // No device registered for push — nothing to do, don't retry forever.
    console.log(`${docSnap.ref.path}: 0 tokens for uid ${uid} — marking notified without sending.`);
    await docSnap.ref.update({ notified: true });
    return;
  }
  console.log(`${docSnap.ref.path}: sending to ${tokens.length} token(s) for uid ${uid}.`);

  const label = entry.mushroomLabel || entry.mushroomType || "Mushroom";
  const size = entry.size ? `${entry.size} ` : "";
  // Computed rather than hardcoded "5 minutes": this job runs every 5
  // minutes, not continuously, so by the time it picks an entry up the
  // real remaining time may be a bit less than notifyAt implied.
  const minsLeft = Math.max(1, Math.round((entry.endTime - now) / 60000));

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: "🍄 Mushroom ending soon!",
      body: `Your ${size}${label} mushroom ends in about ${minsLeft} minute${minsLeft === 1 ? "" : "s"}!`,
    },
    webpush: {
      notification: { icon: "/icon-192.png", tag: "mushroom-reminder" },
      fcmOptions: { link: "/" },
    },
  });

  console.log(`${docSnap.ref.path}: ${result.successCount} succeeded, ${result.failureCount} failed.`);
  result.responses.forEach((r, i) => {
    if (!r.success) console.log(`  token ${tokens[i].slice(0, 12)}…: ${r.error?.code} — ${r.error?.message}`);
  });

  // Prune tokens FCM reports as dead (uninstalled, expired, etc.) so future
  // runs don't keep paying to fan out to a device that's gone for good.
  const stale = result.responses
    .map((r, i) => (!r.success && STALE_TOKEN_ERRORS.has(r.error?.code) ? tokens[i] : null))
    .filter(Boolean);
  await Promise.all(stale.map(t => tokensRef.doc(t).delete()));

  await docSnap.ref.update({ notified: true });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
