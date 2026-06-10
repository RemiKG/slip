// Local-only persistence (IndexedDB). Nothing here ever leaves the device.
// Stores: settings, the cumulative slip-map tally, the last passage, and recordings.
// "Clear all local data" wipes passages/recordings/slip-maps but keeps the cached model.
import { openDB, type IDBPDatabase } from "idb";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB("slip", 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("kv")) database.createObjectStore("kv");
        if (!database.objectStoreNames.contains("recordings"))
          database.createObjectStore("recordings");
      },
    });
  }
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const d = db();
  if (!d) return undefined;
  try {
    return (await (await d).get("kv", key)) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    await (await d).put("kv", value, key);
  } catch {
    /* storage may be full / blocked — degrade silently, app still works in-memory */
  }
}

export async function recordingSet(key: string, blob: Blob): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    await (await d).put("recordings", blob, key);
  } catch {
    /* ignore */
  }
}

export async function recordingGet(key: string): Promise<Blob | undefined> {
  const d = db();
  if (!d) return undefined;
  try {
    return (await (await d).get("recordings", key)) as Blob | undefined;
  } catch {
    return undefined;
  }
}

// Wipe text, recordings & slip maps (keeps the cached model + the user's settings).
export async function clearLocalData(): Promise<void> {
  const d = db();
  if (!d) return;
  const database = await d;
  try {
    await database.clear("recordings");
    // remove data keys but keep "settings"
    const tx = database.transaction("kv", "readwrite");
    const keys = await tx.store.getAllKeys();
    for (const k of keys) {
      if (k !== "settings") await tx.store.delete(k);
    }
    await tx.done;
  } catch {
    /* ignore */
  }
}
