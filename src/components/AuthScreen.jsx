// src/components/AuthScreen.jsx
import { useState } from "react";
import { auth, googleProvider } from "../firebase";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { PikminLogo } from "../App";

export default function AuthScreen() {
  const [mode, setMode]       = useState("login"); // "login" | "signup"
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(friendlyError(e.code));
    }
    setLoading(false);
  }

  async function handleEmail() {
    if (!email || !password) { setError("Please enter email and password."); return; }
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(friendlyError(e.code));
    }
    setLoading(false);
  }

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Background blobs */}
      <div style={S.blob1} /><div style={S.blob2} />

      <div style={S.card}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <PikminLogo size={68} />
          <div style={S.title}>Shroom Log</div>
          <div style={S.subtitle}>Pikmin Bloom Tracker</div>
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading} style={S.googleBtn}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.6 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.6 29.2 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.1-11.3-7.6L6 33.3C9.4 39.6 16.1 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.2 5.2C40.8 35.4 44 30.1 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Continue with Google
        </button>

        <div style={S.divider}><span>or</span></div>

        {/* Email + password */}
        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          style={S.input}
        />
        <input
          type="password" placeholder="Password (min 6 chars)" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleEmail()}
          style={{ ...S.input, marginTop: 10 }}
        />

        {error && <div style={S.error}>{error}</div>}

        <button onClick={handleEmail} disabled={loading} style={S.submitBtn}>
          {loading ? "Loading…" : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div style={S.switchRow}>
          {mode === "login" ? "Don't have an account? " : "Already have one? "}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            style={S.switchBtn}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function friendlyError(code) {
  const map = {
    "auth/invalid-email":            "Invalid email address.",
    "auth/user-not-found":           "No account found with this email.",
    "auth/wrong-password":           "Incorrect password.",
    "auth/email-already-in-use":     "An account with this email already exists.",
    "auth/weak-password":            "Password must be at least 6 characters.",
    "auth/popup-closed-by-user":     "Sign-in popup was closed.",
    "auth/network-request-failed":   "Network error. Check your connection.",
    "auth/invalid-credential":       "Incorrect email or password.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

const S = {
  page: {
    minHeight: "100vh", background: "#0d0820",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24, fontFamily: "'Nunito', system-ui, sans-serif",
    position: "relative", overflow: "hidden",
  },
  blob1: { position: "fixed", width: 400, height: 400, borderRadius: "50%",
    background: "radial-gradient(circle, #4c1d9522, transparent 70%)",
    top: -150, right: -120, pointerEvents: "none" },
  blob2: { position: "fixed", width: 300, height: 300, borderRadius: "50%",
    background: "radial-gradient(circle, #1e3a5f22, transparent 70%)",
    bottom: 60, left: -80, pointerEvents: "none" },
  card: {
    background: "#100826", border: "1px solid #2d2050", borderRadius: 24,
    padding: 32, width: "100%", maxWidth: 380,
    boxShadow: "0 0 48px #7c3aed22", position: "relative", zIndex: 1,
  },
  title: { fontSize: 26, fontWeight: 900, color: "#c4b5fd", marginTop: 12 },
  subtitle: { fontSize: 13, color: "#4a3d6a", marginTop: 4, fontWeight: 700 },
  googleBtn: {
    width: "100%", padding: "13px 16px", background: "#fff",
    border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800,
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 10, fontFamily: "inherit",
    boxShadow: "0 2px 12px rgba(0,0,0,0.3)", transition: "opacity 0.2s",
  },
  divider: {
    textAlign: "center", color: "#2d2050", fontSize: 12,
    margin: "18px 0", fontWeight: 700,
    display: "flex", alignItems: "center", gap: 10,
    "::before": { content: '""', flex: 1, height: 1, background: "#2d2050" },
  },
  input: {
    width: "100%", background: "#160f30", border: "1.5px solid #2d2050",
    borderRadius: 12, color: "#e9d5ff", padding: "11px 14px",
    fontSize: 14, fontFamily: "inherit", colorScheme: "dark",
    display: "block",
  },
  error: {
    color: "#fc8181", fontSize: 12, marginTop: 10,
    background: "#2d0a0a", borderRadius: 8, padding: "8px 12px",
  },
  submitBtn: {
    width: "100%", padding: "13px", marginTop: 14,
    background: "linear-gradient(135deg, #6d28d9, #a855f7)",
    border: "none", borderRadius: 14, color: "#fff",
    fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 20px #7c3aed44", transition: "opacity 0.2s",
  },
  switchRow: {
    textAlign: "center", marginTop: 18, fontSize: 13,
    color: "#4a3d6a", fontWeight: 600,
  },
  switchBtn: {
    background: "none", border: "none", color: "#a78bfa",
    fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13,
  },
};
