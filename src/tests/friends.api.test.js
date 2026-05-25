import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock firestore data store ──

const mockData = {};
const mockListeners = {};

function resetMockData() {
  Object.keys(mockData).forEach(k => delete mockData[k]);
  Object.keys(mockListeners).forEach(k => delete mockListeners[k]);
}

function read(path) {
  let d = mockData;
  for (const p of path) {
    if (!d || !(p in d)) return undefined;
    d = d[p];
  }
  return d;
}

function write(path, value) {
  let d = mockData;
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i];
    if (!d[p] || typeof d[p] !== "object") d[p] = {};
    d = d[p];
  }
  d[path[path.length - 1]] = value;
}

function del(path) {
  let d = mockData;
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i];
    if (!d || !(p in d)) return;
    d = d[p];
  }
  delete d[path[path.length - 1]];
}

function trigger(path) {
  const key = path.join("/");
  (mockListeners[key] || []).forEach(fn => {
    const d = read(path);
    const docs = Object.entries(d || {}).map(([id, val]) => ({
      id,
      data: () => ({ ...val }),
      exists: () => true,
    }));
    fn({ docs, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) });
  });
}

// Helper: extract path segments from firebase doc/collection arguments
// Real firebase supports:
//   doc(db, "col", "doc")       — first arg is db instance
//   doc(ref, "doc")             — first arg is a collection/doc ref with _path
//   doc({ _path: [...] })       — test convenience
function extractPath(...args) {
  // Support passing { _path: [...] } for test convenience
  if (args.length === 1 && args[0] && args[0]._path) {
    return args[0]._path;
  }
  const first = args[0];
  const rest = args.slice(1);
  // If first arg has _path, it's a ref — expand its path and append remaining
  if (first && first._path) {
    return [...first._path, ...rest.map(a => String(a))];
  }
  // Otherwise first arg is the db instance — skip it
  return rest.map(a => String(a));
}

vi.mock("firebase/firestore", () => ({
  doc: (...args) => {
    const path = extractPath(...args);
    return { _id: path[path.length - 1], _path: path };
  },
  collection: (...args) => {
    const path = extractPath(...args);
    return { _id: path[path.length - 1], _path: path };
  },
  getDoc: async (ref) => {
    const d = globalThis.__mockRead(ref._path);
    return {
      exists: () => d !== undefined && d !== null && typeof d === "object",
      data: () => (d !== undefined && d !== null && typeof d === "object" ? { ...d } : null),
      id: ref._path[ref._path.length - 1],
    };
  },
  getDocs: async (ref) => {
    const d = globalThis.__mockRead(ref._path);
    const entries = Object.entries(d || {});
    const docs = entries.map(([id, val]) => ({
      id,
      data: () => ({ ...val }),
      exists: () => true,
    }));
    return { docs, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
  },
  setDoc: async (ref, value) => {
    globalThis.__mockWrite(ref._path, { ...value });
    globalThis.__mockTrigger(ref._path.slice(0, -1));
  },
  updateDoc: async (ref, value) => {
    const d = globalThis.__mockRead(ref._path);
    if (d && typeof d === "object") {
      globalThis.__mockWrite(ref._path, { ...d, ...value });
    }
    globalThis.__mockTrigger(ref._path.slice(0, -1));
  },
  deleteDoc: async (ref) => {
    globalThis.__mockDelete(ref._path);
    globalThis.__mockTrigger(ref._path.slice(0, -1));
  },
  addDoc: async (colRef, value) => {
    const id = "auto-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const path = [...colRef._path, id];
    globalThis.__mockWrite(path, { ...value });
    globalThis.__mockTrigger(colRef._path);
    return { id };
  },
  serverTimestamp: () => ({
    _isTimestamp: true,
    toDate: () => new Date(),
    seconds: Math.floor(Date.now() / 1000),
  }),
  onSnapshot: (ref, callback) => {
    const key = ref._path.join("/");
    if (!mockListeners[key]) mockListeners[key] = [];
    const wrapped = () => {
      const d = globalThis.__mockRead(ref._path);
      const docs = Object.entries(d || {}).map(([id, val]) => ({
        id,
        data: () => ({ ...val }),
        exists: () => true,
      }));
      callback({ docs, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) });
    };
    mockListeners[key].push(wrapped);
    return () => {
      mockListeners[key] = mockListeners[key].filter(f => f !== wrapped);
    };
  },
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: null }),
  GoogleAuthProvider: class GoogleAuthProvider {},
}));

vi.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-user-uid", displayName: "TestTrainer", email: "test@test.com" } },
  googleProvider: {},
}));

describe("Friends API", () => {
  let api;

  beforeEach(() => {
    resetMockData();
    globalThis.__mockRead = read;
    globalThis.__mockWrite = write;
    globalThis.__mockDelete = del;
    globalThis.__mockTrigger = trigger;
  });

  afterEach(() => {
    delete globalThis.__mockRead;
    delete globalThis.__mockWrite;
    delete globalThis.__mockDelete;
    delete globalThis.__mockTrigger;
  });

  beforeAll(async () => {
    api = await import("../api/friends");
  });

  describe("initProfile", () => {
    it("creates a profile with a friend code when none exists", async () => {
      const user = { uid: "new-user", displayName: "NewPlayer", email: "new@test.com" };
      const profile = await api.initProfile(user);

      expect(profile).toBeDefined();
      expect(profile.displayName).toBe("NewPlayer");
      expect(profile.friendCode).toBeDefined();
      expect(profile.friendCode.length).toBe(6);

      const fs = await import("firebase/firestore");
      const codeSnap = await fs.getDoc(fs.doc({ _path: ["friend_codes", profile.friendCode] }));
      expect(codeSnap.exists()).toBe(true);
      expect(codeSnap.data().uid).toBe("new-user");
    });

    it("returns existing profile without overwriting", async () => {
      const user = { uid: "existing-user", displayName: "Existing", email: "existing@test.com" };
      await api.initProfile(user);
      const profile = await api.initProfile(user);

      expect(profile.displayName).toBe("Existing");
      expect(profile.friendCode).toBeDefined();
      expect(profile.friendCode.length).toBe(6);
    });
  });

  describe("findByFriendCode", () => {
    it("returns null for non-existent codes", async () => {
      expect(await api.findByFriendCode("ZZZZZZ")).toBeNull();
    });

    it("finds a user by their friend code", async () => {
      const user = { uid: "find-me", displayName: "Findable" };
      await api.initProfile(user);

      const fs = await import("firebase/firestore");
      const profileSnap = await fs.getDoc(fs.doc({ _path: ["users", "find-me", "profile", "data"] }));
      const code = profileSnap.data().friendCode;

      const found = await api.findByFriendCode(code);
      expect(found).toBeDefined();
      expect(found.uid).toBe("find-me");
      expect(found.displayName).toBe("Findable");
    });
  });

  describe("sendFriendRequest", () => {
    it("creates request docs on both sides", async () => {
      const sender = { uid: "sender-uid", displayName: "Sender" };
      const receiver = { uid: "receiver-uid", displayName: "Receiver", friendCode: "RCD123" };

      await api.initProfile(sender);

      const fb = await import("../firebase");
      fb.auth.currentUser = { uid: "sender-uid", displayName: "Sender" };

      await api.sendFriendRequest("receiver-uid", receiver);

      const fs = await import("firebase/firestore");

      const reqSnap = await fs.getDoc(fs.doc({ _path: ["users", "receiver-uid", "friend_requests", "sender-uid"] }));
      expect(reqSnap.exists()).toBe(true);
      expect(reqSnap.data().fromUid).toBe("sender-uid");
      expect(reqSnap.data().status).toBe("pending");

      const sentSnap = await fs.getDoc(fs.doc({ _path: ["users", "sender-uid", "sent_requests", "receiver-uid"] }));
      expect(sentSnap.exists()).toBe(true);
      expect(sentSnap.data().toUid).toBe("receiver-uid");
      expect(sentSnap.data().status).toBe("pending");
    });
  });

  describe("acceptFriendRequest", () => {
    it("adds friend to both lists and cleans up request docs", async () => {
      const userA = { uid: "user-a", displayName: "UserA", friendCode: "AAAAAA" };
      const userB = { uid: "user-b", displayName: "UserB", friendCode: "BBBBBB" };

      await api.initProfile(userA);
      await api.initProfile(userB);

      const fb = await import("../firebase");
      const fs = await import("firebase/firestore");

      fb.auth.currentUser = { uid: "user-a", displayName: "UserA" };
      await api.sendFriendRequest("user-b", userB);

      fb.auth.currentUser = { uid: "user-b", displayName: "UserB" };
      await api.acceptFriendRequest("user-a", "UserA", "AAAAAA");

      const fbSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-b", "friends", "user-a"] }));
      expect(fbSnap.exists()).toBe(true);
      expect(fbSnap.data().displayName).toBe("UserA");

      const faSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-a", "friends", "user-b"] }));
      expect(faSnap.exists()).toBe(true);
      expect(faSnap.data().displayName).toBe("UserB");

      const reqSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-b", "friend_requests", "user-a"] }));
      expect(reqSnap.exists()).toBe(false);
    });
  });

  describe("declineFriendRequest", () => {
    it("removes request docs without adding friends", async () => {
      const userA = { uid: "user-a", displayName: "UserA" };
      const userB = { uid: "user-b", displayName: "UserB" };

      await api.initProfile(userA);
      await api.initProfile(userB);

      const fb = await import("../firebase");
      const fs = await import("firebase/firestore");

      fb.auth.currentUser = { uid: "user-a", displayName: "UserA" };
      await api.sendFriendRequest("user-b", userB);

      fb.auth.currentUser = { uid: "user-b", displayName: "UserB" };
      await api.declineFriendRequest("user-a");

      const reqSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-b", "friend_requests", "user-a"] }));
      expect(reqSnap.exists()).toBe(false);

      const fbSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-b", "friends", "user-a"] }));
      expect(fbSnap.exists()).toBe(false);
    });
  });

  describe("cancelFriendRequest", () => {
    it("removes sent request docs", async () => {
      const userA = { uid: "user-a", displayName: "UserA" };
      const userB = { uid: "user-b", displayName: "UserB" };

      await api.initProfile(userA);
      await api.initProfile(userB);

      const fb = await import("../firebase");
      const fs = await import("firebase/firestore");

      fb.auth.currentUser = { uid: "user-a", displayName: "UserA" };
      await api.sendFriendRequest("user-b", userB);

      await api.cancelFriendRequest("user-b");

      const sentSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-a", "sent_requests", "user-b"] }));
      expect(sentSnap.exists()).toBe(false);

      const reqSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-b", "friend_requests", "user-a"] }));
      expect(reqSnap.exists()).toBe(false);
    });
  });

  describe("removeFriend", () => {
    it("removes friend from both users' lists (bidirectional)", async () => {
      const fs = await import("firebase/firestore");

      write(["users", "user-a", "friends", "user-b"], {
        displayName: "UserB", friendCode: "BBBBBB", addedAt: Date.now(),
      });
      write(["users", "user-b", "friends", "user-a"], {
        displayName: "UserA", friendCode: "AAAAAA", addedAt: Date.now(),
      });

      const fb = await import("../firebase");
      fb.auth.currentUser = { uid: "user-a", displayName: "UserA" };

      await api.removeFriend("user-b");

      const faSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-a", "friends", "user-b"] }));
      expect(faSnap.exists()).toBe(false);

      const fbSnap = await fs.getDoc(fs.doc({ _path: ["users", "user-b", "friends", "user-a"] }));
      expect(fbSnap.exists()).toBe(false);
    });
  });

  describe("subscribeFriendRequests", () => {
    it("calls back with incoming requests via snapshot listener", async () => {
      const callback = vi.fn();
      const fs = await import("firebase/firestore");

      const unsub = api.subscribeFriendRequests("test-user-uid", callback);

      write(["users", "test-user-uid", "friend_requests", "other-user"], {
        fromUid: "other-user", fromName: "Other", fromCode: "OTHER1", status: "pending", sentAt: Date.now(),
      });
      trigger(["users", "test-user-uid", "friend_requests"]);

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });

      const requests = callback.mock.calls[0][0];
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests.some(r => r.fromUid === "other-user")).toBe(true);

      unsub();
    });
  });

  describe("updateDisplayName", () => {
    it("updates display name in profile", async () => {
      const user = { uid: "name-user", displayName: "OldName" };
      await api.initProfile(user);

      const fb = await import("../firebase");
      fb.auth.currentUser = { uid: "name-user", displayName: "OldName" };

      await api.updateDisplayName("NewName");

      const fs = await import("firebase/firestore");
      const profileSnap = await fs.getDoc(fs.doc({ _path: ["users", "name-user", "profile", "data"] }));
      expect(profileSnap.data().displayName).toBe("NewName");
    });
  });
});
