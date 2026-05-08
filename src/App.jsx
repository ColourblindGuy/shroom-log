// ============================================================
// Shroom Log — Pikmin Bloom Tracker
// React + Vite | Cloud storage via artifact storage API
//
// FIREBASE MIGRATION NOTES (when ready):
//   1. npm install firebase
//   2. Create firebase.js with your config
//   3. Replace cloudLoad/cloudSave with Firestore calls
//   4. Add Firebase Auth for multi-user support
//   5. See FIREBASE TODO comments throughout this file
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// DATA: Mushroom Type System
// To add a new type: just append to MUSHROOM_TYPES array.
// Fields: id, label, emoji, color, glow, textColor, category,
//         pikmin (recommended pikmin), description
// ─────────────────────────────────────────────────────────────
export const MUSHROOM_TYPES = [
  // ── Regular color mushrooms ──
  { id:"red",       label:"Red",          emoji:"🔴", color:"#e05252", glow:"#e0525255", textColor:"#fff", category:"regular",  pikmin:"Any",       desc:"Standard red mushroom" },
  { id:"yellow",    label:"Yellow",       emoji:"🟡", color:"#f5c518", glow:"#f5c51855", textColor:"#433", category:"regular",  pikmin:"Any",       desc:"Standard yellow mushroom" },
  { id:"blue",      label:"Blue",         emoji:"🔵", color:"#4a90d9", glow:"#4a90d955", textColor:"#fff", category:"regular",  pikmin:"Any",       desc:"Standard blue mushroom" },
  { id:"purple",    label:"Purple",       emoji:"🟣", color:"#9b72cf", glow:"#9b72cf55", textColor:"#fff", category:"regular",  pikmin:"Any",       desc:"Standard purple mushroom" },
  { id:"white",     label:"White",        emoji:"⚪", color:"#d1ccc4", glow:"#d1ccc455", textColor:"#444", category:"regular",  pikmin:"Any",       desc:"Standard white mushroom" },
  { id:"pink",      label:"Pink",         emoji:"🩷", color:"#f080b4", glow:"#f080b455", textColor:"#fff", category:"regular",  pikmin:"Any",       desc:"Standard pink mushroom" },
  { id:"grey",      label:"Grey",         emoji:"🩶", color:"#94a3b8", glow:"#94a3b855", textColor:"#fff", category:"regular",  pikmin:"Any",       desc:"Standard grey mushroom" },
  { id:"teal",      label:"Teal",         emoji:"🩵", color:"#2dd4bf", glow:"#2dd4bf55", textColor:"#fff", category:"regular",  pikmin:"Any",       desc:"Standard teal mushroom" },
  // ── Special / Elemental mushrooms ──
  { id:"fire",      label:"Fire",         emoji:"🔥", color:"#ff6b35", glow:"#ff6b3555", textColor:"#fff", category:"elemental",pikmin:"Red only",  desc:"Bring Red Pikmin for bonus damage" },
  { id:"water",     label:"Water",        emoji:"💧", color:"#38bdf8", glow:"#38bdf855", textColor:"#fff", category:"elemental",pikmin:"Blue only", desc:"Bring Blue Pikmin for bonus damage" },
  { id:"electric",  label:"Electric",     emoji:"⚡", color:"#facc15", glow:"#facc1555", textColor:"#333", category:"elemental",pikmin:"Yellow",    desc:"Bring Yellow Pikmin for bonus damage" },
  { id:"poison",    label:"Poison",       emoji:"☠️", color:"#c084fc", glow:"#c084fc55", textColor:"#fff", category:"elemental",pikmin:"White only",desc:"Bring White Pikmin for bonus damage" },
  { id:"crystal",   label:"Crystal",      emoji:"💎", color:"#818cf8", glow:"#818cf855", textColor:"#fff", category:"elemental",pikmin:"Rock only", desc:"Bring Rock Pikmin for bonus damage" },
  // ── Special event / variant mushrooms ──
  { id:"brilliant", label:"Brilliant",    emoji:"✨", color:"#fde68a", glow:"#fde68a55", textColor:"#555", category:"event",    pikmin:"Any",       desc:"Rare brilliant mushroom — higher rewards" },
  { id:"giant",     label:"Giant",        emoji:"🍄", color:"#86efac", glow:"#86efac55", textColor:"#333", category:"event",    pikmin:"Any",       desc:"Oversized mushroom needing group effort" },
  { id:"event",     label:"Event",        emoji:"🎉", color:"#fb923c", glow:"#fb923c55", textColor:"#fff", category:"event",    pikmin:"Any",       desc:"Limited-time event mushroom" },
];

// Size presets (approximate — user can override with exact workload)
export const SIZES = ["Small","Normal","Large","Giant"];
export const SIZE_HP_APPROX = { Small:265000, Normal:531000, Large:2650000, Giant:9200000 };
export const SIZE_EMOJI = { Small:"🍄", Normal:"🍄🍄", Large:"🍄🍄🍄", Giant:"🍄🍄🍄🍄" };
export const STAR_RATINGS = ["⭐","⭐⭐","⭐⭐⭐","⭐⭐⭐⭐"];

const STORAGE_KEY = "pikmin_shroom_v3";
const ANNOUNCE_KEY = "pikmin_announcements";

// ─────────────────────────────────────────────────────────────
// MATH — FIXED
// Formula: duration (seconds) = (workload / strength) * 100
// Key fix: use the ACTUAL workload number from in-game,
// not a hardcoded HP value. HP varies per mushroom instance.
// ─────────────────────────────────────────────────────────────
export function calcDurationMs(workload, strength) {
  if (!workload || !strength || strength <= 0 || workload <= 0) return null;
  return ((workload / strength) * 100) * 1000; // milliseconds
}

export function formatDuration(ms) {
  if (ms <= 0) return "Done!";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export function toDiscordTimestamp(date, style = "F") {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

export function formatDate(date) {
  return date.toLocaleString(undefined, {
    weekday:"short", month:"short", day:"numeric",
    hour:"2-digit", minute:"2-digit",
  });
}

function localNow() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
}

// ─────────────────────────────────────────────────────────────
// CLOUD STORAGE
// Currently uses artifact storage API.
// FIREBASE TODO: Replace these two functions with Firestore:
//
//   import { db } from "./firebase";
//   import { collection, getDocs, addDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
//
//   async function cloudLoad(userId) {
//     const snap = await getDocs(collection(db, "users", userId, "logs"));
//     return snap.docs.map(d => ({ id: d.id, ...d.data() }));
//   }
//   async function cloudSave(data, userId) {
//     // use batch writes for efficiency
//   }
// ─────────────────────────────────────────────────────────────
async function cloudLoad() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}
async function cloudSave(data) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.warn("Cloud save failed", e); }
}
async function loadAnnouncements() {
  try {
    const r = await window.storage.get(ANNOUNCE_KEY, true); // shared=true
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS helpers
// ─────────────────────────────────────────────────────────────
function buildAnalytics(log) {
  const total = log.length;
  const byType = {};
  const byWeek = {};
  const byMonth = {};
  let streak = 0;
  let longestStreak = 0;
  let lastDate = null;

  const sorted = [...log].sort((a, b) => a.registeredAt - b.registeredAt);

  sorted.forEach(entry => {
    // by type
    byType[entry.mushroomType] = (byType[entry.mushroomType] || 0) + 1;

    // by week
    const d = new Date(entry.registeredAt);
    const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
    byWeek[weekKey] = (byWeek[weekKey] || 0) + 1;

    // by month
    const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;

    // streak
    const dateStr = d.toDateString();
    if (lastDate === null) {
      streak = 1;
    } else {
      const prev = new Date(lastDate);
      const diff = (d - prev) / 86400000;
      if (diff < 1.5) streak++;
      else { longestStreak = Math.max(longestStreak, streak); streak = 1; }
    }
    lastDate = dateStr;
    longestStreak = Math.max(longestStreak, streak);
  });

  const topType = Object.entries(byType).sort((a,b)=>b[1]-a[1])[0];
  const recentWeeks = Object.entries(byWeek).slice(-8);
  const recentMonths = Object.entries(byMonth).slice(-6);

  return { total, byType, byWeek, byMonth, streak, longestStreak, topType, recentWeeks, recentMonths };
}

function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

// ─────────────────────────────────────────────────────────────
// LOGO COMPONENT — Original Pikmin-inspired character
// Fully original SVG, no Nintendo assets used.
// ─────────────────────────────────────────────────────────────
function PikminLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 0 8px #fde68a88)", flexShrink: 0 }}>
      {/* Stem */}
      <line x1="40" y1="18" x2="40" y2="10" stroke="#86efac" strokeWidth="3" strokeLinecap="round"/>
      {/* Leaf on stem */}
      <ellipse cx="46" cy="10" rx="6" ry="3" fill="#4ade80" transform="rotate(-20 46 10)"/>
      {/* Head */}
      <ellipse cx="40" cy="30" rx="14" ry="15" fill="#fde68a"/>
      {/* Highlight on head */}
      <ellipse cx="35" cy="24" rx="4" ry="3" fill="#fff8" />
      {/* Eyes */}
      <circle cx="35" cy="29" r="4" fill="#1a1a2e"/>
      <circle cx="45" cy="29" r="4" fill="#1a1a2e"/>
      <circle cx="36.2" cy="27.8" r="1.5" fill="white"/>
      <circle cx="46.2" cy="27.8" r="1.5" fill="white"/>
      {/* Smile */}
      <path d="M35 35 Q40 39 45 35" stroke="#a16207" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* Body */}
      <ellipse cx="40" cy="52" rx="11" ry="13" fill="#fde68a"/>
      {/* Body shading */}
      <ellipse cx="40" cy="58" rx="8" ry="7" fill="#fbbf24" opacity="0.5"/>
      {/* Left arm */}
      <ellipse cx="27" cy="50" rx="5" ry="3" fill="#fde68a" transform="rotate(-30 27 50)"/>
      {/* Right arm */}
      <ellipse cx="53" cy="50" rx="5" ry="3" fill="#fde68a" transform="rotate(30 53 50)"/>
      {/* Left foot */}
      <ellipse cx="34" cy="64" rx="5" ry="3" fill="#fbbf24"/>
      {/* Right foot */}
      <ellipse cx="46" cy="64" rx="5" ry="3" fill="#fbbf24"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────────────────────
function Section({ label, icon, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize:11, fontWeight:800, letterSpacing:1.5, color:"#7c6faa",
        textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
        <span>{icon}</span>{label}
      </div>
      {children}
    </div>
  );
}

function CopyBtn({ text, label="Copy" }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => navigator.clipboard.writeText(text).then(() => {
      setOk(true); setTimeout(() => setOk(false), 1500);
    })} style={{
      background: ok ? "#22543d" : "#1a1030",
      border: `1px solid ${ok ? "#48bb78" : "#3d2f70"}`,
      color: ok ? "#68d391" : "#a78bfa",
      borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700,
      cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s", whiteSpace:"nowrap",
    }}>{ok ? "✓ Copied!" : label}</button>
  );
}

function Countdown({ endTime }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = endTime - now;
  return (
    <span style={{ color: ms<=0?"#68d391":ms<600000?"#fc8181":"#a78bfa",
      fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
      {ms<=0 ? "✅ Done!" : formatDuration(ms)}
    </span>
  );
}

function MiniBar({ value, max, color }) {
  return (
    <div style={{ background:"#1a1030", borderRadius:99, height:6, overflow:"hidden", flex:1 }}>
      <div style={{ width:`${Math.min(100,(value/max)*100)}%`, height:"100%",
        background: color, borderRadius:99, transition:"width 0.4s ease" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FORM — blank state
// ─────────────────────────────────────────────────────────────
const BLANK_FORM = {
  mushroomType:"", size:"", stars:"", players:1,
  workload:"", strength:"", notes:"", startTime:"",
};

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [log, setLog]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState("register"); // register | history | analytics
  const [form, setForm]         = useState(BLANK_FORM);
  const [editId, setEditId]     = useState(null);
  const [saved, setSaved]       = useState(false);
  const [search, setSearch]     = useState("");
  const [filterType, setFilterType] = useState("all");
  const [notif, setNotif]       = useState(false);
  const [announcements, setAnn] = useState([]);
  const [dismissedAnn, setDismissedAnn] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dismissed_ann") || "[]"); } catch { return []; }
  });
  const scheduledRefs = useRef({});

  // Load
  useEffect(() => {
    cloudLoad().then(data => { setLog(data); setLoading(false); });
    loadAnnouncements().then(setAnn);
    if ("Notification" in window && Notification.permission === "granted") setNotif(true);
  }, []);

  // Save on log change
  useEffect(() => { if (!loading) cloudSave(log); }, [log, loading]);

  // Schedule notifications for loaded entries
  useEffect(() => {
    log.forEach(e => { if (e.endTime && !scheduledRefs.current[e.id]) scheduleNotif(e); });
  }, [log, notif]);

  function scheduleNotif(entry) {
    if (!notif || !entry.endTime) return;
    const ms = entry.endTime - Date.now() - 5 * 60 * 1000;
    if (ms > 0) {
      const t = setTimeout(() => {
        const mt = MUSHROOM_TYPES.find(x => x.id === entry.mushroomType);
        new Notification("🍄 Mushroom ending soon!", {
          body: `Your ${entry.size} ${mt?.label} mushroom ends in 5 minutes!`,
        });
      }, ms);
      scheduledRefs.current[entry.id] = t;
    }
  }

  async function requestNotif() {
    if (!("Notification" in window)) return alert("Not supported in this browser.");
    const p = await Notification.requestPermission();
    if (p === "granted") setNotif(true);
  }

  // ── Derived form values ──
  const selectedType = MUSHROOM_TYPES.find(t => t.id === form.mushroomType);
  const workloadNum  = parseFloat(form.workload);
  const strengthNum  = parseFloat(form.strength);
  const startMs      = form.startTime ? new Date(form.startTime).getTime() : Date.now();
  const durationMs   = calcDurationMs(workloadNum, strengthNum);
  const endTime      = durationMs ? new Date(startMs + durationMs) : null;

  // ── Submit / Save edit ──
  function submit() {
    if (!form.mushroomType || !form.size || !form.stars) return;
    const entry = {
      ...form,
      id: editId || Date.now(),
      endTime: endTime ? endTime.getTime() : null,
      registeredAt: editId ? (log.find(e=>e.id===editId)?.registeredAt || Date.now()) : Date.now(),
      date: new Date().toLocaleDateString("en-US",{ month:"short",day:"numeric",hour:"2-digit",minute:"2-digit" }),
    };
    if (editId) {
      setLog(prev => prev.map(e => e.id === editId ? entry : e));
    } else {
      setLog(prev => [entry, ...prev]);
      scheduleNotif(entry);
    }
    setEditId(null);
    setForm(BLANK_FORM);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    setView("history");
  }

  function startEdit(entry) {
    setForm({
      mushroomType: entry.mushroomType || "",
      size:         entry.size || "",
      stars:        entry.stars || "",
      players:      entry.players || 1,
      workload:     entry.workload || "",
      strength:     entry.strength || "",
      notes:        entry.notes || "",
      startTime:    entry.startTime || "",
    });
    setEditId(entry.id);
    setView("register");
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(BLANK_FORM);
  }

  function deleteEntry(id) {
    if (scheduledRefs.current[id]) { clearTimeout(scheduledRefs.current[id]); delete scheduledRefs.current[id]; }
    setLog(prev => prev.filter(e => e.id !== id));
  }

  function dismissAnn(id) {
    const next = [...dismissedAnn, id];
    setDismissedAnn(next);
    localStorage.setItem("dismissed_ann", JSON.stringify(next));
  }

  // ── Filter log ──
  const filteredLog = log.filter(e => {
    const matchType = filterType === "all" || e.mushroomType === filterType;
    const matchSearch = !search || (e.notes||"").toLowerCase().includes(search.toLowerCase())
      || (MUSHROOM_TYPES.find(t=>t.id===e.mushroomType)?.label||"").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const analytics = buildAnalytics(log);
  const activeAnn = announcements.filter(a => !dismissedAnn.includes(a.id));

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      <style>{css}</style>
      <div style={S.blob1}/><div style={S.blob2}/><div style={S.blob3}/>

      {/* ── Announcement banner ── */}
      {activeAnn.map(a => (
        <div key={a.id} style={S.annBanner}>
          <span style={{ flex:1 }}>📣 <strong>{a.title}</strong> — {a.body}</span>
          <button onClick={() => dismissAnn(a.id)} style={S.annClose}>✕</button>
        </div>
      ))}

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.headerTop}>
          <div style={S.logoWrap}>
            <PikminLogo size={44} />
            <div>
              <div style={S.appTitle}>Shroom Log</div>
              <div style={S.appSub}>Pikmin Bloom Tracker</div>
            </div>
          </div>
          <div style={S.headerRight}>
            {!notif && (
              <button onClick={requestNotif} style={S.iconBtn} title="Enable notifications">🔔</button>
            )}
          </div>
        </div>

        {/* ── Bottom nav ── */}
        <nav style={S.tabs}>
          {[
            { key:"register", label:"✏️", full:"Register" },
            { key:"history",  label:"📋", full:`History` },
            { key:"analytics",label:"📊", full:"Analytics" },
          ].map(t => (
            <button key={t.key} onClick={() => { setView(t.key); if(editId && t.key!=="register") cancelEdit(); }}
              style={{ ...S.tab, ...(view===t.key ? S.tabActive : {}) }}>
              <span className="nav-emoji">{t.label}</span>
              <span className="nav-label">{t.full}</span>
              {t.key==="history" && log.length > 0 && (
                <span style={S.navBadge}>{log.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main style={S.main}>
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#4a3d6a" }}>
            <PikminLogo size={60} /><br/><br/>Loading cloud data…
          </div>
        ) : view === "register" ? (
          <RegisterView
            form={form} setForm={setForm} editId={editId} cancelEdit={cancelEdit}
            selectedType={selectedType} endTime={endTime} durationMs={durationMs}
            startMs={startMs} submit={submit} saved={saved} notif={notif}
          />
        ) : view === "history" ? (
          <HistoryView
            log={filteredLog} allLog={log} search={search} setSearch={setSearch}
            filterType={filterType} setFilterType={setFilterType}
            onEdit={startEdit} onDelete={deleteEntry}
          />
        ) : (
          <AnalyticsView analytics={analytics} log={log} />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REGISTER VIEW
// ─────────────────────────────────────────────────────────────
function RegisterView({ form, setForm, editId, cancelEdit, selectedType, endTime, durationMs, startMs, submit, saved, notif }) {
  const f = form;
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Group types by category
  const categories = [
    { key:"regular",   label:"Regular",   icon:"🍄" },
    { key:"elemental", label:"Elemental", icon:"⚡" },
    { key:"event",     label:"Event",     icon:"✨" },
  ];

  return (
    <div className="fade-in" style={{ paddingBottom: 16 }}>
      {editId && (
        <div style={S.editBanner}>
          ✏️ Editing entry — <button onClick={cancelEdit} style={S.editCancel}>Cancel</button>
        </div>
      )}

      {/* Mushroom Type */}
      <Section label="Mushroom Type" icon="🍄">
        {categories.map(cat => {
          const types = MUSHROOM_TYPES.filter(t => t.category === cat.key);
          return (
            <div key={cat.key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize:11, color:"#4a3d6a", fontWeight:700, marginBottom:6 }}>
                {cat.icon} {cat.label}
              </div>
              <div style={S.typeGrid}>
                {types.map(t => {
                  const active = f.mushroomType === t.id;
                  return (
                    <button key={t.id} onClick={() => set("mushroomType", t.id)} title={t.desc} style={{
                      ...S.typeBtn,
                      background: active ? t.color : `${t.color}22`,
                      color: active ? t.textColor : t.color,
                      boxShadow: active ? `0 0 16px ${t.glow}` : "none",
                      transform: active ? "scale(1.06)" : "scale(1)",
                      border: `2px solid ${active ? t.color : `${t.color}44`}`,
                    }}>
                      <span style={{ fontSize:16 }}>{t.emoji}</span>
                      <span style={{ fontSize:11, fontWeight:800, marginTop:2 }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {selectedType && (
          <div style={S.hint}>
            🌿 Best Pikmin: <strong style={{ color:"#c4b5fd" }}>{selectedType.pikmin}</strong>
            <span style={{ color:"#4a3d6a", marginLeft:6, fontSize:11 }}>· {selectedType.desc}</span>
          </div>
        )}
      </Section>

      {/* Size */}
      <Section label="Mushroom Size" icon="📏">
        <div style={S.sizeGrid}>
          {SIZES.map(s => {
            const active = f.size === s;
            return (
              <button key={s} onClick={() => {
                set("size", s);
                // Auto-fill workload with approx HP if user hasn't entered one yet
                if (!f.workload) setForm(prev => ({ ...prev, size:s, workload: String(SIZE_HP_APPROX[s]) }));
              }} style={{
                ...S.sizeBtn,
                border:`2px solid ${active?"#a78bfa":"#2d2050"}`,
                background: active?"#2d1f5e":"#160f30",
                boxShadow: active?"0 0 14px #a78bfa44":"none",
              }}>
                <div style={{ fontSize:18 }}>{SIZE_EMOJI[s]}</div>
                <div style={{ fontWeight:800, fontSize:12, color:active?"#c4b5fd":"#6b5fa0" }}>{s}</div>
                <div style={{ fontSize:10, color:"#4a3d6a", marginTop:2 }}>~{(SIZE_HP_APPROX[s]/1000).toFixed(0)}K</div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize:11, color:"#4a3d6a", marginTop:8 }}>
          Tapping a size pre-fills the workload below — replace it with the exact number from your game!
        </div>
      </Section>

      {/* Workload + Strength + Start time */}
      <Section label="Battle Details" icon="⚔️">
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <input type="number" value={f.workload}
              onChange={e => set("workload", e.target.value)}
              placeholder="Workload (e.g. 531000)"
              style={S.input} />
            <div style={S.inputHint}>Exact HP shown in-game</div>
          </div>
          <div style={{ flex:1 }}>
            <input type="number" value={f.strength}
              onChange={e => set("strength", e.target.value)}
              placeholder="Everyone's Strength"
              style={S.input} />
            <div style={S.inputHint}>Total strength in-game</div>
          </div>
        </div>
        <div>
          <input type="datetime-local"
            value={f.startTime || localNow()}
            onChange={e => set("startTime", e.target.value)}
            style={S.input} />
          <div style={S.inputHint}>Battle start time (defaults to now)</div>
        </div>

        {endTime && (
          <div style={S.endCard}>
            <div style={S.endRow}>
              <span style={{ color:"#7c6faa", fontSize:13 }}>⏱ Duration</span>
              <strong style={{ color:"#c4b5fd" }}>{formatDuration(durationMs)}</strong>
            </div>
            <div style={S.endRow}>
              <span style={{ color:"#7c6faa", fontSize:13 }}>📅 Ends at</span>
              <span style={{ color:"#e9d5ff", fontWeight:700, fontSize:13 }}>{formatDate(endTime)}</span>
            </div>
            <div style={{ borderTop:"1px solid #2d2050", marginTop:8, paddingTop:10 }}>
              <div style={{ fontSize:12, color:"#7c6faa", marginBottom:6 }}>
                🎮 Discord timestamp
                <span style={{ color:"#4a3d6a", marginLeft:6, fontSize:11 }}>
                  (auto-converts to everyone's timezone)
                </span>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <code style={{ fontSize:11, color:"#a78bfa", background:"#0d0820",
                  padding:"5px 10px", borderRadius:8, border:"1px solid #2d2050", flex:1,
                  wordBreak:"break-all" }}>
                  {toDiscordTimestamp(endTime)}
                </code>
                <CopyBtn text={toDiscordTimestamp(endTime)} label="📋 Copy" />
              </div>
              {/* Relative time variant */}
              <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:11, color:"#4a3d6a" }}>Relative (e.g. "in 3 hours"):</span>
                <code style={{ fontSize:11, color:"#7c6faa", background:"#0d0820",
                  padding:"3px 8px", borderRadius:6, border:"1px solid #2d2050" }}>
                  {toDiscordTimestamp(endTime, "R")}
                </code>
                <CopyBtn text={toDiscordTimestamp(endTime, "R")} label="Copy" />
              </div>
            </div>
            {notif
              ? <div style={{ fontSize:11, color:"#68d391", marginTop:8 }}>🔔 Notification set for 5 min before end</div>
              : <div style={{ fontSize:11, color:"#7c6faa", marginTop:8 }}>🔕 Tap 🔔 in the header to get a 5-min reminder</div>
            }
          </div>
        )}
      </Section>

      {/* Stars */}
      <Section label="Star Rating" icon="⭐">
        <div style={{ display:"flex", gap:8 }}>
          {STAR_RATINGS.map(s => {
            const active = f.stars === s;
            return (
              <button key={s} onClick={() => set("stars", s)} style={{
                flex:1, padding:"10px 2px", borderRadius:12, fontFamily:"inherit",
                border:`2px solid ${active?"#f5c518":"#2d2050"}`,
                background: active?"#2d2000":"#160f30",
                color:"#f5c518", fontSize:13, fontWeight:700, cursor:"pointer",
                boxShadow: active?"0 0 12px #f5c51855":"none", transition:"all 0.15s",
              }}>{s}</button>
            );
          })}
        </div>
      </Section>

      {/* Players */}
      <Section label="Players" icon="👥">
        <div style={{ display:"flex", gap:8 }}>
          {[1,2,3,4,5].map(n => {
            const active = f.players === n;
            return (
              <button key={n} onClick={() => set("players", n)} style={{
                flex:1, padding:"10px 2px", borderRadius:12, fontFamily:"inherit",
                border:`2px solid ${active?"#38bdf8":"#2d2050"}`,
                background: active?"#0c2436":"#160f30",
                color: active?"#7dd3fc":"#4a3d6a",
                fontSize:17, fontWeight:700, cursor:"pointer",
                boxShadow: active?"0 0 12px #38bdf855":"none", transition:"all 0.15s",
              }}>{n}</button>
            );
          })}
        </div>
      </Section>

      {/* Notes */}
      <Section label="Notes" icon="📝">
        <textarea value={f.notes}
          onChange={e => set("notes", e.target.value)}
          placeholder="Location, squad tips, friends…"
          style={{ ...S.input, resize:"none", minHeight:56 }} rows={2}/>
      </Section>

      <button onClick={submit} disabled={!f.mushroomType || !f.size || !f.stars} style={{
        ...S.submitBtn, opacity:(!f.mushroomType||!f.size||!f.stars) ? 0.4 : 1,
      }}>
        {saved ? "✅ Saved!" : editId ? "💾 Save Changes" : "Register Mushroom 🍄"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HISTORY VIEW
// ─────────────────────────────────────────────────────────────
function HistoryView({ log, allLog, search, setSearch, filterType, setFilterType, onEdit, onDelete }) {
  return (
    <div className="fade-in">
      {/* Search + filter */}
      <div style={{ marginBottom:14, display:"flex", gap:8, flexWrap:"wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search notes or type…"
          style={{ ...S.input, flex:1, minWidth:0 }} />
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        <FilterPill value="all" current={filterType} onChange={setFilterType} label="All" />
        {MUSHROOM_TYPES.filter(t => allLog.some(e => e.mushroomType === t.id)).map(t => (
          <FilterPill key={t.id} value={t.id} current={filterType} onChange={setFilterType}
            label={`${t.emoji} ${t.label}`} color={t.color} />
        ))}
      </div>

      {log.length === 0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"#4a3d6a" }}>
          <PikminLogo size={56} /><br/><br/>
          {search || filterType!=="all" ? "No matching entries." : "No mushrooms yet! Register your first one."}
        </div>
      ) : log.map((entry, i) => (
        <LogCard key={entry.id} entry={entry} index={i} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function FilterPill({ value, current, onChange, label, color }) {
  const active = current === value;
  return (
    <button onClick={() => onChange(value)} style={{
      padding:"5px 12px", borderRadius:99, fontSize:12, fontWeight:700,
      cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
      background: active ? (color ? `${color}33` : "#2d1f5e") : "#160f30",
      border: `1.5px solid ${active ? (color||"#a78bfa") : "#2d2050"}`,
      color: active ? (color||"#c4b5fd") : "#4a3d6a",
    }}>{label}</button>
  );
}

function LogCard({ entry, index, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const t = MUSHROOM_TYPES.find(x => x.id === entry.mushroomType);
  return (
    <div className="fade-in" style={{ ...S.logCard, borderColor: t?`${t.color}55`:"#2d2050",
      animationDelay:`${index*30}ms` }}>
      <div style={{ ...S.logDot, background:t?.color, boxShadow:`0 0 8px ${t?.glow}` }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
          <span style={{ fontWeight:900, fontSize:15, color:"#e9d5ff" }}>{t?.emoji} {t?.label}</span>
          <span style={{ fontSize:12, color:"#7c6faa" }}>{SIZE_EMOJI[entry.size]} {entry.size}</span>
          <span style={{ fontSize:12 }}>{entry.stars}</span>
          <span style={{ fontSize:13, marginLeft:"auto", color:"#4a3d6a" }}>{"👤".repeat(Math.min(entry.players,5))}</span>
        </div>

        {entry.endTime && (
          <div style={S.logEndCard}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <span style={{ fontSize:12, color:"#7c6faa" }}>⏱ Remaining</span>
              <Countdown endTime={entry.endTime} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:expanded?8:0 }}>
              <span style={{ fontSize:12, color:"#7c6faa" }}>📅 {formatDate(new Date(entry.endTime))}</span>
              <button onClick={() => setExpanded(v=>!v)} style={{ background:"transparent", border:"none",
                color:"#4a3d6a", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                {expanded ? "▲ less" : "▼ more"}
              </button>
            </div>
            {expanded && (
              <div style={{ borderTop:"1px solid #2d2050", paddingTop:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <code style={{ fontSize:10, color:"#7c6faa" }}>{toDiscordTimestamp(new Date(entry.endTime))}</code>
                  <CopyBtn text={toDiscordTimestamp(new Date(entry.endTime))} label="📋 Copy" />
                </div>
              </div>
            )}
          </div>
        )}

        {entry.notes && (
          <div style={{ fontSize:12, color:"#9f7aea", fontStyle:"italic", marginTop:6 }}>"{entry.notes}"</div>
        )}
        <div style={{ fontSize:11, color:"#2d2050", marginTop:4 }}>{entry.date}</div>
      </div>

      {/* Action buttons */}
      <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"center" }}>
        <button onClick={() => onEdit(entry)} style={{ ...S.actionBtn, color:"#60a5fa" }} title="Edit">✏️</button>
        <button onClick={() => onDelete(entry.id)} style={{ ...S.actionBtn, color:"#f87171" }} title="Delete">🗑</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS VIEW
// ─────────────────────────────────────────────────────────────
function AnalyticsView({ analytics, log }) {
  const { total, byType, streak, longestStreak, topType, recentWeeks, recentMonths } = analytics;
  const maxWeek = Math.max(...(recentWeeks.map(([,v])=>v)), 1);
  const maxMonth = Math.max(...(recentMonths.map(([,v])=>v)), 1);

  return (
    <div className="fade-in">
      {log.length === 0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"#4a3d6a" }}>
          <PikminLogo size={56}/><br/><br/>Register some mushrooms to see analytics!
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
            {[
              { label:"Total", value:total, icon:"🍄", color:"#a78bfa" },
              { label:"Current Streak", value:`${streak}d`, icon:"🔥", color:"#fb923c" },
              { label:"Best Streak", value:`${longestStreak}d`, icon:"🏆", color:"#fde68a" },
              { label:"Fav Type", value:topType?MUSHROOM_TYPES.find(t=>t.id===topType[0])?.label||topType[0]:"—", icon:"⭐", color:"#68d391" },
            ].map(s => (
              <div key={s.label} style={{ background:"#100826", border:"1px solid #2d2050",
                borderRadius:16, padding:"14px 16px" }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{s.icon}</div>
                <div style={{ fontSize:24, fontWeight:900, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:12, color:"#4a3d6a", fontWeight:700 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Type breakdown */}
          <div style={S.analyticsCard}>
            <div style={S.analyticsTitle}>🍄 Type Breakdown</div>
            {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([typeId, count]) => {
              const t = MUSHROOM_TYPES.find(x=>x.id===typeId);
              return (
                <div key={typeId} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:16, width:24 }}>{t?.emoji}</span>
                  <span style={{ fontSize:13, color:"#c4b5fd", width:70, flexShrink:0 }}>{t?.label||typeId}</span>
                  <MiniBar value={count} max={total} color={t?.color||"#a78bfa"} />
                  <span style={{ fontSize:13, color:"#7c6faa", width:28, textAlign:"right", flexShrink:0 }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Weekly chart */}
          {recentWeeks.length > 0 && (
            <div style={S.analyticsCard}>
              <div style={S.analyticsTitle}>📅 Weekly Activity</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
                {recentWeeks.map(([week, count]) => (
                  <div key={week} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:10, color:"#a78bfa", fontWeight:700 }}>{count}</span>
                    <div style={{ width:"100%", background:"linear-gradient(180deg,#a78bfa,#6d28d9)",
                      height:`${(count/maxWeek)*60}px`, borderRadius:"4px 4px 0 0", minHeight:4 }}/>
                    <span style={{ fontSize:9, color:"#4a3d6a", transform:"rotate(-45deg)", transformOrigin:"top center", whiteSpace:"nowrap" }}>
                      {week.replace(/^\d{4}-/,"")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly chart */}
          {recentMonths.length > 0 && (
            <div style={S.analyticsCard}>
              <div style={S.analyticsTitle}>🗓 Monthly Activity</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {recentMonths.map(([month, count]) => (
                  <div key={month} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:12, color:"#7c6faa", width:52, flexShrink:0 }}>{month.replace(/^\d{4}-/,"")}/{month.slice(0,4).slice(-2)}</span>
                    <MiniBar value={count} max={maxMonth} color="#6d28d9"/>
                    <span style={{ fontSize:12, color:"#a78bfa", width:24, textAlign:"right", flexShrink:0 }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CSS + STYLES
// ─────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-thumb { background:#3d2f70; border-radius:99px; }
  input[type=number]::-webkit-inner-spin-button { opacity:0.3; }
  input[type=datetime-local]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .fade-in { animation: fadeIn 0.3s ease both; }

  /* Responsive nav labels */
  .nav-label { display:inline; }
  @media (max-width: 340px) { .nav-label { display:none; } }
`;

const S = {
  root: { minHeight:"100vh", background:"#0d0820", color:"#e9d5ff",
    fontFamily:"'Nunito', system-ui, sans-serif", position:"relative",
    overflow:"hidden", maxWidth:520, margin:"0 auto" },

  blob1: { position:"fixed", width:360, height:360, borderRadius:"50%",
    background:"radial-gradient(circle, #4c1d9518, transparent 70%)",
    top:-130, right:-100, pointerEvents:"none" },
  blob2: { position:"fixed", width:280, height:280, borderRadius:"50%",
    background:"radial-gradient(circle, #1e3a5f18, transparent 70%)",
    bottom:80, left:-80, pointerEvents:"none" },
  blob3: { position:"fixed", width:200, height:200, borderRadius:"50%",
    background:"radial-gradient(circle, #7c3aed0d, transparent 70%)",
    top:"40%", left:"30%", pointerEvents:"none" },

  header: { background:"linear-gradient(180deg,#130a2e 0%,#0d0820 100%)",
    borderBottom:"1px solid #1e1040", position:"sticky", top:0, zIndex:10 },
  headerTop: { display:"flex", alignItems:"center", padding:"12px 16px 8px", gap:12 },
  logoWrap: { display:"flex", alignItems:"center", gap:10 },
  appTitle: { fontSize:20, fontWeight:900, color:"#c4b5fd", letterSpacing:-0.5, lineHeight:1.1 },
  appSub: { fontSize:10, color:"#4a3d6a", fontWeight:700, letterSpacing:0.5 },
  headerRight: { marginLeft:"auto", display:"flex", alignItems:"center", gap:8 },
  iconBtn: { background:"#1a1030", border:"1px solid #2d2050", borderRadius:10,
    padding:"6px 10px", fontSize:16, cursor:"pointer", color:"#a78bfa" },

  tabs: { display:"flex", borderTop:"1px solid #1a1030" },
  tab: { flex:1, padding:"10px 0", background:"transparent", border:"none",
    borderBottom:"2px solid transparent", color:"#4a3d6a", fontWeight:800,
    fontSize:13, cursor:"pointer", fontFamily:"inherit", transition:"color 0.2s",
    display:"flex", alignItems:"center", justifyContent:"center", gap:5, position:"relative" },
  tabActive: { color:"#c4b5fd", borderBottom:"2px solid #a78bfa" },
  navBadge: { position:"absolute", top:6, right:8, background:"#6d28d9",
    color:"#fff", borderRadius:99, fontSize:9, fontWeight:900, padding:"1px 5px",
    lineHeight:1.4 },

  main: { padding:16, paddingBottom:60 },

  editBanner: { background:"#1e1a00", border:"1px solid #f5c51855", borderRadius:12,
    padding:"10px 14px", marginBottom:16, fontSize:13, color:"#fde68a",
    display:"flex", alignItems:"center", justifyContent:"space-between" },
  editCancel: { background:"transparent", border:"1px solid #f5c51855", color:"#fde68a",
    borderRadius:8, padding:"3px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" },

  annBanner: { background:"#1a0f30", borderBottom:"1px solid #3d2f70",
    padding:"10px 16px", fontSize:13, color:"#c4b5fd",
    display:"flex", alignItems:"center", gap:10 },
  annClose: { background:"transparent", border:"none", color:"#4a3d6a",
    cursor:"pointer", fontSize:16, fontFamily:"inherit", flexShrink:0 },

  typeGrid: { display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 },
  typeBtn: { borderRadius:14, padding:"10px 4px", fontSize:12, fontWeight:800,
    cursor:"pointer", fontFamily:"inherit", lineHeight:1.3, minHeight:56,
    transition:"transform 0.15s, box-shadow 0.15s",
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" },

  sizeGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 },
  sizeBtn: { borderRadius:14, padding:"10px 4px", cursor:"pointer",
    fontFamily:"inherit", textAlign:"center", transition:"all 0.15s" },

  input: { width:"100%", background:"#160f30", border:"1.5px solid #2d2050",
    borderRadius:12, color:"#e9d5ff", padding:"10px 14px",
    fontSize:14, fontFamily:"inherit", colorScheme:"dark" },
  inputHint: { fontSize:11, color:"#4a3d6a", marginTop:5 },

  hint: { marginTop:10, background:"#160f30", border:"1px solid #2d2050",
    borderRadius:10, padding:"8px 12px", fontSize:13, color:"#9f7aea",
    display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" },

  endCard: { marginTop:12, background:"#160f30", border:"1px solid #3d2f70",
    borderRadius:14, padding:14, boxShadow:"0 0 24px #7c3aed22" },
  endRow: { display:"flex", justifyContent:"space-between", alignItems:"center",
    marginBottom:8, flexWrap:"wrap", gap:4 },

  submitBtn: { width:"100%", padding:15, marginTop:4,
    background:"linear-gradient(135deg,#6d28d9,#a855f7)",
    border:"none", borderRadius:18, color:"#fff", fontWeight:900,
    fontSize:16, cursor:"pointer", fontFamily:"inherit",
    boxShadow:"0 4px 24px #7c3aed55", transition:"opacity 0.2s", letterSpacing:0.3 },

  logCard: { background:"#100826", border:"1px solid #2d2050",
    borderRadius:18, padding:14, marginBottom:10,
    display:"flex", alignItems:"flex-start", gap:12,
    animation:"fadeIn 0.3s ease both" },
  logDot: { width:12, height:12, borderRadius:"50%", marginTop:4, flexShrink:0 },
  logEndCard: { background:"#0d0820", border:"1px solid #2d2050",
    borderRadius:12, padding:"10px 12px", marginBottom:4 },
  actionBtn: { background:"transparent", border:"none", fontSize:16,
    cursor:"pointer", padding:"2px 4px", fontFamily:"inherit" },

  analyticsCard: { background:"#100826", border:"1px solid #2d2050",
    borderRadius:16, padding:16, marginBottom:12 },
  analyticsTitle: { fontSize:13, fontWeight:800, color:"#7c6faa",
    marginBottom:12, letterSpacing:0.5 },
};
