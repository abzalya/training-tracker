// Local-first storage. Everything lives in IndexedDB on this device.
// No network, no server. Works fully offline mid-workout.

const DB_NAME = "training-tracker";
const DB_VERSION = 1;
const STORE = "sessions";

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("date", "date");
        os.createIndex("type", "type");
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(mode) {
  return open().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function saveSession(session) {
  const store = await tx("readwrite");
  return new Promise((res, rej) => {
    const r = store.put(session);
    r.onsuccess = () => res(session);
    r.onerror = () => rej(r.error);
  });
}

export async function deleteSession(id) {
  const store = await tx("readwrite");
  return new Promise((res, rej) => {
    const r = store.delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

export async function allSessions() {
  const store = await tx("readonly");
  return new Promise((res, rej) => {
    const r = store.getAll();
    r.onsuccess = () => res((r.result || []).sort((a, b) => a.date.localeCompare(b.date)));
    r.onerror = () => rej(r.error);
  });
}

export async function sessionsOfType(type) {
  return (await allSessions()).filter((s) => s.type === type);
}

// Most recent gym session for a given plan key (push/pull/legs) — powers "ghost" targets.
export async function lastGym(key, beforeId = null) {
  const all = (await allSessions())
    .filter((s) => s.type === "gym" && s.key === key)
    .sort((a, b) => b.date.localeCompare(a.date));
  return all.find((s) => s.id !== beforeId) || null;
}

export async function replaceAll(sessions) {
  const store = await tx("readwrite");
  await new Promise((res) => { store.clear().onsuccess = res; });
  for (const s of sessions) await saveSession(s);
}
