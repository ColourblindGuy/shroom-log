// src/api/friends.js
// ─────────────────────────────────────────────────────────────
// SCHEMA (additions for requests/invitations):
//
// friend_codes/{CODE}
//   uid, displayName
//
// users/{uid}/profile/data
//   displayName, friendCode, createdAt, lastSeen
//
// users/{uid}/friends/{friendUid}
//   displayName, friendCode, addedAt
//
// users/{uid}/friend_requests/{requestId}   ← INCOMING requests
//   fromUid, fromName, fromCode, sentAt, status: "pending"|"accepted"|"declined"
//
// users/{uid}/sent_requests/{requestId}     ← track what YOU sent
//   toUid, toName, toCode, sentAt, status
//
// mushrooms/{mushroomId}
//   createdBy, createdByName, mushroomType, size, workload,
//   strength, endTime, notes, stars, status, createdAt
//
// mushrooms/{mushroomId}/participants/{uid}
//   displayName, joinedAt, strength, stars, confirmed
//
// users/{uid}/mushroom_invites/{mushroomId}  ← INCOMING invitations
//   mushroomId, mushroomType, size, endTime,
//   fromUid, fromName, sentAt, status: "pending"|"accepted"|"declined"
//
// users/{uid}/mushroom_refs/{mushroomId}
//   role, joinedAt, mushroomId
// ─────────────────────────────────────────────────────────────

import { db, auth } from "../firebase";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc,
  serverTimestamp, onSnapshot,
} from "firebase/firestore";

// ── Helpers ───────────────────────────────────────────────────

function myUid() { return auth.currentUser?.uid; }

function profileRef(userId) {
  return doc(db, "users", userId, "profile", "data");
}
function friendsRef(userId)         { return collection(db, "users", userId, "friends"); }
function friendReqRef(userId)       { return collection(db, "users", userId, "friend_requests"); }
function sentReqRef(userId)         { return collection(db, "users", userId, "sent_requests"); }
function mushroomRef(id)            { return doc(db, "mushrooms", id); }
function participantsRef(id)        { return collection(db, "mushrooms", id, "participants"); }
function mushRefRef(userId, mId)    { return doc(db, "users", userId, "mushroom_refs", mId); }
function logsRef(userId)            { return collection(db, "users", userId, "logs"); }
function invitesRef(userId)         { return collection(db, "users", userId, "mushroom_invites"); }

// ── Profile ───────────────────────────────────────────────────

function generateFriendCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function initProfile(user) {
  const ref  = profileRef(user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const code = generateFriendCode();
    const data = {
      displayName: user.displayName || user.email?.split("@")[0] || "Trainer",
      friendCode: code,
      createdAt: serverTimestamp(),
      lastSeen:  serverTimestamp(),
    };
    await setDoc(ref, data);
    await setDoc(doc(db, "friend_codes", code), { uid: user.uid, displayName: data.displayName });
    return data;
  } else {
    const existingData = snap.data();
    let code = existingData.friendCode;

    if (!code) {
      code = generateFriendCode();
      await updateDoc(ref, { friendCode: code, lastSeen: serverTimestamp() });
    } else {
      await updateDoc(ref, { lastSeen: serverTimestamp() });
    }

    // Ensure the friend_codes/{code} lookup entry exists
    const codeRef = doc(db, "friend_codes", code);
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) {
      await setDoc(codeRef, {
        uid: user.uid,
        displayName: existingData.displayName || user.displayName || user.email?.split("@")[0] || "Trainer",
      });
    }

    return { ...existingData, friendCode: code };
  }
}

export async function getProfile(userId) {
  const snap = await getDoc(profileRef(userId));
  return snap.exists() ? { uid: userId, ...snap.data() } : null;
}

export async function updateDisplayName(name) {
  const uid  = myUid();
  const snap = await getDoc(profileRef(uid));
  const code = snap.data()?.friendCode;
  await updateDoc(profileRef(uid), { displayName: name });
  if (code) {
    await updateDoc(doc(db, "friend_codes", code), { displayName: name });
  }
}

// ── Find user ─────────────────────────────────────────────────

export async function findByFriendCode(code) {
  const clean = code.toUpperCase().trim();
  if (clean.length !== 6) return null;
  const snap = await getDoc(doc(db, "friend_codes", clean));
  if (!snap.exists()) return null;
  const { uid, displayName } = snap.data();
  return { uid, displayName, friendCode: clean };
}

// ── Subscribers (real-time) ──────────────────────────────────

export function subscribeFriendRequests(uid, onData) {
  return onSnapshot(friendReqRef(uid), (snap) => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeSentRequests(uid, onData) {
  return onSnapshot(sentReqRef(uid), (snap) => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onData(all);
  });
}

export function subscribeFriends(uid, onData) {
  return onSnapshot(friendsRef(uid), (snap) => {
    onData(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  });
}

export function subscribeMushroomInvites(uid, onData) {
  return onSnapshot(invitesRef(uid), (snap) => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── Friend Requests ───────────────────────────────────────────

// Send a friend request to another user
export async function sendFriendRequest(toUid, toProfile) {
  const uid     = myUid();
  const mySnap  = await getDoc(profileRef(uid));
  const myData  = mySnap.data();

  // Write to their incoming requests
  await setDoc(doc(friendReqRef(toUid), uid), {
    fromUid:  uid,
    fromName: myData.displayName,
    fromCode: myData.friendCode,
    sentAt:   serverTimestamp(),
    status:   "pending",
  });

  // Write to your sent requests for tracking
  await setDoc(doc(sentReqRef(uid), toUid), {
    toUid:   toUid,
    toName:  toProfile.displayName,
    toCode:  toProfile.friendCode,
    sentAt:  serverTimestamp(),
    status:  "pending",
  });
}

// Accept a friend request
export async function acceptFriendRequest(fromUid, fromName, fromCode) {
  const uid = myUid();
  const mySnap = await getDoc(profileRef(uid));
  const myData = mySnap.data();

  // Add to each other's friends list
  await Promise.all([
    setDoc(doc(friendsRef(uid), fromUid), {
      displayName: fromName, friendCode: fromCode, addedAt: serverTimestamp(),
    }),
    setDoc(doc(friendsRef(fromUid), uid), {
      displayName: myData.displayName, friendCode: myData.friendCode, addedAt: serverTimestamp(),
    }),
  ]);

  // Clean up request docs — incoming request doc ID is the sender's UID
  await deleteDoc(doc(friendReqRef(uid), fromUid));
  // Sent request on sender's side (may not exist for old data)
  try { await deleteDoc(doc(sentReqRef(fromUid), uid)); } catch (e) {
    console.warn("Could not clean up sent_requests:", e.message);
  }
}

// Decline a friend request
export async function declineFriendRequest(fromUid) {
  const uid = myUid();
  try { await deleteDoc(doc(friendReqRef(uid), fromUid)); } catch {}
  try { await deleteDoc(doc(sentReqRef(fromUid), uid)); } catch {}
}

// Cancel a friend request you sent (withdraw)
export async function cancelFriendRequest(toUid) {
  const uid = myUid();
  try { await deleteDoc(doc(sentReqRef(uid), toUid)); } catch {}
  try { await deleteDoc(doc(friendReqRef(toUid), uid)); } catch {}
}

// Remove friend from both sides
export async function removeFriend(friendUid) {
  const uid = myUid();
  try { await deleteDoc(doc(friendsRef(uid), friendUid)); } catch {}
  try { await deleteDoc(doc(friendsRef(friendUid), uid)); } catch {}
}

// ── Mushroom Invitations ──────────────────────────────────────

// Host invites a friend to a shared mushroom
export async function inviteFriendToMushroom(mushroomId, mushroom, toUid, toName, hostName) {
  const uid = myUid();

  await setDoc(doc(invitesRef(toUid), mushroomId), {
    mushroomId:   mushroomId,
    mushroomType: mushroom.mushroomType,
    size:         mushroom.size,
    endTime:      mushroom.endTime,
    fromUid:      uid,
    fromName:     hostName || "A friend",
    sentAt:       serverTimestamp(),
    status:       "pending",
  });
}

// Load pending mushroom invitations
export async function loadMushroomInvites() {
  const snap = await getDocs(invitesRef(myUid()));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.status === "pending");
}

// Decline a mushroom invite
export async function declineMushroomInvite(mushroomId) {
  await deleteDoc(doc(invitesRef(myUid()), mushroomId));
}

// ── Shared Mushrooms ──────────────────────────────────────────

export async function createSharedMushroom(entry, profile) {
  const uid = myUid();
  const numericEndTime = entry.endTime
    ? (entry.endTime instanceof Date ? entry.endTime.getTime() : typeof entry.endTime === 'number' ? entry.endTime : null)
    : null;
  const ref = await addDoc(collection(db, "mushrooms"), {
    createdBy:     uid,
    createdByName: profile.displayName,
    mushroomType:  entry.mushroomType,
    size:          entry.size,
    workload:      Number(entry.workload) || null,
    strength:      Number(entry.strength) || null,
    endTime:       numericEndTime,
    notes:         entry.notes || "",
    stars:         entry.stars || "",
    status:        numericEndTime && numericEndTime <= Date.now() ? "completed" : "active",
    createdAt:     serverTimestamp(),
  });

  await setDoc(doc(participantsRef(ref.id), uid), {
    displayName: profile.displayName,
    joinedAt:    serverTimestamp(),
    strength:    Number(entry.strength) || null,
    stars:       entry.stars || "",
    confirmed:   true,
  });

  await setDoc(mushRefRef(uid, ref.id), {
    role: "host", joinedAt: serverTimestamp(), mushroomId: ref.id,
  });

  return ref.id;
}

// Join by mushroom ID — also writes a local log entry
export async function joinSharedMushroom(mushroomId, profile, strength) {
  const uid = myUid();

  const mushroomSnap = await getDoc(mushroomRef(mushroomId));
  if (!mushroomSnap.exists()) throw new Error("Mushroom not found. Check the ID and try again.");
  const mushroom = mushroomSnap.data();

  // Check not already joined
  const existingParticipant = await getDoc(doc(participantsRef(mushroomId), uid));
  if (existingParticipant.exists()) throw new Error("You've already joined this mushroom.");

  await setDoc(doc(participantsRef(mushroomId), uid), {
    displayName: profile.displayName,
    joinedAt:    serverTimestamp(),
    strength:    strength || null,
    stars:       "",
    confirmed:   false,
  });

  await setDoc(mushRefRef(uid, mushroomId), {
    role: "participant", joinedAt: serverTimestamp(), mushroomId,
  });

  // Delete invite if it existed
  try {
    await deleteDoc(doc(invitesRef(uid), mushroomId));
  } catch { /* ignore */ }

  // Write personal log entry so it appears in History
  const rawEndTime = mushroom.endTime;
  const numericEndTime = rawEndTime
    ? (typeof rawEndTime.toDate === 'function' ? rawEndTime.toDate().getTime() : typeof rawEndTime === 'number' ? rawEndTime : null)
    : null;

  const logEntry = {
    id:               Date.now(),
    mushroomType:     mushroom.mushroomType,
    size:             mushroom.size,
    workload:         mushroom.workload || null,
    strength:         strength || mushroom.strength || null,
    stars:            mushroom.stars || "",
    players:          1,
    notes:            mushroom.notes || "",
    endTime:          numericEndTime,
    registeredAt:     Date.now(),
    date:             new Date().toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }),
    sharedMushroomId: mushroomId,
    sharedBy:         mushroom.createdByName || "a friend",
    createdBy:        mushroom.createdBy,
    isShared:         true,
    createdAt:        serverTimestamp(),
  };

  const logDocRef = await addDoc(logsRef(uid), logEntry);
  return { ...logEntry, _firebaseId: logDocRef.id };
}

export async function getSharedMushroom(mushroomId) {
  const [mushroomSnap, participantsSnap] = await Promise.all([
    getDoc(mushroomRef(mushroomId)),
    getDocs(participantsRef(mushroomId)),
  ]);
  if (!mushroomSnap.exists()) return null;
  return {
    id: mushroomId,
    ...mushroomSnap.data(),
    participants: participantsSnap.docs.map(d => ({ uid: d.id, ...d.data() })),
  };
}

export async function loadMySharedMushrooms() {
  const uid = myUid();
  const refsSnap = await getDocs(collection(db, "users", uid, "mushroom_refs"));
  if (refsSnap.empty) return [];
  const mushrooms = await Promise.all(refsSnap.docs.map(d => getSharedMushroom(d.id)));
  return mushrooms.filter(Boolean);
}

export async function updateSharedMushroom(mushroomId, entry) {
  const numericEndTime = entry.endTime
    ? (entry.endTime instanceof Date ? entry.endTime.getTime() : typeof entry.endTime === 'number' ? entry.endTime : null)
    : null;
  await updateDoc(mushroomRef(mushroomId), {
    mushroomType: entry.mushroomType,
    size:         entry.size,
    workload:     Number(entry.workload) || null,
    strength:     Number(entry.strength) || null,
    endTime:      numericEndTime,
    notes:        entry.notes || "",
    stars:        entry.stars || "",
    status:       numericEndTime && numericEndTime <= Date.now() ? "completed" : "active",
    updatedAt:    serverTimestamp(),
  });
}

export function listenToSharedMushroom(mushroomId, callback) {
  // Fetch participants once, then only listen to the mushroom doc
  return getDocs(participantsRef(mushroomId)).then((participantsSnap) => {
    const participants = participantsSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    return onSnapshot(mushroomRef(mushroomId), (snap) => {
      if (!snap.exists()) return;
      callback({
        id: mushroomId,
        ...snap.data(),
        participants,
      });
    });
  });
}

export async function leaveSharedMushroom(mushroomId) {
  const uid = myUid();
  await Promise.all([
    deleteDoc(doc(participantsRef(mushroomId), uid)),
    deleteDoc(mushRefRef(uid, mushroomId)),
  ]);
}
