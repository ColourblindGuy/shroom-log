# 🍄 Shroom Log

A mushroom battle tracker for **Pikmin Bloom** — built with React, Vite, and Firebase.

Track your active battles, share Discord timestamps with your squad, and keep a permanent history of every mushroom you've conquered.

---

## ✨ Features

- **Battle registration** — log any mushroom type with workload, strength, size, stars, and player count
- **End time calculator** — enter the exact workload and everyone's strength to get a precise end time
- **Live countdown** — real-time timer on all in-progress battles
- **Discord timestamps** — one-tap copy of `<t:UNIX:F>` format that auto-converts to each person's local timezone
- **Tabbed history** — In Progress and Completed in separate tabs, each independently searchable and filterable
- **Analytics** — streak, completion rate, avg per week, best day of week, type and size breakdowns, weekly and monthly charts
- **6 themes** — Midnight 🌙, Forest 🌿, Sakura 🌸, Ocean 🌊, Sunset 🌅, Daytime ☀️
- **Developer announcements** — dismissible banners posted from Firebase Console
- **Cloud sync** — data lives in Firestore, accessible from any device
- **Google + Email auth** — sign in with Google or email/password
- **Notifications** — browser reminder 5 minutes before a mushroom ends
- **Responsive layout** — bottom nav on mobile, sidebar on desktop
- **PWA-ready** — installable on iPhone via Safari → Add to Home Screen

---

## 🗂 Project Structure

```
shroom-log/
├── index.html                  # HTML entry point with PWA meta tags
├── vite.config.js              # Vite config (PWA plugin commented, ready to enable)
├── .env                        # Your Firebase credentials (never commit this)
├── .env.example                # Template — copy to .env and fill in values
├── firestore.rules             # Firestore security rules — paste into Firebase Console
│
└── src/
    ├── main.jsx                # React entry point
    ├── App.jsx                 # Everything: components, logic, styles, themes
    ├── firebase.js             # Firebase app initialization
    │
    ├── api/
    │   ├── logs.js             # Firestore CRUD for mushroom log entries
    │   └── announcements.js    # Firestore reads for developer announcements
    │
    ├── hooks/
    │   └── useWindowSize.js    # Responsive breakpoint hook (mobile/tablet/desktop)
    │
    └── components/
        └── AuthScreen.jsx      # Login / signup screen
```

> **Note:** `AuthScreen.jsx` needs to be recreated in `src/components/` — see Setup below.

---

## 🚀 Setup from Scratch

### Prerequisites

- Node.js 18+ installed — check with `node --version`
- A Firebase account — free at [console.firebase.google.com](https://console.firebase.google.com)
- A Vercel account connected to your GitHub — free at [vercel.com](https://vercel.com)

---

### Step 1 — Create the Vite project

```bash
npm create vite@latest shroom-log -- --template react
cd shroom-log
npm install
npm install firebase
```

---

### Step 2 — Place the files

Replace or create files as follows:

| File | Action |
|------|--------|
| `index.html` | Replace the default |
| `vite.config.js` | Replace the default |
| `src/main.jsx` | Replace the default |
| `src/App.jsx` | Replace the default |
| `src/firebase.js` | Create new |
| `src/api/logs.js` | Create folder + file |
| `src/api/announcements.js` | Create file |
| `src/hooks/useWindowSize.js` | Create folder + file |
| `src/components/AuthScreen.jsx` | Create folder + file |

Delete these default Vite files — they're not needed:

```bash
rm src/App.css src/index.css src/assets/react.svg public/vite.svg
```

---

### Step 3 — Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `shroom-log` → Create
3. Click the **web icon** (`</>`) → name the app `shroom-log-web` → Register
4. Copy the config object shown — you'll need it in the next step

**Enable Firestore:**
- Sidebar → **Firestore Database** → Create database
- Choose **Start in test mode** → pick your nearest region → Enable

**Enable Authentication:**
- Sidebar → **Authentication** → Get started
- **Sign-in method** tab → enable **Google** (set a support email) → Save
- Also enable **Email/Password**

**Add your Vercel domain:**
- **Authentication** → **Settings** → **Authorized domains**
- Click **Add domain** → paste your Vercel URL (e.g. `shroom-log.vercel.app`)
- This is required — Google login will fail on Vercel without this step

---

### Step 4 — Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

Open `.env` and fill in your Firebase values:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

`.env` is already in `.gitignore` by default in Vite — never commit it.

---

### Step 5 — Add Firestore security rules

1. Firebase Console → **Firestore Database** → **Rules** tab
2. Replace everything with the contents of `firestore.rules`
3. Click **Publish**

This ensures users can only read/write their own data, and announcements are read-only from the client.

---

### Step 6 — Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — hot-reloads on every save.

---

### Step 7 — Deploy to Vercel

**Add environment variables to Vercel:**
1. Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add each `VITE_FIREBASE_*` variable from your `.env` file
3. Make sure to select all environments (Production, Preview, Development)

**Push to deploy:**

```bash
git add .
git commit -m "initial deploy"
git push
```

Vercel auto-deploys on every push. Your app will be live at `your-project.vercel.app`.

---

### Step 8 — Install on iPhone

1. Open your Vercel URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (box with arrow pointing up)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app opens full-screen with no browser chrome, like a native app.

---

## ⚔️ How the Time Calculation Works

```
duration (seconds) = (workload / everyone's strength) × 100
```

**Critical:** use the **exact workload number** shown on your mushroom's screen in-game, not an estimate. The size presets (Small ~265K, Normal ~531K, Large ~2.6M, Giant ~9.2M) are approximate starting points — always replace them with the real value.

**Example:**
- Workload: `630,000` · Strength: `875`
- Duration: `(630000 / 875) × 100 = 72,000 seconds = 20 hours` ✅

**Daylight saving time** is handled automatically — all times are stored as Unix timestamps (absolute milliseconds) and displayed using the device's current timezone. Discord `<t:UNIX:F>` timestamps also handle DST per-viewer automatically.

---

## 🍄 Mushroom Types

### Regular (any Pikmin)
| Type | Color |
|------|-------|
| Red | 🔴 |
| Yellow | 🟡 |
| Blue | 🔵 |
| Purple | 🟣 |
| White | ⚪ |
| Pink | 🩷 |
| Grey | 🩶 |
| Teal | 🩵 |

### Elemental (specific Pikmin for bonus)
| Type | Best Pikmin |
|------|------------|
| Fire 🔥 | Red only |
| Water 💧 | Blue only |
| Electric ⚡ | Yellow |
| Poison ☠️ | White only |
| Crystal 💎 | Rock only |

### Event
| Type | Notes |
|------|-------|
| Brilliant ✨ | Rare, higher rewards |
| Giant 🌟 | Needs group effort |
| Event 🎉 | Limited-time |

**To add a new mushroom type:** open `src/App.jsx`, find the `MUSHROOM_TYPES` array, and append a new object. No other changes needed.

```js
{ id:"new", label:"New Type", emoji:"🆕", color:"#hex", glow:"#hex44",
  textColor:"#fff", category:"event", pikmin:"Any", desc:"Description here" },
```

---

## 🎨 Themes

Themes are selected in the **Settings** tab and persisted to `localStorage`.

| Theme | Style |
|-------|-------|
| 🌙 Midnight | Deep purple — default |
| 🌿 Forest | Dark green |
| 🌸 Sakura | Deep rose/pink |
| 🌊 Ocean | Dark navy/cyan |
| 🌅 Sunset | Dark amber/orange |
| ☀️ Daytime | Bright light mode, indigo accents |

**To add a new theme:** open `src/App.jsx`, find the `THEMES` object, and add a new entry following the same shape as existing themes.

---

## 📣 Developer Announcements

Announcements appear as a dismissible banner at the top of the app for all logged-in users. They're posted manually from the Firebase Console — no admin panel needed.

**To post an announcement:**

1. Firebase Console → **Firestore Database**
2. Click **+ Start collection** (first time) or click the `announcements` collection
3. Click **+ Add document** → use **Auto-ID**
4. Add these fields:

| Field | Type | Value |
|-------|------|-------|
| `title` | string | New event mushrooms! |
| `body` | string | Brilliant mushrooms are back this weekend 🎉 |
| `createdAt` | timestamp | (click the timestamp option, set to now) |
| `priority` | number | `1` = normal, `2` = important (shows orange) |

5. Click **Save**

Users see the banner immediately on next load. Each user can dismiss it individually — dismissal state is stored in their browser's `localStorage`.

---

## 🔐 Firestore Data Schema

```
users/
  {userId}/
    logs/
      {logId}/
        mushroomType    string      "fire"
        size            string      "Normal"
        stars           string      "⭐⭐⭐"
        players         number      2
        workload        number      630000
        strength        number      875
        notes           string      "Park near the library"
        startTime       string      "2025-05-10T14:30"
        endTime         number      1746123000000   (Unix ms)
        registeredAt    number      1746050000000   (Unix ms)
        date            string      "May 10, 02:30 PM"
        createdAt       timestamp   (server timestamp)

announcements/
  {announcementId}/
    title       string
    body        string
    createdAt   timestamp
    priority    number
```

---

## 📱 PWA / App Store Roadmap

### Phase 1 — PWA (current)
The app is already PWA-ready. To enable full offline support and install prompts:

```bash
npm install vite-plugin-pwa
```

Then open `vite.config.js` and uncomment the `VitePWA(...)` block. Add `icon-192.png` and `icon-512.png` to the `public/` folder.

### Phase 2 — Native iOS via Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Shroom Log" "com.yourname.shroomlog"
npm run build
npx cap add ios
npx cap sync
npx cap open ios   # opens Xcode
```

Requirements: Mac with Xcode, Apple Developer account ($99/year), 1024×1024 app icon.

### Phase 3 — Android via Capacitor

```bash
npx cap add android
npx cap open android   # opens Android Studio
```

Requirements: Android Studio (free), Google Play Developer account ($25 one-time).

---

## 🛠 Development Reference

### Common commands

```bash
npm run dev        # start local dev server at localhost:5173
npm run build      # build for production → dist/
npm run preview    # preview the production build locally
git add . && git commit -m "message" && git push   # deploy to Vercel
```

### Key files to edit

| What you want to change | File |
|------------------------|------|
| Mushroom types | `src/App.jsx` → `MUSHROOM_TYPES` array |
| Themes | `src/App.jsx` → `THEMES` object |
| Size HP approximations | `src/App.jsx` → `SIZE_HP_APPROX` |
| Auth screen UI | `src/components/AuthScreen.jsx` |
| Firestore queries | `src/api/logs.js` |
| Announcement loading | `src/api/announcements.js` |
| Responsive breakpoints | `src/hooks/useWindowSize.js` |
| Firebase config | `src/firebase.js` + `.env` |
| PWA manifest | `vite.config.js` |
| Security rules | `firestore.rules` → Firebase Console |

### Environment variables (all required)

| Variable | Where to find it |
|----------|-----------------|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same |
| `VITE_FIREBASE_PROJECT_ID` | Same |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same |
| `VITE_FIREBASE_APP_ID` | Same |

---

## 🐛 Common Issues

**Google login works locally but fails on Vercel**
→ Firebase Console → Authentication → Settings → Authorized domains → Add your `.vercel.app` URL

**"Something went wrong" on login**
→ Check browser console for the Firebase error code. Most common: wrong API key in Vercel env vars, or missing authorized domain.

**Data not syncing across devices**
→ Make sure you're signed in with the same account on both devices. Data is per-user in Firestore.

**App zooms in when tapping an input on iPhone**
→ All inputs use `font-size: 16px` — iOS only zooms when font-size is below 16px. If you add new inputs, keep them at 16px.

**End time is wrong**
→ Use the exact workload number from your game screen, not the size preset. The preset is just an approximation.

**Notifications don't work after closing the app**
→ Browser notifications require the tab to be open. For true background notifications, a service worker + Web Push API integration is needed (future roadmap item).

---

## 📄 License

Personal project — not affiliated with Nintendo or Niantic.
Pikmin Bloom is a trademark of Nintendo / Niantic.
All mushroom type data is based on community research from Pikipedia.
