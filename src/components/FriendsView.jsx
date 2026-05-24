// src/components/FriendsView.jsx
import { useState, useEffect } from "react";
import {
  initProfile, updateDisplayName,
  findByFriendCode, removeFriend,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  cancelFriendRequest,
  subscribeSentRequests,
  subscribeFriends,
  loadMySharedMushrooms,
  declineMushroomInvite,
  joinSharedMushroom,
} from "../api/friends";
import { MUSHROOM_TYPES, SIZE_EMOJI, formatDuration } from "../App";

// ── Utilities ─────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Main View ─────────────────────────────────────────────────
export default function FriendsView({ th, user, myLog, onLogAdded, onNotifChange, mushroomInvites: propInvites, friendRequests: propReqs }) {
  const [subTab, setSubTab]           = useState("friends");
  const [profile, setProfile]         = useState(null);
  const [friends, setFriends]         = useState([]);
  const [sentRequests, setSentReqs]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [codeCopied, setCodeCopied]   = useState(false);

  // Use props if provided (from App.jsx subscriptions), otherwise manage locally
  const friendRequests = propReqs !== undefined ? propReqs : [];
  const mushroomInvites = propInvites !== undefined ? propInvites : [];

  const notifCount = friendRequests.length + mushroomInvites.length;

  useEffect(() => {
    if (onNotifChange) onNotifChange(notifCount);
  }, [notifCount, onNotifChange]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubs = [];

    initProfile(user).then(prof => {
      setProfile(prof);
      unsubs.push(subscribeSentRequests(user.uid, setSentReqs));
      unsubs.push(subscribeFriends(user.uid, setFriends));
      return loadMySharedMushrooms();
    }).then(shared => {
      setShared(shared.sort((a,b) => {
        const toNum = (v) => v ? (typeof v.toDate === 'function' ? v.toDate().getTime() : typeof v === 'number' ? v : 0) : 0;
        return (toNum(b.createdAt) || b.createdAt?.seconds || 0) - (toNum(a.createdAt) || a.createdAt?.seconds || 0);
      }));
      setLoading(false);
    }).catch(e => { console.error(e); setLoading(false); });

    return () => unsubs.forEach(u => u());
  }, [user]);

  function copyCode() {
    if (!profile?.friendCode) return;
    navigator.clipboard.writeText(profile.friendCode).then(() => {
      setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1800);
    });
  }

  // ── Accept friend request ──
  async function handleAcceptFriend(req) {
    try {
      await acceptFriendRequest(req.fromUid, req.fromName, req.fromCode);
    } catch (e) {
      console.error("accept failed", e);
      alert("Failed to accept request. Check your connection and try again.");
    }
  }

  // ── Decline friend request ──
  async function handleDeclineFriend(req) {
    try {
      await declineFriendRequest(req.fromUid);
    } catch (e) {
      console.error("decline failed", e);
    }
  }

  // ── Cancel sent request ──
  async function handleCancelSent(toUid) {
    try {
      await cancelFriendRequest(toUid);
    } catch (e) {
      console.error("cancel failed", e);
    }
  }

  // ── Accept mushroom invite ──
  async function handleAcceptInvite(invite) {
    try {
      const logEntry = await joinSharedMushroom(invite.mushroomId, profile, null);
      if (onLogAdded) onLogAdded(logEntry);
    } catch (e) {
      alert(e.message || "Failed to join. Try again.");
    }
  }

  // ── Decline mushroom invite ──
  async function handleDeclineInvite(invite) {
    try {
      await declineMushroomInvite(invite.mushroomId);
    } catch (e) {
      console.error("decline invite failed", e);
    }
  }

  // ── Remove friend ──
  async function handleRemoveFriend(friendUid) {
    if (!window.confirm("Remove this friend?")) return;
    try {
      await removeFriend(friendUid);
    } catch (e) {
      console.error("remove failed", e);
      alert("Failed to remove friend.");
    }
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: th.textFaint }}>Loading…</div>
  );

  const tabs = [
    { key: "friends",       label: "👥 Friends",      badge: friendRequests.length },
    { key: "notifications", label: "🔔 Notifications", badge: notifCount },
  ];

  return (
    <div className="fade-in">
      <ProfileCard th={th} profile={profile} user={user}
        copied={codeCopied} onCopy={copyCode}
        onNameChange={name => setProfile(p => ({ ...p, displayName: name }))} />

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: th.surfaceAlt,
        borderRadius: 14, padding: 4, border: `1px solid ${th.border}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10, border: "none",
            fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer",
            transition: "all 0.2s", position: "relative",
            background: subTab === t.key ? th.tabActive : "transparent",
            color: subTab === t.key ? th.accent : th.textFaint,
            boxShadow: subTab === t.key ? `0 0 12px ${th.accentGlow}` : "none",
          }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{ position: "absolute", top: 2, right: 4,
                background: th.warning, color: "#fff", borderRadius: 99,
                fontSize: 9, fontWeight: 900, padding: "1px 5px" }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {subTab === "friends" && (
        <FriendsTab th={th} friends={friends} sentRequests={sentRequests}
          profile={profile} onRemove={handleRemoveFriend}
          onCancelSent={handleCancelSent} />
      )}
      {subTab === "notifications" && (
        <NotificationsTab th={th}
          friendRequests={friendRequests}
          mushroomInvites={mushroomInvites}
          onAcceptFriend={handleAcceptFriend}
          onDeclineFriend={handleDeclineFriend}
          onAcceptInvite={handleAcceptInvite}
          onDeclineInvite={handleDeclineInvite} />
      )}
    </div>
  );
}

// ── Profile Card ──────────────────────────────────────────────
function ProfileCard({ th, profile, user, copied, onCopy, onNameChange }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(profile?.displayName || "");
  const [saving, setSaving]   = useState(false);

  async function saveName() {
    if (!name.trim()) return;
    setSaving(true);
    await updateDisplayName(name.trim());
    onNameChange(name.trim());
    setSaving(false); setEditing(false);
  }

  return (
    <div style={{ background: th.surface, border: `1px solid ${th.border}`,
      borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: th.textMid,
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>👤 My Profile</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: th.accentGrad,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {user?.photoURL
            ? <img src={user.photoURL} style={{ width: 44, height: 44, borderRadius: "50%" }} alt="" />
            : "🍄"}
        </div>
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveName()}
                style={{ flex: 1, background: th.surfaceAlt, border: `1.5px solid ${th.accent}`,
                  borderRadius: 8, color: th.text, padding: "6px 10px",
                  fontSize: 14, fontFamily: "inherit", colorScheme: "dark" }} />
              <button onClick={saveName} disabled={saving} style={{
                background: th.accentGrad, border: "none", borderRadius: 8,
                color: "#fff", padding: "6px 12px", fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                {saving ? "…" : "Save"}</button>
              <button onClick={() => { setEditing(false); setName(profile?.displayName || ""); }}
                style={{ background: th.surfaceAlt, border: `1px solid ${th.border}`,
                  borderRadius: 8, color: th.textMid, padding: "6px 10px",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: th.text }}>
                {profile?.displayName || "Trainer"}</span>
              <button onClick={() => { setEditing(true); setName(profile?.displayName || ""); }}
                style={{ background: "transparent", border: "none", color: th.textFaint,
                  cursor: "pointer", fontSize: 13 }}>✏️</button>
            </div>
          )}
          <div style={{ fontSize: 12, color: th.textFaint }}>{user?.email}</div>
        </div>
      </div>

      <div style={{ background: th.surfaceAlt, border: `1px solid ${th.border}`,
        borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ fontSize: 11, color: th.textMid, fontWeight: 700, marginBottom: 8 }}>
          🔑 Your Friend Code — share this so others can add you
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: th.accent,
            letterSpacing: 4, fontFamily: "monospace", flex: 1 }}>
            {profile?.friendCode || "------"}
          </span>
          <button onClick={onCopy} style={{
            background: copied ? "#22543d" : th.accentGrad, border: "none",
            borderRadius: 10, color: "#fff", padding: "8px 16px",
            fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.2s" }}>
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Friends Tab ───────────────────────────────────────────────
function FriendsTab({ th, friends, sentRequests, profile, onRemove, onCancelSent }) {
  const [code, setCode]         = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound]       = useState(null);
  const [error, setError]       = useState("");
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);

  const pendingSent  = sentRequests.filter(r => r.status === "pending");
  const declinedSent = sentRequests.filter(r => r.status === "declined");

  async function search() {
    if (code.trim().length !== 6) { setError("Friend codes are exactly 6 characters."); return; }
    if (code.trim().toUpperCase() === profile?.friendCode) { setError("That's your own code!"); return; }
    setSearching(true); setError(""); setFound(null); setSent(false);
    try {
      const result = await findByFriendCode(code.trim());
      if (!result) setError("No player found with that code. Make sure they've signed in at least once.");
      else if (friends.some(f => f.uid === result.uid)) setError("Already your friend!");
      else if (pendingSent.some(r => r.toUid === result.uid)) setError("Friend request already sent!");
      else setFound(result);
    } catch { setError("Search failed — check your connection."); }
    setSearching(false);
  }

  async function sendReq() {
    if (!found) return;
    setSending(true); setError("");
    try {
      await sendFriendRequest(found.uid, found);
      setSending(false); setSent(true); setFound(null); setCode("");
    } catch (e) {
      console.error("send failed", e);
      setError(e.message || "Failed to send request. Try again.");
      setSending(false);
    }
  }

  return (
    <div>
      {/* Search */}
      <div style={{ background: th.surface, border: `1px solid ${th.border}`,
        borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: th.textMid,
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>
          ➕ Add Friend
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); setFound(null); setSent(false); }}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="Enter code (e.g. ABC123)"
            maxLength={6}
            style={{ flex: 1, background: th.surfaceAlt, border: `1.5px solid ${th.border}`,
              borderRadius: 12, color: th.text, padding: "10px 14px",
              fontSize: 16, fontFamily: "monospace", colorScheme: "dark",
              letterSpacing: 3, textTransform: "uppercase" }} />
          <button onClick={search} disabled={searching || code.length < 6} style={{
            background: th.accentGrad, border: "none", borderRadius: 12,
            color: "#fff", padding: "10px 16px", fontWeight: 800,
            cursor: code.length < 6 ? "not-allowed" : "pointer",
            fontFamily: "inherit", fontSize: 14,
            opacity: code.length < 6 ? 0.5 : 1 }}>
            {searching ? "…" : "Find"}
          </button>
        </div>

        {sent && (
          <div style={{ fontSize: 13, color: th.positive, background: `${th.positive}18`,
            borderRadius: 8, padding: "8px 12px" }}>
            ✅ Friend request sent! They'll see it in their Notifications tab.
          </div>
        )}
        {error && (
          <div style={{ fontSize: 12, color: th.warning, background: `${th.warning}18`,
            borderRadius: 8, padding: "8px 12px" }}>{error}</div>
        )}
        {found && (
          <div style={{ background: th.surfaceAlt, border: `1px solid ${th.accent}44`,
            borderRadius: 12, padding: "12px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, color: th.text }}>{found.displayName}</div>
              <div style={{ fontSize: 11, color: th.textFaint }}>Code: {found.friendCode}</div>
            </div>
            <button onClick={sendReq} disabled={sending} style={{
              background: th.accentGrad, border: "none", borderRadius: 10,
              color: "#fff", padding: "8px 16px", fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              {sending ? "Sending…" : "Send Request"}
            </button>
          </div>
        )}
      </div>

      {/* Sent requests */}
      {pendingSent.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel th={th} label="📤 Sent Requests" count={pendingSent.length} />
          {pendingSent.map(r => (
            <div key={r.toUid} style={{ background: th.surface,
              border: `1px solid ${th.border}`, borderRadius: 14,
              padding: "12px 14px", marginBottom: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: th.text }}>{r.toName}</div>
                <div style={{ fontSize: 11, color: th.textFaint }}>{r.toCode} · Pending</div>
              </div>
              <button onClick={() => onCancelSent(r.toUid)} style={{
                background: "transparent", border: `1px solid ${th.border}`,
                borderRadius: 8, color: th.textFaint, padding: "5px 10px",
                cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>✕ Cancel</button>
            </div>
          ))}
        </div>
      )}

      {/* Declined sent requests */}
      {declinedSent.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel th={th} label="❌ Declined Requests" count={declinedSent.length} />
          {declinedSent.map(r => (
            <div key={r.toUid} style={{ background: th.surface,
              border: `1px solid ${th.warning}44`, borderRadius: 14,
              padding: "12px 14px", marginBottom: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: th.text }}>{r.toName}</div>
                <div style={{ fontSize: 11, color: th.warning }}>{r.toCode} · Declined</div>
              </div>
              <div style={{ fontSize: 11, color: th.textFaint, fontStyle: "italic" }}>
                They declined your request
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friend list */}
      {friends.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: th.textFaint }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
          <div>No friends yet!</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Search for their code above.</div>
        </div>
      ) : friends.map(f => (
        <div key={f.uid} style={{ background: th.surface, border: `1px solid ${th.border}`,
          borderRadius: 14, padding: "12px 14px", marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: th.accentGrad,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🍄</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: th.text }}>{f.displayName}</div>
              <div style={{ fontSize: 11, color: th.textFaint, fontFamily: "monospace", letterSpacing: 1 }}>
                {f.friendCode}</div>
            </div>
          </div>
          <button onClick={() => onRemove(f.uid)} style={{
            background: "transparent", border: `1px solid ${th.border}`,
            borderRadius: 8, color: th.textFaint, padding: "5px 10px",
            cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────
function NotificationsTab({ th, friendRequests, mushroomInvites,
  onAcceptFriend, onDeclineFriend, onAcceptInvite, onDeclineInvite }) {

  const total = friendRequests.length + mushroomInvites.length;

  if (total === 0) return (
    <div style={{ textAlign: "center", padding: "50px 20px", color: th.textFaint }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🔔</div>
      <div>No pending notifications.</div>
    </div>
  );

  return (
    <div>
      {friendRequests.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: th.textMid, marginBottom: 10,
            letterSpacing: 1.2, textTransform: "uppercase" }}>
            👥 Friend Requests ({friendRequests.length})
          </div>
          {friendRequests.map(req => (
            <div key={req.fromUid} style={{ background: th.surface,
              border: `1px solid ${th.accent}44`, borderRadius: 14,
              padding: "14px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: th.accentGrad,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍄</div>
                <div>
                  <div style={{ fontWeight: 800, color: th.text }}>{req.fromName}</div>
                  <div style={{ fontSize: 11, color: th.textFaint }}>Code: {req.fromCode}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onAcceptFriend(req)} style={{
                  flex: 1, background: th.accentGrad, border: "none", borderRadius: 10,
                  color: "#fff", padding: "9px", fontWeight: 800,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                  ✓ Accept
                </button>
                <button onClick={() => onDeclineFriend(req)} style={{
                  flex: 1, background: th.surfaceAlt, border: `1px solid ${th.border}`,
                  borderRadius: 10, color: th.textMid, padding: "9px",
                  fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                  ✕ Decline
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {mushroomInvites.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: th.textMid,
            margin: "14px 0 10px", letterSpacing: 1.2, textTransform: "uppercase" }}>
            🍄 Mushroom Invitations ({mushroomInvites.length})
          </div>
          {mushroomInvites.map(inv => {
            const t = MUSHROOM_TYPES.find(x => x.id === inv.mushroomType);
            const invEndTime = inv.endTime ? (typeof inv.endTime.toDate === 'function' ? inv.endTime.toDate().getTime() : typeof inv.endTime === 'number' ? inv.endTime : null) : null;
            const ms = invEndTime ? invEndTime - Date.now() : null;
            return (
              <div key={inv.mushroomId} style={{ background: th.surface,
                border: `1px solid ${t ? `${t.color}55` : th.border}`,
                borderRadius: 14, padding: "14px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{t?.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 800, color: th.text }}>
                      {t?.label} · {SIZE_EMOJI[inv.size]} {inv.size}
                    </div>
                    <div style={{ fontSize: 12, color: th.textMid }}>
                      From {inv.fromName}
                    </div>
                  </div>
                  {invEndTime && (
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: th.textFaint }}>Ends in</div>
                      <div style={{ fontSize: 13, fontWeight: 800,
                        color: ms && ms < 3600000 ? th.warning : th.accent }}>
                        {ms && ms > 0 ? formatDuration(ms) : "Ended"}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onAcceptInvite(inv)} style={{
                    flex: 1, background: th.accentGrad, border: "none", borderRadius: 10,
                    color: "#fff", padding: "9px", fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                    ✓ Join
                  </button>
                  <button onClick={() => onDeclineInvite(inv)} style={{
                    flex: 1, background: th.surfaceAlt, border: `1px solid ${th.border}`,
                    borderRadius: 10, color: th.textMid, padding: "9px",
                    fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                    ✕ Decline
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── Section Label ─────────────────────────────────────────────
function SectionLabel({ th, label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: th.textMid }}>{label}</span>
      <span style={{ background: th.tabActive, color: th.textMid, borderRadius: 99,
        fontSize: 10, fontWeight: 900, padding: "1px 8px" }}>{count}</span>
      <div style={{ flex: 1, height: 1, background: th.borderFaint }} />
    </div>
  );
}
