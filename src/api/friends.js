// src/api/friends.js

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

// ── Roster (shared participant tracker) ───────────────────────

// A lightweight doc that just tracks who's part of a shared mushroom group.
// Each member has their own independent log entry (snapshot).
// The roster only stores participant names — no mushroom data.

function rosterRef(rosterId) {
  return doc(db, "roster", rosterId);
}

// Create a roster when host invites friends
export async function createRoster(hostDisplayName) {
  const uid = myUid();
  const ref = await addDoc(collection(db, "roster"), {
    hostUid: uid,
    hostName: hostDisplayName,
    createdAt: serverTimestamp(),
    members: { [uid]: hostDisplayName },
  });
  return ref.id;
}

// Add current user to a roster (when accepting an invite)
export async function joinRoster(rosterId, displayName) {
  const uid = myUid();
  await updateDoc(rosterRef(rosterId), {
    [`members.${uid}`]: displayName,
  });
}

// Get roster data (for displaying participants)
export async function getRoster(rosterId) {
  const snap = await getDoc(rosterRef(rosterId));
  if (!snap.exists()) return null;
  const data = snap.data();
  const members = Object.entries(data.members || {}).map(([uid, displayName]) => ({
    uid, displayName,
  }));
  return { id: rosterId, hostUid: data.hostUid, hostName: data.hostName, members };
}

// ── Shared Mushroom Doc (collaborative) ───────────────────────

// Get live shared mushroom data (type, size, stars, notes, etc.)
export async function getSharedMushroom(mushroomId) {
  const snap = await getDoc(doc(db, "mushrooms", mushroomId));
  if (!snap.exists()) return null;
  return { id: mushroomId, ...snap.data() };
}

// Update the shared doc — changes propagate to all participants
export async function updateSharedMushroom(mushroomId, entry) {
  const numericEndTime = entry.endTime
    ? (entry.endTime instanceof Date ? entry.endTime.getTime() : typeof entry.endTime === 'number' ? entry.endTime : null)
    : null;
  await updateDoc(doc(db, "mushrooms", mushroomId), {
    mushroomType: entry.mushroomType,
    size:         entry.size,
    workload:     Number(entry.workload) || null,
    strength:     Number(entry.strength) || null,
    endTime:      numericEndTime,
    notes:        entry.notes || "",
    stars:        entry.stars || "",
    players:      Number(entry.players) || 1,
    updatedAt:    serverTimestamp(),
  });
}

// ── Mushroom Invitations ──────────────────────────────────────

// Host invites a friend to a shared mushroom
export async function inviteFriendToMushroom(rosterId, sharedMushroomId, mushroom, toUid, toName, hostName) {
  const uid = myUid();

  await setDoc(doc(invitesRef(toUid), rosterId), {
    rosterId,
    sharedMushroomId,
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

// Host registers a new mushroom and invites friends to it.
// Creates a shared doc (mutable by all) + roster (participant tracker)
// + personal log entry + sends invites.
// Edits update the shared doc; deletion is per-user.
export async function registerSharedMushroom(entry, profile, invitedFriends) {
  const uid = myUid();
  const numericEndTime = entry.endTime
    ? (entry.endTime instanceof Date ? entry.endTime.getTime() : typeof entry.endTime === 'number' ? entry.endTime : null)
    : null;

  // 1. Create the shared mushroom doc (mutable collaborative data)
  const sharedRef = await addDoc(collection(db, "mushrooms"), {
    createdBy:     uid,
    createdByName: profile.displayName,
    mushroomType:  entry.mushroomType,
    size:          entry.size,
    workload:      Number(entry.workload) || null,
    strength:      Number(entry.strength) || null,
    endTime:       numericEndTime,
    notes:         entry.notes || "",
    stars:         entry.stars || "",
    players:       Number(entry.players) || 1,
    status:        numericEndTime && numericEndTime <= Date.now() ? "completed" : "active",
    createdAt:     serverTimestamp(),
  });
  const sharedMushroomId = sharedRef.id;

  // 2. Create the roster (participant tracker)
  const rosterId = await createRoster(profile.displayName);

  // 3. Create a personal log entry for the host
  const logRef = await addDoc(logsRef(uid), {
    id:           entry.id,
    mushroomType: entry.mushroomType,
    size:         entry.size,
    stars:        entry.stars || "",
    players:      entry.players || 1,
    workload:     String(entry.workload || ""),
    strength:     String(entry.strength || ""),
    notes:        entry.notes || "",
    startTime:    entry.startTime || "",
    endTime:      numericEndTime,
    registeredAt: entry.registeredAt || Date.now(),
    date:         entry.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    sharedMushroomId,
    rosterId,
    isShared:     true,
    createdBy:    uid,
    createdAt:    serverTimestamp(),
  });

  // 4. Send invites to each friend
  const mushroomInfo = { mushroomType: entry.mushroomType, size: entry.size, endTime: numericEndTime };
  await Promise.all(invitedFriends.map(friend =>
    inviteFriendToMushroom(rosterId, sharedMushroomId, mushroomInfo, friend.uid, friend.displayName, profile.displayName)
  ));

  return { logFirebaseId: logRef.id, sharedMushroomId, rosterId };
}

// Accept a mushroom invite — join roster, create personal log entry referencing shared doc
export async function acceptMushroomInvite(invite, profile) {
  const uid = myUid();
  const { rosterId, sharedMushroomId } = invite;

  // 1. Join the roster
  await joinRoster(rosterId, profile.displayName);

  // 2. Delete invite
  try { await deleteDoc(doc(invitesRef(uid), rosterId)); } catch { /* ignore */ }

  // 3. Write personal log entry (snapshot — user owns this copy)
  const rawEndTime = invite.endTime;
  const numericEndTime = rawEndTime
    ? (typeof rawEndTime.toDate === 'function' ? rawEndTime.toDate().getTime() : typeof rawEndTime === 'number' ? rawEndTime : null)
    : null;

  const logEntry = {
    id:           Date.now(),
    mushroomType: invite.mushroomType,
    size:         invite.size,
    workload:     null,
    strength:     null,
    stars:        "",
    players:      1,
    notes:        "",
    endTime:      numericEndTime,
    registeredAt: Date.now(),
    date:         new Date().toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }),
    sharedMushroomId,
    rosterId,
    sharedBy:     invite.fromName,
    isShared:     true,
    createdAt:    serverTimestamp(),
  };

  const logDocRef = await addDoc(logsRef(uid), logEntry);
  return { ...logEntry, _firebaseId: logDocRef.id };
}
