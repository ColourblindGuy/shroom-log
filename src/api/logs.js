// src/api/logs.js
// All Firestore operations for mushroom log entries.
// Each user's logs live at: users/{uid}/logs/{logId}
import { db, auth } from "../firebase";
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, query, orderBy, serverTimestamp,
} from "firebase/firestore";

function logsRef() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return collection(db, "users", uid, "logs");
}

function logDocRef(firebaseId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return doc(db, "users", uid, "logs", firebaseId);
}

export async function loadLogs() {
  const q = query(logsRef(), orderBy("registeredAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), _firebaseId: d.id }));
}

export async function addLog(entry) {
  const ref = await addDoc(logsRef(), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function editLog(firebaseId, entry) {
  return updateDoc(logDocRef(firebaseId), {
    ...entry,
    updatedAt: serverTimestamp(),
  });
}

export async function removeLog(firebaseId) {
  return deleteDoc(logDocRef(firebaseId));
}
