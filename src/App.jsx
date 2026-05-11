// src/App.jsx — Shroom Log v4
// Changes in this version:
//  - History split into tabs: In Progress / Completed (not one scroll)
//  - In Progress always shows estimated end time
//  - Analytics completely reworked: unique days played streak, avg per week,
//    completion rate, best day of week, per-size breakdown
//  - 5 UI themes: Midnight (default), Forest, Sakura, Ocean, Sunset
//  - Theme persisted to localStorage

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { loadLogs, addLog, editLog, removeLog } from "./api/logs";
import { loadAnnouncements } from "./api/announcements";
import { useWindowSize } from "./hooks/useWindowSize";
import AuthScreen from "./components/AuthScreen";

// ─────────────────────────────────────────────────────────────
// THEMES
// ─────────────────────────────────────────────────────────────
export const THEMES = {
  midnight: {
    id: "midnight", label: "Midnight", emoji: "🌙",
    bg: "#0d0820", surface: "#100826", surfaceAlt: "#160f30",
    border: "#2d2050", borderFaint: "#1e1040",
    accent: "#a78bfa", accentDark: "#6d28d9", accentGlow: "#7c3aed44",
    accentGrad: "linear-gradient(135deg,#6d28d9,#a855f7)",
    text: "#e9d5ff", textMid: "#7c6faa", textFaint: "#4a3d6a",
    sidebar: "#090617", tabActive: "#1e1040",
    blob1: "#4c1d9514", blob2: "#1e3a5f14",
    positive: "#68d391", warning: "#fc8181",
    cardActive: "#100826", cardDone: "#0a0f0a",
  },
  forest: {
    id: "forest", label: "Forest", emoji: "🌿",
    bg: "#071510", surface: "#0c2018", surfaceAlt: "#0f2a1e",
    border: "#1e4a32", borderFaint: "#122a1e",
    accent: "#4ade80", accentDark: "#16a34a", accentGlow: "#22c55e44",
    accentGrad: "linear-gradient(135deg,#15803d,#4ade80)",
    text: "#d1fae5", textMid: "#4a7a58", textFaint: "#2a4a38",
    sidebar: "#050f0a", tabActive: "#0f2a1e",
    blob1: "#16a34a14", blob2: "#14532d14",
    positive: "#86efac", warning: "#fca5a5",
    cardActive: "#0c2018", cardDone: "#070f0a",
  },
  sakura: {
    id: "sakura", label: "Sakura", emoji: "🌸",
    bg: "#1a0a12", surface: "#240f1a", surfaceAlt: "#2d1422",
    border: "#5a2040", borderFaint: "#3a1428",
    accent: "#f9a8d4", accentDark: "#db2777", accentGlow: "#ec489944",
    accentGrad: "linear-gradient(135deg,#be185d,#f9a8d4)",
    text: "#fce7f3", textMid: "#9d4e72", textFaint: "#6b2e4a",
    sidebar: "#110608", tabActive: "#3a1428",
    blob1: "#db277714", blob2: "#9d174d14",
    positive: "#86efac", warning: "#fca5a5",
    cardActive: "#240f1a", cardDone: "#0f0608",
  },
  ocean: {
    id: "ocean", label: "Ocean", emoji: "🌊",
    bg: "#030d1a", surface: "#071828", surfaceAlt: "#0a2035",
    border: "#1a3a5a", borderFaint: "#0f2540",
    accent: "#38bdf8", accentDark: "#0284c7", accentGlow: "#0ea5e944",
    accentGrad: "linear-gradient(135deg,#0369a1,#38bdf8)",
    text: "#e0f2fe", textMid: "#4a7a9a", textFaint: "#2a4a6a",
    sidebar: "#020a14", tabActive: "#0a2035",
    blob1: "#0284c714", blob2: "#075985 14",
    positive: "#6ee7b7", warning: "#fca5a5",
    cardActive: "#071828", cardDone: "#030d12",
  },
  sunset: {
    id: "sunset", label: "Sunset", emoji: "🌅",
    bg: "#140800", surface: "#1f0e00", surfaceAlt: "#2a1400",
    border: "#5a2d00", borderFaint: "#3a1e00",
    accent: "#fb923c", accentDark: "#c2410c", accentGlow: "#f9731644",
    accentGrad: "linear-gradient(135deg,#c2410c,#fb923c)",
    text: "#fff7ed", textMid: "#9a5a2a", textFaint: "#6a3a1a",
    sidebar: "#0e0500", tabActive: "#2a1400",
    blob1: "#ea580c14", blob2: "#92400e14",
    positive: "#16a34a", warning: "#dc2626",
    cardActive: "#1f0e00", cardDone: "#0a0500",
  },
  daytime: {
    id: "daytime", label: "Daytime", emoji: "☀️",
    bg: "#f0f4f8", surface: "#ffffff", surfaceAlt: "#e8edf3",
    border: "#c8d4e0", borderFaint: "#dde5ef",
    accent: "#4f46e5", accentDark: "#3730a3", accentGlow: "#6366f144",
    accentGrad: "linear-gradient(135deg,#3730a3,#6366f1)",
    text: "#1e1b4b", textMid: "#6366a0", textFaint: "#9da3c4",
    sidebar: "#e8edf3", tabActive: "#dde5ef",
    blob1: "#6366f114", blob2: "#4338ca14",
    positive: "#16a34a", warning: "#dc2626",
    cardActive: "#ffffff", cardDone: "#f5f7fa",
  },
};

// ─────────────────────────────────────────────────────────────
// MUSHROOM TYPES — add new objects here to extend
// ─────────────────────────────────────────────────────────────
export const MUSHROOM_TYPES = [
  { id:"red",       label:"Red",       emoji:"🔴", color:"#e05252", glow:"#e0525244", textColor:"#fff", category:"regular",   pikmin:"Any",        desc:"Standard red mushroom" },
  { id:"yellow",    label:"Yellow",    emoji:"🟡", color:"#f5c518", glow:"#f5c51844", textColor:"#433", category:"regular",   pikmin:"Any",        desc:"Standard yellow mushroom" },
  { id:"blue",      label:"Blue",      emoji:"🔵", color:"#4a90d9", glow:"#4a90d944", textColor:"#fff", category:"regular",   pikmin:"Any",        desc:"Standard blue mushroom" },
  { id:"purple",    label:"Purple",    emoji:"🟣", color:"#9b72cf", glow:"#9b72cf44", textColor:"#fff", category:"regular",   pikmin:"Any",        desc:"Standard purple mushroom" },
  { id:"white",     label:"White",     emoji:"⚪", color:"#ccc5bc", glow:"#ccc5bc44", textColor:"#444", category:"regular",   pikmin:"Any",        desc:"Standard white mushroom" },
  { id:"pink",      label:"Pink",      emoji:"🩷", color:"#f080b4", glow:"#f080b444", textColor:"#fff", category:"regular",   pikmin:"Any",        desc:"Standard pink mushroom" },
  { id:"grey",      label:"Grey",      emoji:"🩶", color:"#94a3b8", glow:"#94a3b844", textColor:"#fff", category:"regular",   pikmin:"Any",        desc:"Standard grey mushroom" },
  { id:"teal",      label:"Teal",      emoji:"🩵", color:"#2dd4bf", glow:"#2dd4bf44", textColor:"#fff", category:"regular",   pikmin:"Any",        desc:"Standard teal mushroom" },
  { id:"fire",      label:"Fire",      emoji:"🔥", color:"#ff6b35", glow:"#ff6b3544", textColor:"#fff", category:"elemental", pikmin:"Red only",   desc:"Bring Red Pikmin for bonus damage" },
  { id:"water",     label:"Water",     emoji:"💧", color:"#38bdf8", glow:"#38bdf844", textColor:"#fff", category:"elemental", pikmin:"Blue only",  desc:"Bring Blue Pikmin for bonus damage" },
  { id:"electric",  label:"Electric",  emoji:"⚡", color:"#facc15", glow:"#facc1544", textColor:"#333", category:"elemental", pikmin:"Yellow",     desc:"Bring Yellow Pikmin for bonus damage" },
  { id:"poison",    label:"Poison",    emoji:"☠️", color:"#c084fc", glow:"#c084fc44", textColor:"#fff", category:"elemental", pikmin:"White only", desc:"Bring White Pikmin for bonus damage" },
  { id:"crystal",   label:"Crystal",   emoji:"💎", color:"#818cf8", glow:"#818cf844", textColor:"#fff", category:"elemental", pikmin:"Rock only",  desc:"Bring Rock Pikmin for bonus damage" },
  { id:"brilliant", label:"Brilliant", emoji:"✨", color:"#fde68a", glow:"#fde68a44", textColor:"#555", category:"event",     pikmin:"Any",        desc:"Rare brilliant mushroom — higher rewards" },
  { id:"giant",     label:"Giant",     emoji:"🌟", color:"#86efac", glow:"#86efac44", textColor:"#333", category:"event",     pikmin:"Any",        desc:"Oversized mushroom needing group effort" },
  { id:"event",     label:"Event",     emoji:"🎉", color:"#fb923c", glow:"#fb923c44", textColor:"#fff", category:"event",     pikmin:"Any",        desc:"Limited-time event mushroom" },
];

export const SIZES          = ["Small", "Normal", "Large", "Giant"];
export const SIZE_HP_APPROX = { Small: 265000, Normal: 531000, Large: 2650000, Giant: 9200000 };
export const SIZE_EMOJI     = { Small: "🍄", Normal: "🍄🍄", Large: "🍄🍄🍄", Giant: "🍄🍄🍄🍄" };
export const STAR_RATINGS   = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐"];

const NAV_ITEMS = [
  { key: "register",  label: "Register",  icon: "✏️" },
  { key: "history",   label: "History",   icon: "📋" },
  { key: "analytics", label: "Analytics", icon: "📊" },
  { key: "settings",  label: "Settings",  icon: "⚙️" },
];

const BLANK_FORM = {
  mushroomType: "", size: "", stars: "", players: 1,
  workload: "", strength: "", notes: "", startTime: "",
};

// ─────────────────────────────────────────────────────────────
// MATH
// duration (ms) = (workload / strength) * 100 * 1000
// ─────────────────────────────────────────────────────────────
export function calcDurationMs(workload, strength) {
  if (!workload || !strength || strength <= 0 || workload <= 0) return null;
  return (workload / strength) * 100 * 1000;
}

export function formatDuration(ms) {
  if (!ms || ms <= 0) return "Done!";
  const s  = Math.floor(Math.abs(ms) / 1000);
  const d  = Math.floor(s / 86400);
  const h  = Math.floor((s % 86400) / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sc}s`;
  return `${m}m ${sc}s`;
}

export function toDiscordTs(date, style = "F") {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

function formatDate(date) {
  return date.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function localNow() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
}

function getWeekNum(d) {
  const jan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - jan) / 86400000) + jan.getDay() + 1) / 7);
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS — reworked
// Streak = consecutive CALENDAR DAYS that had at least 1 mushroom
// (not mushroom count). avgPerWeek, completionRate, bestDayOfWeek, bySize
// ─────────────────────────────────────────────────────────────
function buildAnalytics(log) {
  if (log.length === 0) return {
    total: 0, completed: 0, active: 0,
    byType: {}, bySize: {}, byDayOfWeek: {},
    streak: 0, longestStreak: 0,
    avgPerWeek: 0, completionRate: 0, bestDay: null,
    recentWeeks: [], recentMonths: [],
  };

  const now    = Date.now();
  const byType = {}, bySize = {}, byMonth = {}, byWeek = {};
  const byDayOfWeek = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
  // unique calendar days that had a mushroom registered
  const daySet = new Set();

  log.forEach(e => {
    byType[e.mushroomType] = (byType[e.mushroomType] || 0) + 1;
    bySize[e.size]         = (bySize[e.size]         || 0) + 1;
    const d   = new Date(e.registeredAt);
    const ds  = d.toDateString();
    const wk  = `${d.getFullYear()}-W${String(getWeekNum(d)).padStart(2, "0")}`;
    const mo  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byWeek[wk]            = (byWeek[wk]  || 0) + 1;
    byMonth[mo]           = (byMonth[mo] || 0) + 1;
    byDayOfWeek[d.getDay()]++;
    daySet.add(ds);
  });

  // Streak: consecutive days (from today backwards)
  let streak = 0, longestStreak = 0;
  {
    const sortedDays = [...daySet]
      .map(ds => new Date(ds).setHours(0, 0, 0, 0))
      .sort((a, b) => b - a); // newest first

    const todayMs    = new Date().setHours(0, 0, 0, 0);
    const yesterdayMs = todayMs - 86400000;

    // streak only counts if they played today or yesterday
    if (sortedDays[0] >= yesterdayMs) {
      streak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        if (sortedDays[i - 1] - sortedDays[i] === 86400000) streak++;
        else break;
      }
    }

    // longest streak
    let cur = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i - 1] - sortedDays[i] === 86400000) { cur++; longestStreak = Math.max(longestStreak, cur); }
      else cur = 1;
    }
    longestStreak = Math.max(longestStreak, streak, 1);
  }

  // avg per week (over the weeks that have data)
  const weekCount  = Object.keys(byWeek).length || 1;
  const avgPerWeek = (log.length / weekCount).toFixed(1);

  // completion rate
  const completedCount = log.filter(e => e.endTime && e.endTime <= now).length;
  const completionRate = log.length > 0
    ? Math.round((completedCount / log.length) * 100)
    : 0;

  // best day of week
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const bestDayIdx = Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0];
  const bestDay = bestDayIdx ? `${dayNames[bestDayIdx[0]]} (${bestDayIdx[1]})` : null;

  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

  return {
    total: log.length,
    completed: completedCount,
    active: log.length - completedCount,
    byType, bySize, byDayOfWeek,
    streak, longestStreak,
    avgPerWeek, completionRate, bestDay, topType,
    recentWeeks:  Object.entries(byWeek).slice(-8),
    recentMonths: Object.entries(byMonth).slice(-6),
  };
}

// ─────────────────────────────────────────────────────────────
// LOGO
// ─────────────────────────────────────────────────────────────
export function PikminLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 0 8px #fde68a77)", flexShrink: 0 }}>
      <line x1="40" y1="20" x2="40" y2="10" stroke="#86efac" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="47" cy="10" rx="6" ry="3" fill="#4ade80" transform="rotate(-25 47 10)"/>
      <ellipse cx="40" cy="30" rx="14" ry="15" fill="#fde68a"/>
      <ellipse cx="35" cy="24" rx="4" ry="2.5" fill="#ffffff66"/>
      <circle cx="35" cy="30" r="4.5" fill="#1a1a2e"/>
      <circle cx="45" cy="30" r="4.5" fill="#1a1a2e"/>
      <circle cx="36.2" cy="28.5" r="1.6" fill="white"/>
      <circle cx="46.2" cy="28.5" r="1.6" fill="white"/>
      <path d="M35 36 Q40 40 45 36" stroke="#a16207" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <ellipse cx="40" cy="53" rx="11" ry="13" fill="#fde68a"/>
      <ellipse cx="40" cy="59" rx="8" ry="7" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="27" cy="51" rx="5.5" ry="3" fill="#fde68a" transform="rotate(-30 27 51)"/>
      <ellipse cx="53" cy="51" rx="5.5" ry="3" fill="#fde68a" transform="rotate(30 53 51)"/>
      <ellipse cx="34" cy="65" rx="5" ry="3" fill="#fbbf24"/>
      <ellipse cx="46" cy="65" rx="5" ry="3" fill="#fbbf24"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// THEME CONTEXT — passed via prop drilling (no context needed)
// All themed components receive `th` (the current theme object)
// ─────────────────────────────────────────────────────────────

function Section({ label, icon, children, th }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: th.textMid,
        textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span>{label}
      </div>
      {children}
    </div>
  );
}

function CopyBtn({ text, label = "Copy", th }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => navigator.clipboard.writeText(text).then(() => {
      setOk(true); setTimeout(() => setOk(false), 1500);
    })} style={{
      background: ok ? "#22543d" : th.surfaceAlt,
      border: `1px solid ${ok ? "#48bb78" : th.border}`,
      color: ok ? th.positive : th.accent,
      borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", whiteSpace: "nowrap",
    }}>{ok ? "✓" : label}</button>
  );
}

function Countdown({ endTime, th }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = endTime - now;
  return (
    <span style={{
      color: ms <= 0 ? th.positive : ms < 600000 ? th.warning : th.accent,
      fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: 13,
    }}>
      {ms <= 0 ? "✅ Done!" : formatDuration(ms)}
    </span>
  );
}

function MiniBar({ value, max, color, th }) {
  return (
    <div style={{ background: th.surfaceAlt, borderRadius: 99, height: 6, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%`, height: "100%",
        background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );
}

function FilterPill({ value, current, onChange, label, color, th }) {
  const active = current === value;
  return (
    <button onClick={() => onChange(value)} style={{
      padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      background: active ? (color ? `${color}33` : th.tabActive) : th.surfaceAlt,
      border: `1.5px solid ${active ? (color || th.accent) : th.border}`,
      color: active ? (color || th.accent) : th.textFaint,
    }}>{label}</button>
  );
}

function SectionDivider({ label, count, color, th }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: color || th.textMid, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ background: color ? `${color}22` : th.tabActive,
        color: color || th.textMid, borderRadius: 99, fontSize: 11,
        fontWeight: 900, padding: "2px 10px" }}>
        {count}
      </span>
      <div style={{ flex: 1, height: 1, background: color ? `${color}33` : th.borderFaint }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const { isDesktop } = useWindowSize();

  // Theme
  const [themeId, setThemeId] = useState(() =>
    localStorage.getItem("shroom_theme") || "midnight"
  );
  const th = THEMES[themeId] || THEMES.midnight;
  function applyTheme(id) {
    setThemeId(id);
    localStorage.setItem("shroom_theme", id);
  }

  // Auth
  const [user, setUser]       = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    return unsub;
  }, []);

  // Data
  const [log, setLog]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState("register");
  const [form, setForm]       = useState(BLANK_FORM);
  const [editId, setEditId]   = useState(null);
  const [saved, setSaved]     = useState(false);
  const [search, setSearch]   = useState("");
  const [filterType, setFilterType] = useState("all");
  const [notif, setNotif]     = useState(false);
  const [announcements, setAnn] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dismissed_ann") || "[]"); } catch { return []; }
  });
  const scheduledRefs = useRef({});

  useEffect(() => {
    if (!user) { setLog([]); setLoading(false); return; }
    setLoading(true);
    Promise.all([loadLogs(), loadAnnouncements()]).then(([logs, anns]) => {
      setLog(logs); setAnn(anns); setLoading(false);
    }).catch(() => setLoading(false));
    if ("Notification" in window && Notification.permission === "granted") setNotif(true);
  }, [user]);

  useEffect(() => {
    log.forEach(e => { if (e.endTime && !scheduledRefs.current[e.id]) scheduleNotif(e); });
  }, [log, notif]);

  function scheduleNotif(entry) {
    if (!notif || !entry.endTime) return;
    const ms = entry.endTime - Date.now() - 5 * 60 * 1000;
    if (ms > 0) {
      const timer = setTimeout(() => {
        const t = MUSHROOM_TYPES.find(x => x.id === entry.mushroomType);
        new Notification("🍄 Mushroom ending soon!", {
          body: `Your ${entry.size} ${t?.label} mushroom ends in 5 minutes!`,
        });
      }, ms);
      scheduledRefs.current[entry.id] = timer;
    }
  }

  async function requestNotif() {
    if (!("Notification" in window)) return alert("Notifications not supported in this browser.");
    const p = await Notification.requestPermission();
    if (p === "granted") setNotif(true);
  }

  // Derived form state
  const selectedType = MUSHROOM_TYPES.find(t => t.id === form.mushroomType);
  const workloadNum  = parseFloat(form.workload);
  const strengthNum  = parseFloat(form.strength);
  const startMs      = form.startTime ? new Date(form.startTime).getTime() : Date.now();
  const durationMs   = calcDurationMs(workloadNum, strengthNum);
  const endTime      = durationMs ? new Date(startMs + durationMs) : null;

  async function submit() {
    if (!form.mushroomType || !form.size || !form.stars) return;
    const existing = editId ? log.find(e => e.id === editId) : null;
    const entry = {
      ...form,
      id:           existing?.id || Date.now(),
      endTime:      endTime ? endTime.getTime() : null,
      registeredAt: existing?.registeredAt || Date.now(),
      date: new Date().toLocaleDateString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      }),
    };
    try {
      if (editId && existing?._firebaseId) {
        await editLog(existing._firebaseId, entry);
        setLog(prev => prev.map(e => e.id === editId ? { ...entry, _firebaseId: existing._firebaseId } : e));
      } else {
        const fbId = await addLog(entry);
        setLog(prev => [{ ...entry, _firebaseId: fbId }, ...prev]);
        scheduleNotif({ ...entry, _firebaseId: fbId });
      }
    } catch (e) { console.error(e); alert("Failed to save. Check your connection."); return; }
    setEditId(null); setForm(BLANK_FORM);
    setSaved(true); setTimeout(() => setSaved(false), 1800);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() { setEditId(null); setForm(BLANK_FORM); }

  async function deleteEntry(id) {
    const entry = log.find(e => e.id === id);
    if (!entry || !window.confirm("Delete this entry?")) return;
    if (scheduledRefs.current[id]) { clearTimeout(scheduledRefs.current[id]); delete scheduledRefs.current[id]; }
    try {
      if (entry._firebaseId) await removeLog(entry._firebaseId);
      setLog(prev => prev.filter(e => e.id !== id));
    } catch { alert("Failed to delete."); }
  }

  function dismissAnn(id) {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem("dismissed_ann", JSON.stringify(next));
  }

  const filteredLog = log.filter(e => {
    const matchType   = filterType === "all" || e.mushroomType === filterType;
    if (!matchType) return false;
    if (!search.trim()) return true;
    const q    = search.toLowerCase().trim();
    const type = MUSHROOM_TYPES.find(t => t.id === e.mushroomType);
    // fuzzy: match any of these fields partially
    return (
      (type?.label || "").toLowerCase().includes(q) ||
      (type?.emoji || "").includes(q) ||
      (e.notes  || "").toLowerCase().includes(q) ||
      (e.size   || "").toLowerCase().includes(q) ||
      (e.stars  || "").includes(q) ||
      (e.date   || "").toLowerCase().includes(q)
    );
  });

  const activeAnn = announcements.filter(a => !dismissed.includes(a.id));
  const analytics = buildAnalytics(log);

  if (!authReady) return <Splash th={th} />;
  if (!user)      return <AuthScreen />;

  // Shared props
  const shared = { th, log: filteredLog, allLog: log, search, setSearch,
    filterType, setFilterType, onEdit: startEdit, onDelete: deleteEntry };

  function renderContent() {
    if (loading) return (
      <div style={{ textAlign: "center", padding: 60, color: th.textFaint }}>
        <PikminLogo size={64} /><br /><br />Loading your mushrooms…
      </div>
    );
    if (view === "register") return (
      <RegisterView th={th} form={form} setForm={setForm} editId={editId} cancelEdit={cancelEdit}
        selectedType={selectedType} endTime={endTime} durationMs={durationMs}
        startMs={startMs} submit={submit} saved={saved} notif={notif} />
    );
    if (view === "history")   return <HistoryView {...shared} />;
    if (view === "settings")  return <SettingsView th={th} themeId={themeId} applyTheme={applyTheme} user={user} />;
    return <AnalyticsView th={th} analytics={analytics} log={log} />;
  }

  const annBanners = activeAnn.map(a => (
    <div key={a.id} style={{
      background: a.priority === 2 ? "#2d1000" : th.surface,
      borderBottom: `1px solid ${a.priority === 2 ? "#fb923c55" : th.border}`,
      padding: "10px 16px", color: th.text, display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ flex: 1, fontSize: 13 }}>
        {a.priority === 2 ? "🚨" : "📣"} <strong>{a.title}</strong> — {a.body}
      </span>
      <button onClick={() => dismissAnn(a.id)} style={{ background: "transparent", border: "none",
        color: th.textFaint, cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>✕</button>
    </div>
  ));

  // ── DESKTOP ──
  if (isDesktop) {
    return (
      <div style={{ minHeight: "100vh", background: th.bg, color: th.text,
        fontFamily: "'Nunito', system-ui, sans-serif", display: "flex" }}>
        <style>{globalCss(th)}</style>

        <aside style={{ width: 240, background: th.sidebar, borderRight: `1px solid ${th.borderFaint}`,
          padding: "24px 14px", display: "flex", flexDirection: "column",
          position: "sticky", top: 0, height: "100vh", flexShrink: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, paddingLeft: 4 }}>
            <PikminLogo size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, color: th.accent, letterSpacing: -0.5 }}>Shroom Log</div>
              <div style={{ fontSize: 10, color: th.textFaint, fontWeight: 700 }}>Pikmin Bloom</div>
            </div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {NAV_ITEMS.map(item => (
              <button key={item.key}
                onClick={() => { setView(item.key); if (editId && item.key !== "register") cancelEdit(); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                  borderRadius: 14, border: "none", fontFamily: "inherit", fontSize: 14,
                  fontWeight: 700, cursor: "pointer", transition: "all 0.15s", textAlign: "left",
                  background: view === item.key ? th.tabActive : "transparent",
                  color: view === item.key ? th.accent : th.textFaint, position: "relative" }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.key === "history" && log.length > 0 && (
                  <span style={{ marginLeft: "auto", background: th.accentDark, color: "#fff",
                    borderRadius: 99, fontSize: 11, fontWeight: 900, padding: "2px 7px" }}>
                    {log.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: th.textFaint, textAlign: "center" }}>
              {user.displayName || user.email}
            </div>
          </div>
        </aside>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "auto" }}>
          {annBanners}
          <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "28px 32px" }}>
            {renderContent()}
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE ──
  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text,
      fontFamily: "'Nunito', system-ui, sans-serif", maxWidth: 520, margin: "0 auto",
      position: "relative" }}>
      <style>{globalCss(th)}</style>
      {annBanners}
      <header style={{ background: `linear-gradient(180deg,${th.sidebar} 0%,${th.bg} 100%)`,
        borderBottom: `1px solid ${th.borderFaint}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 8px", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PikminLogo size={40} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, color: th.accent, letterSpacing: -0.5, lineHeight: 1.1 }}>
                Shroom Log
              </div>
              <div style={{ fontSize: 10, color: th.textFaint, fontWeight: 700 }}>Pikmin Bloom</div>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          </div>
        </div>
        <nav style={{ display: "flex", borderTop: `1px solid ${th.borderFaint}` }}>
          {NAV_ITEMS.map(item => (
            <button key={item.key}
              onClick={() => { setView(item.key); if (editId && item.key !== "register") cancelEdit(); }}
              style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none",
                borderBottom: `2px solid ${view === item.key ? th.accent : "transparent"}`,
                color: view === item.key ? th.accent : th.textFaint,
                fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 4, position: "relative", transition: "color 0.2s" }}>
              <span>{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.key === "history" && log.length > 0 && (
                <span style={{ position: "absolute", top: 5, right: 6, background: th.accentDark,
                  color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 900, padding: "1px 5px" }}>
                  {log.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ padding: 16, paddingBottom: 60 }}>{renderContent()}</main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────────────────────────
function Splash({ th }) {
  return (
    <div style={{ minHeight: "100vh", background: th?.bg || "#0d0820",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 16,
      fontFamily: "'Nunito', system-ui, sans-serif", color: th?.textFaint || "#4a3d6a" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap');`}</style>
      <PikminLogo size={72} />
      <div style={{ fontSize: 14, fontWeight: 700 }}>Loading…</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REGISTER VIEW
// ─────────────────────────────────────────────────────────────
// inp is defined as a function of th so it picks up theme colors
// but font-size is always 16px to prevent iOS auto-zoom on focus
function makeInp(th) {
  return {
    width: "100%", background: th.surfaceAlt, border: `1.5px solid ${th.border}`,
    borderRadius: 12, color: th.text, padding: "10px 14px",
    fontSize: 16, fontFamily: "inherit", colorScheme: "dark",
  };
}

function RegisterView({ th, form, setForm, editId, cancelEdit, selectedType, endTime, durationMs, startMs, submit, saved, notif }) {
  // useCallback so `set` is stable — prevents the entire form re-rendering
  // every child button just because an unrelated field changed
  const set = useCallback(
    (k, v) => setForm(prev => ({ ...prev, [k]: v })),
    [setForm]
  );

  // Memoize inp so the object ref is stable across renders
  const inp = useMemo(() => makeInp(th), [th]);

  const categories = [
    { key: "regular",   label: "Regular",   icon: "🍄" },
    { key: "elemental", label: "Elemental", icon: "⚡" },
    { key: "event",     label: "Event",     icon: "✨" },
  ];

  return (
    <div className="fade-in">
      {editId && (
        <div style={{ background: "#1e1a00", border: "1px solid #f5c51844", borderRadius: 12,
          padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#fde68a",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          ✏️ Editing entry
          <button onClick={cancelEdit} style={{ background: "transparent", border: "1px solid #f5c51844",
            color: "#fde68a", borderRadius: 8, padding: "3px 10px",
            fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}

      <Section label="Mushroom Type" icon="🍄" th={th}>
        {categories.map(cat => {
          const types = MUSHROOM_TYPES.filter(t => t.category === cat.key);
          return (
            <div key={cat.key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: th.textFaint, fontWeight: 700, marginBottom: 6 }}>
                {cat.icon} {cat.label}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {types.map(t => {
                  const active = form.mushroomType === t.id;
                  return (
                    <button key={t.id} onClick={() => set("mushroomType", t.id)} title={t.desc} style={{
                      borderRadius: 14, padding: "10px 4px", fontWeight: 800, cursor: "pointer",
                      fontFamily: "inherit", lineHeight: 1.3, minHeight: 58, transition: "transform 0.15s, box-shadow 0.15s",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      background:  active ? t.color : `${t.color}22`,
                      color:       active ? t.textColor : t.color,
                      boxShadow:   active ? `0 0 16px ${t.glow}` : "none",
                      transform:   active ? "scale(1.06)" : "scale(1)",
                      border:      `2px solid ${active ? t.color : `${t.color}44`}`,
                    }}>
                      <span style={{ fontSize: 18 }}>{t.emoji}</span>
                      <span style={{ fontSize: 11, marginTop: 2 }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {selectedType && (
          <div style={{ marginTop: 10, background: th.surfaceAlt, border: `1px solid ${th.border}`,
            borderRadius: 10, padding: "8px 12px", fontSize: 13, color: th.textMid,
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            🌿 Best Pikmin: <strong style={{ color: th.accent }}>{selectedType.pikmin}</strong>
            <span style={{ color: th.textFaint, fontSize: 11 }}> · {selectedType.desc}</span>
          </div>
        )}
      </Section>

      <Section label="Mushroom Size" icon="📏" th={th}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {SIZES.map(s => {
            const active = form.size === s;
            return (
              <button key={s} onClick={() => {
                if (!form.workload) setForm(prev => ({ ...prev, size: s, workload: String(SIZE_HP_APPROX[s]) }));
                else set("size", s);
              }} style={{ borderRadius: 14, padding: "10px 4px", cursor: "pointer",
                fontFamily: "inherit", textAlign: "center", transition: "all 0.15s",
                border:     `2px solid ${active ? th.accent : th.border}`,
                background: active ? th.tabActive : th.surfaceAlt,
                boxShadow:  active ? `0 0 14px ${th.accentGlow}` : "none" }}>
                <div style={{ fontSize: 20 }}>{SIZE_EMOJI[s]}</div>
                <div style={{ fontWeight: 800, fontSize: 12, color: active ? th.accent : th.textMid }}>{s}</div>
                <div style={{ fontSize: 10, color: th.textFaint, marginTop: 2 }}>
                  ~{(SIZE_HP_APPROX[s] / 1000).toFixed(0)}K
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: th.textFaint, marginTop: 6 }}>
          Selecting a size pre-fills an approximate workload — replace it with the exact number from your game!
        </div>
      </Section>

      <Section label="Battle Details" icon="⚔️" th={th}>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <input type="number" value={form.workload}
              onChange={e => set("workload", e.target.value)}
              placeholder="Workload (exact HP)" style={inp} />
            <div style={{ fontSize: 11, color: th.textFaint, marginTop: 5 }}>Exact workload in-game</div>
          </div>
          <div style={{ flex: 1 }}>
            <input type="number" value={form.strength}
              onChange={e => set("strength", e.target.value)}
              placeholder="Everyone's Strength" style={inp} />
            <div style={{ fontSize: 11, color: th.textFaint, marginTop: 5 }}>Total strength in-game</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <input type="datetime-local" value={form.startTime || localNow()}
              onChange={e => set("startTime", e.target.value)}
              style={inp} />
          </div>
          <button
            onClick={() => set("startTime", localNow())}
            title="Set to right now"
            style={{
              padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${th.border}`,
              background: th.surfaceAlt, color: th.accent, fontWeight: 800,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              whiteSpace: "nowrap", transition: "all 0.15s", flexShrink: 0,
              boxShadow: `0 0 0 0 ${th.accentGlow}`,
            }}
          >
            🕐 Now
          </button>
        </div>
        <div style={{ fontSize: 11, color: th.textFaint, marginTop: 5, marginBottom: 10 }}>
          Battle start time — tap Now to use the current time
        </div>

        {endTime && (
          <div style={{ background: th.surfaceAlt, border: `1px solid ${th.border}`,
            borderRadius: 14, padding: 14, boxShadow: `0 0 24px ${th.accentGlow}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
              <span style={{ color: th.textMid, fontSize: 13 }}>⏱ Duration</span>
              <strong style={{ color: th.accent }}>{formatDuration(durationMs)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 4 }}>
              <span style={{ color: th.textMid, fontSize: 13 }}>📅 Ends at</span>
              <span style={{ color: th.text, fontWeight: 700, fontSize: 13 }}>{formatDate(endTime)}</span>
            </div>
            <div style={{ borderTop: `1px solid ${th.border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: th.textMid, marginBottom: 8 }}>
                🎮 Discord timestamps
                <span style={{ color: th.textFaint, marginLeft: 6, fontSize: 11 }}>
                  (auto-converts to each person's timezone)
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <code style={{ fontSize: 11, color: th.accent, background: th.bg,
                  padding: "5px 10px", borderRadius: 8, border: `1px solid ${th.border}`,
                  flex: 1, wordBreak: "break-all", fontFamily: "monospace" }}>
                  {toDiscordTs(endTime, "F")}
                </code>
                <CopyBtn text={toDiscordTs(endTime, "F")} label="📋 Full" th={th} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <code style={{ fontSize: 11, color: th.textMid, background: th.bg,
                  padding: "5px 10px", borderRadius: 8, border: `1px solid ${th.border}`,
                  flex: 1, wordBreak: "break-all", fontFamily: "monospace" }}>
                  {toDiscordTs(endTime, "R")}
                </code>
                <CopyBtn text={toDiscordTs(endTime, "R")} label="📋 Relative" th={th} />
              </div>
            </div>
            {notif
              ? <div style={{ fontSize: 11, color: th.positive, marginTop: 8 }}>🔔 Notification set 5 min before end</div>
              : <div style={{ fontSize: 11, color: th.textFaint, marginTop: 8 }}>🔕 Enable notifications for a 5-min reminder</div>
            }
          </div>
        )}
      </Section>

      <Section label="Star Rating" icon="⭐" th={th}>
        <div style={{ display: "flex", gap: 8 }}>
          {STAR_RATINGS.map(s => {
            const active = form.stars === s;
            return (
              <button key={s} onClick={() => set("stars", s)} style={{
                flex: 1, padding: "10px 2px", borderRadius: 12, fontFamily: "inherit",
                border:     `2px solid ${active ? "#f5c518" : th.border}`,
                background: active ? "#2d2000" : th.surfaceAlt,
                color: "#f5c518", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: active ? "0 0 12px #f5c51844" : "none", transition: "all 0.15s",
              }}>{s}</button>
            );
          })}
        </div>
      </Section>

      <Section label="Players" icon="👥" th={th}>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const active = form.players === n;
            return (
              <button key={n} onClick={() => set("players", n)} style={{
                flex: 1, padding: "10px 2px", borderRadius: 12, fontFamily: "inherit",
                border:     `2px solid ${active ? "#38bdf8" : th.border}`,
                background: active ? "#0c2436" : th.surfaceAlt,
                color:      active ? "#7dd3fc" : th.textFaint,
                fontSize: 17, fontWeight: 700, cursor: "pointer",
                boxShadow: active ? "0 0 12px #38bdf844" : "none", transition: "all 0.15s",
              }}>{n}</button>
            );
          })}
        </div>
      </Section>

      <Section label="Notes" icon="📝" th={th}>
        <textarea value={form.notes}
          onChange={e => set("notes", e.target.value)}
          placeholder="Location, squad tips, friends…"
          style={{ ...inp, resize: "none", minHeight: 60 }} rows={2} />
      </Section>

      <button onClick={submit} disabled={!form.mushroomType || !form.size || !form.stars} style={{
        width: "100%", padding: 15, marginTop: 4,
        background: th.accentGrad, border: "none", borderRadius: 18,
        color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
        fontFamily: "inherit", boxShadow: `0 4px 24px ${th.accentGlow}`,
        transition: "opacity 0.2s", letterSpacing: 0.3,
        opacity: (!form.mushroomType || !form.size || !form.stars) ? 0.4 : 1,
      }}>
        {saved ? "✅ Saved!" : editId ? "💾 Save Changes" : "Register Mushroom 🍄"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HISTORY VIEW — tabbed: In Progress / Completed
// ─────────────────────────────────────────────────────────────
function HistoryView({ th, log, allLog, search, setSearch, filterType, setFilterType, onEdit, onDelete }) {
  const [histTab, setHistTab] = useState("active");
  // Live clock so active/completed split and "X ago" update every second
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = log
    .filter(e => !e.endTime || e.endTime > now)
    .sort((a, b) => {
      if (!a.endTime && !b.endTime) return b.registeredAt - a.registeredAt;
      if (!a.endTime) return 1;
      if (!b.endTime) return -1;
      return a.endTime - b.endTime;
    });

  const completed = log
    .filter(e => e.endTime && e.endTime <= now)
    .sort((a, b) => b.endTime - a.endTime);

  const shown = histTab === "active" ? active : completed;

  return (
    <div className="fade-in">
      {/* Search + type filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search…"
          style={{ flex: 1, minWidth: 0, background: th.surfaceAlt, border: `1.5px solid ${th.border}`,
            borderRadius: 12, color: th.text, padding: "10px 14px",
            fontSize: 16, fontFamily: "inherit", colorScheme: "dark" }} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <FilterPill value="all" current={filterType} onChange={setFilterType} label="All" th={th} />
        {MUSHROOM_TYPES.filter(t => allLog.some(e => e.mushroomType === t.id)).map(t => (
          <FilterPill key={t.id} value={t.id} current={filterType} onChange={setFilterType}
            label={`${t.emoji} ${t.label}`} color={t.color} th={th} />
        ))}
      </div>

      {/* In Progress / Completed tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 18, background: th.surfaceAlt,
        borderRadius: 14, padding: 4, border: `1px solid ${th.border}` }}>
        {[
          { key: "active",    label: "⏳ In Progress", count: active.length,    color: th.accent },
          { key: "completed", label: "✅ Completed",   count: completed.length, color: th.positive },
        ].map(tab => (
          <button key={tab.key} onClick={() => setHistTab(tab.key)} style={{
            flex: 1, padding: "9px 8px", borderRadius: 10, border: "none",
            fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer",
            transition: "all 0.2s",
            background: histTab === tab.key ? th.tabActive : "transparent",
            color: histTab === tab.key ? tab.color : th.textFaint,
            boxShadow: histTab === tab.key ? `0 0 12px ${th.accentGlow}` : "none",
          }}>
            {tab.label}
            <span style={{ marginLeft: 6, background: histTab === tab.key ? th.accentDark : th.border,
              color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 900, padding: "1px 7px" }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: th.textFaint }}>
          <PikminLogo size={56} /><br /><br />
          {histTab === "active" ? "No mushrooms in progress!" : "No completed mushrooms yet."}
        </div>
      ) : shown.map((entry, i) => (
        <LogCard key={entry.id} entry={entry} index={i}
          isActive={histTab === "active"} th={th} now={now}
          onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function LogCard({ entry, index, isActive, th, now, onEdit, onDelete }) {
  const t       = MUSHROOM_TYPES.find(x => x.id === entry.mushroomType);
  const hasEnd  = !!entry.endTime;
  const endDate = hasEnd ? new Date(entry.endTime) : null;

  return (
    <div className="fade-in" style={{
      background:   isActive ? th.cardActive : th.cardDone,
      border:       `1px solid ${isActive ? (t ? `${t.color}55` : th.border) : th.borderFaint}`,
      borderRadius: 18, padding: 14, marginBottom: 10,
      display: "flex", alignItems: "flex-start", gap: 12,
      opacity: isActive ? 1 : 0.82,
      animationDelay: `${index * 25}ms`,
    }}>
      <div style={{ width: 12, height: 12, borderRadius: "50%", marginTop: 4, flexShrink: 0,
        background: t?.color, boxShadow: isActive ? `0 0 8px ${t?.glow}` : "none" }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 15, color: isActive ? th.text : th.textMid }}>
            {t?.emoji} {t?.label}
          </span>
          <span style={{ fontSize: 12, color: th.textMid }}>{SIZE_EMOJI[entry.size]} {entry.size}</span>
          <span style={{ fontSize: 12 }}>{entry.stars}</span>
          <span style={{ fontSize: 13, marginLeft: "auto", color: th.textFaint }}>
            {"👤".repeat(Math.min(entry.players || 1, 5))}
          </span>
        </div>

        {/* End time block */}
        {hasEnd && (
          <div style={{ background: th.bg, border: `1px solid ${th.borderFaint}`,
            borderRadius: 12, padding: "10px 12px", marginBottom: 6 }}>

            {/* Time remaining / ended */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: th.textMid }}>
                {isActive ? "⏱ Time left" : "✅ Ended"}
              </span>
              {isActive
                ? <Countdown endTime={entry.endTime} th={th} />
                : <span style={{ fontSize: 12, color: th.positive, fontWeight: 700 }}>
                    {formatDuration(now - entry.endTime)} ago
                  </span>
              }
            </div>

            {/* Estimated end date — always visible */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: th.textFaint }}>
                📅 {isActive ? "Ends" : "Ended"}
              </span>
              <span style={{ fontSize: 12, color: isActive ? th.accent : th.textMid, fontWeight: 700 }}>
                {formatDate(endDate)}
              </span>
            </div>

            {/* Discord timestamp — always visible, no expand needed */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <code style={{ fontSize: 10, color: th.textMid, fontFamily: "monospace",
                background: th.surfaceAlt, padding: "3px 8px", borderRadius: 6,
                border: `1px solid ${th.border}`, flex: 1, wordBreak: "break-all" }}>
                {toDiscordTs(endDate, "F")}
              </code>
              <CopyBtn text={toDiscordTs(endDate, "F")} label="📋" th={th} />
            </div>
          </div>
        )}

        {entry.notes && (
          <div style={{ fontSize: 12, color: th.textMid, fontStyle: "italic", marginTop: 4 }}>
            "{entry.notes}"
          </div>
        )}
        <div style={{ fontSize: 11, color: th.textFaint, marginTop: 4 }}>Registered {entry.date}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={() => onEdit(entry)} style={{ background: "transparent", border: "none",
          fontSize: 16, cursor: "pointer", padding: "2px 4px" }} title="Edit">✏️</button>
        <button onClick={() => onDelete(entry.id)} style={{ background: "transparent", border: "none",
          fontSize: 16, cursor: "pointer", padding: "2px 4px" }} title="Delete">🗑️</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS VIEW — reworked + theme picker
// ─────────────────────────────────────────────────────────────
function AnalyticsView({ th, analytics, log }) {
  const { total, completed, active, byType, bySize, streak, longestStreak,
    avgPerWeek, completionRate, bestDay, topType, recentWeeks, recentMonths } = analytics;

  const maxWeek  = Math.max(...(recentWeeks.map(([, v]) => v)), 1);
  const maxMonth = Math.max(...(recentMonths.map(([, v]) => v)), 1);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="fade-in">

      {log.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: th.textFaint }}>
          <PikminLogo size={56} /><br /><br />Register some mushrooms to see analytics!
        </div>
      ) : (
        <>
          {/* Stat grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Total Logged",     value: total,              icon: "🍄", color: th.accent },
              { label: "Completed",        value: completed,          icon: "✅", color: th.positive },
              { label: "In Progress",      value: active,             icon: "⏳", color: "#fb923c"  },
              { label: "Completion Rate",  value: `${completionRate}%`, icon: "📈", color: "#38bdf8"  },
              { label: "Days Streak",      value: `${streak}d`,       icon: "🔥", color: "#f97316"  },
              { label: "Longest Streak",   value: `${longestStreak}d`, icon: "🏆", color: "#fde68a"  },
              { label: "Avg / Week",       value: avgPerWeek,         icon: "📅", color: "#c084fc"  },
              { label: "Most Active Day",  value: bestDay || "—",     icon: "📆", color: "#4ade80"  },
            ].map(s => (
              <div key={s.label} style={{ background: th.surface, border: `1px solid ${th.border}`,
                borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: th.textFaint, fontWeight: 700, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Type breakdown */}
          <div style={{ background: th.surface, border: `1px solid ${th.border}`,
            borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: th.textMid, marginBottom: 12, letterSpacing: 0.5 }}>
              🍄 By Type
            </div>
            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([typeId, count]) => {
              const t = MUSHROOM_TYPES.find(x => x.id === typeId);
              return (
                <div key={typeId} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 16, width: 24, flexShrink: 0 }}>{t?.emoji}</span>
                  <span style={{ fontSize: 13, color: th.accent, width: 64, flexShrink: 0 }}>{t?.label || typeId}</span>
                  <MiniBar value={count} max={total} color={t?.color || th.accent} th={th} />
                  <span style={{ fontSize: 13, color: th.textMid, width: 24, textAlign: "right", flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Size breakdown */}
          {Object.keys(bySize).length > 0 && (
            <div style={{ background: th.surface, border: `1px solid ${th.border}`,
              borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: th.textMid, marginBottom: 12 }}>📏 By Size</div>
              {SIZES.filter(s => bySize[s]).map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, width: 60, color: th.textMid, flexShrink: 0 }}>
                    {SIZE_EMOJI[s]} {s}
                  </span>
                  <MiniBar value={bySize[s] || 0} max={total} color={th.accentDark} th={th} />
                  <span style={{ fontSize: 13, color: th.textMid, width: 24, textAlign: "right", flexShrink: 0 }}>
                    {bySize[s] || 0}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Weekly bar chart */}
          {recentWeeks.length > 0 && (
            <div style={{ background: th.surface, border: `1px solid ${th.border}`,
              borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: th.textMid, marginBottom: 12 }}>📅 Weekly</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
                {recentWeeks.map(([week, count]) => (
                  <div key={week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, color: th.accent, fontWeight: 700 }}>{count}</span>
                    <div style={{ width: "100%", borderRadius: "4px 4px 0 0", minHeight: 4,
                      height: `${(count / maxWeek) * 64}px`, background: th.accentGrad }} />
                    <span style={{ fontSize: 9, color: th.textFaint, whiteSpace: "nowrap",
                      transform: "rotate(-40deg)", transformOrigin: "top center", marginTop: 4 }}>
                      {`W${week.split("-W")[1] || week}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly */}
          {recentMonths.length > 0 && (
            <div style={{ background: th.surface, border: `1px solid ${th.border}`,
              borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: th.textMid, marginBottom: 12 }}>🗓 Monthly</div>
              {recentMonths.map(([month, count]) => (
                <div key={month} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: th.textMid, width: 48, flexShrink: 0 }}>
                    {month.slice(5)}/{month.slice(2, 4)}
                  </span>
                  <MiniBar value={count} max={maxMonth} color={th.accentDark} th={th} />
                  <span style={{ fontSize: 12, color: th.accent, width: 24, textAlign: "right", flexShrink: 0 }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS VIEW
// ─────────────────────────────────────────────────────────────
function SettingsView({ th, themeId, applyTheme, user }) {
  return (
    <div className="fade-in">

      {/* Account */}
      <div style={{ background: th.surface, border: `1px solid ${th.border}`,
        borderRadius: 16, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: th.textMid,
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
          👤 Account
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%",
            background: th.accentGrad, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
            {user?.photoURL
              ? <img src={user.photoURL} style={{ width: 48, height: 48, borderRadius: "50%" }} alt="" />
              : "🍄"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: th.text }}>
              {user?.displayName || "Trainer"}
            </div>
            <div style={{ fontSize: 12, color: th.textFaint }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={() => signOut(auth)} style={{
          width: "100%", padding: "11px", background: th.surfaceAlt,
          border: `1.5px solid ${th.border}`, borderRadius: 12,
          color: th.textMid, fontWeight: 800, fontSize: 14,
          cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
        }}>
          Sign Out
        </button>
      </div>

      {/* Notifications */}
      <NotifSetting th={th} />

      {/* Theme picker */}
      <div style={{ background: th.surface, border: `1px solid ${th.border}`,
        borderRadius: 16, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: th.textMid,
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
          🎨 Theme
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Object.values(THEMES).map(t => {
            const active = themeId === t.id;
            return (
              <button key={t.id} onClick={() => applyTheme(t.id)} style={{
                padding: "14px 12px", borderRadius: 14, fontFamily: "inherit",
                fontWeight: 800, cursor: "pointer", transition: "all 0.2s",
                border: `2px solid ${active ? t.accent : th.border}`,
                background: active ? `${t.accent}22` : th.surfaceAlt,
                boxShadow: active ? `0 0 16px ${t.accentGlow}` : "none",
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
              }}>
                {/* Mini preview swatch */}
                <div style={{ display: "flex", gap: 4, marginBottom: 2 }}>
                  {[t.bg, t.surface, t.accent, t.accentDark].map((c, i) => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 4,
                      background: c, border: `1px solid ${t.border}` }} />
                  ))}
                </div>
                <div style={{ fontSize: 18 }}>{t.emoji}</div>
                <div style={{ fontSize: 13, color: active ? t.accent : th.textMid }}>{t.label}</div>
                {active && (
                  <div style={{ fontSize: 10, color: t.accent, fontWeight: 900 }}>✓ Active</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* App info */}
      <div style={{ background: th.surface, border: `1px solid ${th.border}`,
        borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: th.textMid,
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
          ℹ️ About
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <PikminLogo size={40} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: th.text }}>Shroom Log</div>
            <div style={{ fontSize: 12, color: th.textFaint }}>Pikmin Bloom Mushroom Tracker</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: th.textFaint, lineHeight: 1.7 }}>
          Track your Pikmin Bloom mushroom battles, share Discord timestamps with your squad,
          and never miss an end time again.
        </div>
      </div>
    </div>
  );
}

function NotifSetting({ th }) {
  const [status, setStatus] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );

  async function request() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setStatus(p);
  }

  const label = status === "granted"   ? "✅ Notifications enabled"
              : status === "denied"    ? "🚫 Blocked by browser — enable in browser settings"
              : status === "unsupported" ? "⚠️ Not supported in this browser"
              : "🔔 Enable Notifications";

  return (
    <div style={{ background: th.surface, border: `1px solid ${th.border}`,
      borderRadius: 16, padding: 20, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: th.textMid,
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
        🔔 Notifications
      </div>
      <div style={{ fontSize: 13, color: th.textFaint, marginBottom: 12, lineHeight: 1.6 }}>
        Get a reminder 5 minutes before a mushroom ends.
      </div>
      <button
        onClick={request}
        disabled={status === "granted" || status === "denied" || status === "unsupported"}
        style={{
          width: "100%", padding: "11px", borderRadius: 12, fontFamily: "inherit",
          fontWeight: 800, fontSize: 14, cursor: status === "default" ? "pointer" : "default",
          border: `1.5px solid ${status === "granted" ? th.positive : th.border}`,
          background: status === "granted" ? `${th.positive}22` : th.surfaceAlt,
          color: status === "granted" ? th.positive : th.textMid,
          transition: "all 0.2s",
        }}>
        {label}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GLOBAL CSS
// ─────────────────────────────────────────────────────────────
function globalCss(th) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${th.bg}; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: ${th.border}; border-radius: 99px; }
    input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
    input[type=datetime-local]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .fade-in { animation: fadeIn 0.3s ease both; }
    @media (max-width: 380px) { .nav-label { display: none; } }
  `;
}
