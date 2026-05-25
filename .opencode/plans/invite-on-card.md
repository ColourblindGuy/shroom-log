# Invite-on-Card + Misc Fixes

## Files to modify
- `src/api/friends.js`
- `src/App.jsx`

---

## 1. `src/api/friends.js` — Add `upgradeToShared` function

Insert after `updateSharedMushroom` (around line 263), before `// ── Mushroom Invitations ──`:

```javascript
// Upgrade a personal log entry to shared (creates shared doc + roster)
export async function upgradeToShared(entry, profile, logFirebaseId) {
  const uid = myUid();
  const numericEndTime = entry.endTime
    ? (entry.endTime instanceof Date ? entry.endTime.getTime() : typeof entry.endTime === 'number' ? entry.endTime : null)
    : null;

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

  const rosterId = await createRoster(profile.displayName);

  await updateDoc(doc(db, "users", uid, "logs", logFirebaseId), {
    sharedMushroomId,
    rosterId,
    isShared: true,
    createdBy: uid,
  });

  return { sharedMushroomId, rosterId };
}
```

---

## 2. `src/App.jsx` — Import `upgradeToShared`

At line 21, add `upgradeToShared` to the friends import:
```javascript
import { subscribeFriendRequests, subscribeMushroomInvites, subscribeFriends,
  registerSharedMushroom, getSharedMushroom, updateSharedMushroom, getRoster,
  acceptFriendRequest, declineFriendRequest, declineMushroomInvite,
  acceptMushroomInvite, inviteFriendToMushroom, upgradeToShared, getProfile } from "./api/friends";
```

---

## 3. `src/App.jsx` — Add `handleInviteFriends` in App component

Insert after `handleAcceptMushroom` (around line 640), before `handleDeclineMushroom`:

```javascript
async function handleInviteFriends(entry, friendsToInvite, mushroomInfo) {
  if (friendsToInvite.length === 0) return 0;
  const profData = await getProfile(user.uid);
  const prof = { displayName: profData?.displayName || user.displayName || "Trainer" };

  let rosterId = entry.rosterId;
  let sharedMushroomId = entry.sharedMushroomId;

  if (!rosterId || !sharedMushroomId) {
    const result = await upgradeToShared(entry, prof, entry._firebaseId);
    sharedMushroomId = result.sharedMushroomId;
    rosterId = result.rosterId;
    setLog(prev => prev.map(e =>
      e.id === entry.id
        ? { ...e, sharedMushroomId, rosterId, isShared: true, createdBy: user.uid }
        : e
    ));
  }

  const roster = await getRoster(rosterId);
  const existingUids = new Set(roster?.members.map(m => m.uid) || []);
  const newFriends = friendsToInvite.filter(f => !existingUids.has(f.uid));
  if (newFriends.length === 0) return 0;

  await Promise.all(newFriends.map(f =>
    inviteFriendToMushroom(rosterId, sharedMushroomId, mushroomInfo, f.uid, f.displayName, prof.displayName)
  ));
  return newFriends.length;
}
```

---

## 4. `src/App.jsx` — Add `onInviteFriends` to `shared` object (line ~692)

```javascript
const shared = { th, log: filteredLog, allLog: log, search, setSearch,
  filterType, setFilterType, onEdit: startEdit, onDelete: deleteEntry,
  onDeleteAll: deleteAllCompleted, friends, user, onInviteFriends: handleInviteFriends };
```

---

## 5. `src/App.jsx` — Update `HistoryView` signature (line ~1213)

```javascript
function HistoryView({ th, log, allLog, search, setSearch, filterType, setFilterType, onEdit, onDelete, onDeleteAll, friends, user, onInviteFriends }) {
```

---

## 6. `src/App.jsx` — Update `LogCard` render in `HistoryView` (line ~1300)

```javascript
{shown.map((entry, i) => (
  <LogCard key={entry.id} entry={entry} index={i}
    isActive={histTab === "active"} th={th}
    onEdit={onEdit} onDelete={onDelete}
    friends={friends} user={user} onInviteFriends={onInviteFriends} />
))}
```

---

## 7. `src/App.jsx` — Update `LogCard` signature (line ~1308)

```javascript
function LogCard({ entry, index, isActive, th, onEdit, onDelete, friends, user, onInviteFriends }) {
```

---

## 8. `src/App.jsx` — Add invite state + UI inside `LogCard`

After `const participants = roster?.members || null;` (line ~1327), add state:
```javascript
const [inviteOpen, setInviteOpen] = useState(false);
const [inviteSelected, setInviteSelected] = useState([]);
const [inviteSending, setInviteSending] = useState(false);
const [inviteDone, setInviteDone] = useState(false);
```

Between end-time block (ends ~line 1396) and shared mushroom section (starts ~line 1398), insert:
```javascript
{/* Invite Friends on card */}
{isActive && friends.length > 0 && (
  <div style={{ marginBottom: 6 }}>
    {!inviteOpen ? (
      <button onClick={() => setInviteOpen(true)} style={{
        width: "100%", padding: "8px 12px", borderRadius: 10,
        border: `1.5px dashed ${th.border}`, background: th.surfaceAlt,
        color: th.accent, fontWeight: 700, fontSize: 12,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        🎮 Invite Friends
      </button>
    ) : (
      <div style={{ background: th.surfaceAlt, border: `1px solid ${th.borderFaint}`,
        borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: th.accent, marginBottom: 4 }}>
          Invite friends to join
        </div>
        {!entry.rosterId && (
          <div style={{ fontSize: 11, color: th.textFaint, marginBottom: 6 }}>
            This will create a shared mushroom for this entry
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {friends.filter(f => !participants?.some(p => p.uid === f.uid)).map(f => {
            const sel = inviteSelected.some(s => s.uid === f.uid);
            return (
              <button key={f.uid} onClick={() => {
                setInviteSelected(prev =>
                  sel ? prev.filter(s => s.uid !== f.uid) : [...prev, { uid: f.uid, displayName: f.displayName }]
                );
              }} style={{
                padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                border: `1.5px solid ${sel ? th.accent : th.border}`,
                background: sel ? th.tabActive : th.bg,
                color: sel ? th.accent : th.textFaint,
              }}>
                {sel ? "✓ " : ""}{f.displayName}
              </button>
            );
          })}
          {friends.filter(f => !participants?.some(p => p.uid === f.uid)).length === 0 && (
            <div style={{ fontSize: 11, color: th.textFaint, fontStyle: "italic" }}>
              All your friends are already in this mushroom
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={async () => {
            if (inviteSelected.length === 0) return;
            setInviteSending(true);
            const sent = await onInviteFriends(entry, inviteSelected, {
              mushroomType: live.mushroomType,
              size: live.size,
              endTime: live.endTime,
            });
            setInviteSending(false);
            if (sent > 0) {
              setInviteDone(true);
              setInviteSelected([]);
              setTimeout(() => { setInviteDone(false); setInviteOpen(false); }, 2000);
            }
          }} disabled={inviteSelected.length === 0 || inviteSending} style={{
            padding: "6px 14px", borderRadius: 8, border: "none",
            background: inviteDone ? th.positive : th.accentGrad,
            color: "#fff", fontWeight: 800, fontSize: 12,
            cursor: inviteSelected.length === 0 ? "default" : "pointer",
            fontFamily: "inherit", opacity: inviteSelected.length === 0 ? 0.5 : 1,
          }}>
            {inviteSending ? "Sending…" : inviteDone ? "✅ Sent!" : `Send (${inviteSelected.length})`}
          </button>
          <button onClick={() => { setInviteOpen(false); setInviteSelected([]); }} style={{
            padding: "6px 14px", borderRadius: 8, border: `1px solid ${th.border}`,
            background: th.bg, color: th.textMid, fontWeight: 700, fontSize: 12,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Cancel
          </button>
        </div>
      </div>
    )}
  </div>
)}
```

---

## 9. `src/App.jsx` — Hide "Invite Friends" during edits in `RegisterView` (line ~1157)

Change:
```jsx
{friends.length > 0 && (
```
to:
```jsx
{!editId && friends.length > 0 && (
```
