// src/api/announcements.js
// Reads developer announcements from Firestore.
// Announcements are written manually via Firebase Console (or an admin panel).
//
// To post a new announcement:
//  1. Go to Firebase Console → Firestore → announcements collection
//  2. Add a document with these fields:
//       title:     string   e.g. "New event mushrooms!"
//       body:      string   e.g. "Brilliant mushrooms are back 🎉"
//       createdAt: timestamp (use the Timestamp field type)
//       priority:  number   1 = normal, 2 = important
import { db } from "../firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function loadAnnouncements() {
  try {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Could not load announcements:", e);
    return [];
  }
}
