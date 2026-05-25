const mockUser = { uid: "test-user-uid", displayName: "TestTrainer", email: "test@test.com" };

class MockFirestore {
  constructor() {
    this.reset();
  }

  reset() {
    this.data = {};
    this.listeners = {};
  }

  _getRef(ref) {
    const parts = [];
    let current = ref;
    while (current && current._id !== undefined) {
      parts.unshift(current._id);
      current = current._parent;
    }
    return parts;
  }

  _navigate(path) {
    let d = this.data;
    for (const p of path) {
      if (!d[p]) d[p] = {};
      d = d[p];
    }
    return d;
  }

  _get(path) {
    return this._navigate(path);
  }

  _set(path, value) {
    this._navigate(path.slice(0, -1))[path[path.length - 1]] = { ...value };
  }

  _delete(path) {
    const parent = this._navigate(path.slice(0, -1));
    delete parent[path[path.length - 1]];
  }

  _triggerListeners(collectionPath) {
    const key = collectionPath.join("/");
    const listeners = this.listeners[key] || [];
    const data = this._get(collectionPath);
    const docs = Object.entries(data || {}).map(([id, val]) => ({
      id,
      data: () => ({ ...val }),
      exists: () => true,
    }));
    listeners.forEach(fn => fn({ docs, doc: () => null, empty: docs.length === 0 }));
  }
}

const mockFirestore = new MockFirestore();

// ── Firestore mock implementations ──

function doc(...args) {
  const path = args.map(a => (typeof a === "object" && a !== null ? a._id || a.id : String(a)));
  return { _id: path[path.length - 1], _parent: args.length > 1 ? args[args.length - 2] : null, _path: path };
}

function collection(...args) {
  const path = args.map(a => (typeof a === "object" && a !== null ? a._id || a.id : String(a)));
  return { _id: path[path.length - 1], _parent: args.length > 1 ? args[args.length - 2] : null, _path: path };
}

async function getDoc(ref) {
  const path = ref._path;
  const data = mockFirestore._get(path);
  return {
    exists: () => data !== undefined && data !== null,
    data: () => (data ? { ...data } : null),
    id: path[path.length - 1],
  };
}

async function getDocs(ref) {
  const path = ref._path;
  const data = mockFirestore._get(path) || {};
  const docs = Object.entries(data).map(([id, val]) => ({
    id,
    data: () => ({ ...val }),
    exists: () => true,
  }));
  return { docs, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}

async function setDoc(ref, value) {
  mockFirestore._set(ref._path, value);
  mockFirestore._triggerListeners(ref._path.slice(0, -1));
}

async function updateDoc(ref, value) {
  const path = ref._path;
  const existing = mockFirestore._get(path) || {};
  mockFirestore._set(path, { ...existing, ...value });
  mockFirestore._triggerListeners(path.slice(0, -1));
}

async function deleteDoc(ref) {
  mockFirestore._delete(ref._path);
  mockFirestore._triggerListeners(ref._path.slice(0, -1));
}

async function addDoc(collectionRef, value) {
  const id = "auto-id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const path = [...collectionRef._path, id];
  mockFirestore._set(path, value);
  mockFirestore._triggerListeners(collectionRef._path);
  return { id };
}

function serverTimestamp() {
  return { toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
}

function onSnapshot(ref, callback) {
  const path = ref._path;
  const key = path.join("/");
  if (!mockFirestore.listeners[key]) mockFirestore.listeners[key] = [];
  const wrapped = (snap) => {
    const data = mockFirestore._get(path);
    const docs = Object.entries(data || {}).map(([id, val]) => ({
      id,
      data: () => ({ ...val }),
      exists: () => true,
    }));
    callback({ docs, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) });
  };
  mockFirestore.listeners[key].push(wrapped);
  return () => {
    mockFirestore.listeners[key] = mockFirestore.listeners[key].filter(f => f !== wrapped);
  };
}

export const db = {};
export const auth = { currentUser: mockUser };

export function __setMockUser(user) {
  auth.currentUser = user || mockUser;
}

export function __resetMockFirestore() {
  mockFirestore.reset();
}

export function __getMockFirestore() {
  return mockFirestore;
}

export {
  mockFirestore,
  doc, collection, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, onSnapshot,
};
