import { auth, db, googleProvider } from "../firebase";
import {
  deleteUser,
  reauthenticateWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  doc, getDoc, collection, getDocs, deleteDoc, writeBatch,
} from "firebase/firestore";

function profileRef(userId)     { return doc(db, "users", userId, "profile", "data"); }
function logsRef(userId)        { return collection(db, "users", userId, "logs"); }
function friendsRef(userId)     { return collection(db, "users", userId, "friends"); }
function friendReqRef(userId)   { return collection(db, "users", userId, "friend_requests"); }
function sentReqRef(userId)     { return collection(db, "users", userId, "sent_requests"); }
function invitesRef(userId)     { return collection(db, "users", userId, "mushroom_invites"); }

export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("No user signed in");

  const uid = user.uid;
  const isGoogle = user.providerData?.some(p => p.providerId === "google.com");

  if (isGoogle) {
    await reauthenticateWithPopup(user, googleProvider);
  } else {
    const email = prompt("Re-enter your email to confirm deletion:");
    const password = prompt("Re-enter your password:");
    if (!email || !password) throw new Error("Cancelled");
    const cred = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(user, cred);
  }

  const snap = await getDoc(profileRef(uid));
  const code = snap.data()?.friendCode;

  const batch = writeBatch(db);

  if (code) {
    batch.delete(doc(db, "friend_codes", code));
  }

  batch.delete(profileRef(uid));

  const [logSnap, friendSnap, reqSnap, sentSnap, inviteSnap] = await Promise.all([
    getDocs(logsRef(uid)),
    getDocs(friendsRef(uid)),
    getDocs(friendReqRef(uid)),
    getDocs(sentReqRef(uid)),
    getDocs(invitesRef(uid)),
  ]);

  logSnap.docs.forEach(d => batch.delete(d.ref));
  friendSnap.docs.forEach(d => batch.delete(d.ref));
  reqSnap.docs.forEach(d => batch.delete(d.ref));
  sentSnap.docs.forEach(d => batch.delete(d.ref));
  inviteSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();

  for (const d of friendSnap.docs) {
    try { await deleteDoc(doc(db, "users", d.id, "friends", uid)); } catch {}
  }

  await deleteUser(user);
}
