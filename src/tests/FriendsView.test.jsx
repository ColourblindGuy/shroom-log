import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock factories are hoisted to top ──

const mockFriendsApi = vi.hoisted(() => ({
  initProfile: vi.fn(() => Promise.resolve({
    displayName: "TestTrainer",
    friendCode: "ABC123",
    createdAt: { toDate: () => new Date() },
    lastSeen: { toDate: () => new Date() },
  })),
  updateDisplayName: vi.fn(),
  findByFriendCode: vi.fn(),
  removeFriend: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  subscribeSentRequests: vi.fn(() => () => {}),
  subscribeFriends: vi.fn(() => () => {}),
  declineMushroomInvite: vi.fn(),
  acceptMushroomInvite: vi.fn(),
}));

// ── Mock theme constants from App ──
vi.mock("../App", () => ({
  MUSHROOM_TYPES: [
    { id: "red", label: "Red", emoji: "🔴", color: "#e05252", glow: "#e0525244", textColor: "#fff",
      category: "regular", pikmin: "Any", desc: "Standard red mushroom" },
  ],
  SIZE_EMOJI: { Small: "🍄", Normal: "🍄🍄", Large: "🍄🍄🍄", Giant: "🍄🍄🍄🍄" },
  formatDuration: (ms) => {
    if (!ms || ms <= 0) return "Done!";
    const s = Math.floor(Math.abs(ms) / 1000);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${h}h ${m}m ${sc}s`;
  },
}));

// ── Mock firestore/auth ──
vi.mock("firebase/firestore", () => ({
  doc: () => ({ _id: "", _path: [] }),
  collection: () => ({ _id: "", _path: [] }),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(() => ({ docs: [], empty: true, forEach: () => {} })),
  addDoc: vi.fn(),
  serverTimestamp: () => ({ _isTimestamp: true, toDate: () => new Date() }),
  onSnapshot: vi.fn(() => () => {}),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: null }),
  GoogleAuthProvider: class GoogleAuthProvider {},
}));

vi.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-uid", displayName: "TestTrainer" } },
  googleProvider: {},
}));

vi.mock("../api/friends", () => mockFriendsApi);

const MOCK_THEME = {
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
};

const MOCK_USER = {
  uid: "test-uid",
  displayName: "TestTrainer",
  email: "test@test.com",
  photoURL: null,
};

describe("FriendsView", () => {
  let FriendsView;

  beforeAll(async () => {
    FriendsView = (await import("../components/FriendsView")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderView(overrides = {}) {
    return render(
      <FriendsView
        th={MOCK_THEME}
        user={MOCK_USER}
        friendRequests={[]}
        {...overrides}
      />
    );
  }

  it("renders loading state initially", () => {
    mockFriendsApi.initProfile.mockImplementationOnce(() => new Promise(() => {}));

    renderView();
    expect(screen.getByText("Loading…")).toBeDefined();
  });

  it("renders profile card with friend code after load", async () => {
    renderView();

    expect(await screen.findByText("👤 My Profile")).toBeDefined();
    expect(screen.getByText("TestTrainer")).toBeDefined();
    expect(screen.getByText("test@test.com")).toBeDefined();
    expect(screen.getByText("🔑 Your Friend Code — share this so others can add you")).toBeDefined();
    expect(screen.getByText("ABC123")).toBeDefined();
    expect(screen.getByText("Copy")).toBeDefined();
  });

  it("renders friends tab with empty state when no friends", async () => {
    renderView();

    expect(await screen.findByText("👥 Friends")).toBeDefined();
    expect(screen.getByText("No friends yet!")).toBeDefined();
    expect(screen.getByText("Search for their code above.")).toBeDefined();
  });

  it("renders add friend section", async () => {
    renderView();

    expect(await screen.findByText("➕ Add Friend")).toBeDefined();
    expect(screen.getByPlaceholderText("Enter code (e.g. ABC123)")).toBeDefined();
    expect(screen.getByText("Find")).toBeDefined();
  });

  it("shows a friend in the list when friends are provided", async () => {
    mockFriendsApi.subscribeFriends.mockImplementation((uid, cb) => {
      cb([{ uid: "friend-1", displayName: "Buddy", friendCode: "XYZ789" }]);
      return () => {};
    });

    renderView();

    expect(await screen.findByText("Buddy")).toBeDefined();
    expect(screen.getByText("XYZ789")).toBeDefined();
    expect(screen.getByText("Remove")).toBeDefined();
  });

  it("switches to notifications tab and shows empty state", async () => {
    renderView();

    const notifTab = await screen.findByText("🔔 Requests Pending");
    expect(notifTab).toBeDefined();

    await userEvent.click(notifTab);
    expect(screen.getByText("No pending notifications.")).toBeDefined();
  });

  it("shows pending friend requests in notifications tab", async () => {
    renderView({
      friendRequests: [
        { fromUid: "req-1", fromName: "Requestor", fromCode: "REQ123", status: "pending" },
      ],
    });

    const notifTab = await screen.findByText("🔔 Requests Pending");
    await userEvent.click(notifTab);

    expect(screen.getByText("Requestor")).toBeDefined();
    expect(screen.getByText(/Code:/)).toBeDefined();
    expect(screen.getByText("✓ Accept")).toBeDefined();
    expect(screen.getByText("✕ Decline")).toBeDefined();
  });

  it("shows friend request badge count on friends tab button", async () => {
    renderView({
      friendRequests: [
        { fromUid: "req-1", fromName: "Requestor", fromCode: "REQ123", status: "pending" },
        { fromUid: "req-2", fromName: "Requestor2", fromCode: "REQ456", status: "pending" },
      ],
    });

    const badges = await screen.findAllByText("2");
    expect(badges.length).toBe(2);
  });

  it("allows copying friend code to clipboard", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });

    renderView();

    const copyBtn = await screen.findByText("Copy");
    await userEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ABC123");
    expect(await screen.findByText("✓ Copied!")).toBeDefined();
  });

  it("calls removeFriend when remove is clicked", async () => {
    mockFriendsApi.subscribeFriends.mockImplementation((uid, cb) => {
      cb([{ uid: "friend-1", displayName: "Buddy", friendCode: "XYZ789" }]);
      return () => {};
    });

    renderView();
    expect(await screen.findByText("Buddy")).toBeDefined();

    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    await userEvent.click(screen.getByText("Remove"));

    expect(mockFriendsApi.removeFriend).toHaveBeenCalledWith("friend-1");

    window.confirm = originalConfirm;
  });

  it("does not call removeFriend when confirm is cancelled", async () => {
    mockFriendsApi.subscribeFriends.mockImplementation((uid, cb) => {
      cb([{ uid: "friend-1", displayName: "Buddy", friendCode: "XYZ789" }]);
      return () => {};
    });

    renderView();
    expect(await screen.findByText("Buddy")).toBeDefined();

    window.confirm = vi.fn(() => false);

    await userEvent.click(screen.getByText("Remove"));

    expect(mockFriendsApi.removeFriend).not.toHaveBeenCalled();
  });
});
