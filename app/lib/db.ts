/**
 * Storage adapter for Splitor.
 *
 * Tries IndexedDB first, falls back to localStorage, then to an in-memory map
 * so that a blocked or broken storage backend can never break the app. Every
 * public method is async regardless of which backend is in use.
 */

const DB_NAME = "splitor";
const DB_VERSION = 1;
const OPEN_TIMEOUT_MS = 3000;
const LS_PREFIX = "splitor:";

export type StoreName = "bills" | "app";

export type StorageKind = "indexeddb" | "localstorage" | "memory";

export interface StorageAdapter {
  kind: StorageKind;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  getAll<T>(store: StoreName): Promise<T[]>;
  put(store: StoreName, key: string, value: unknown): Promise<void>;
  del(store: StoreName, key: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
}

/** `bills` uses an in-line key so it can carry an index; `app` is plain key-value. */
const INLINE_KEY_STORES: Record<StoreName, string | null> = {
  bills: "id",
  app: null,
};

export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED"
  );
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("IndexedDB open timed out"));
    }, OPEN_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("bills")) {
        const bills = db.createObjectStore("bills", { keyPath: "id" });
        bills.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains("app")) {
        db.createObjectStore("app");
      }
    };

    request.onsuccess = () =>
      finish(() => {
        const db = request.result;
        // Another tab upgrading the schema must not leave this connection stuck.
        db.onversionchange = () => db.close();
        resolve(db);
      });

    request.onerror = () =>
      finish(() => reject(request.error ?? new Error("IndexedDB open failed")));

    request.onblocked = () =>
      finish(() => reject(new Error("IndexedDB open blocked")));
  });
}

function createIdbAdapter(db: IDBDatabase): StorageAdapter {
  const run = <T>(
    store: StoreName,
    mode: IDBTransactionMode,
    fn: (objectStore: IDBObjectStore) => IDBRequest<T> | null
  ): Promise<T | undefined> =>
    new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(store, mode);
      } catch (error) {
        reject(error);
        return;
      }

      let result: T | undefined;
      const request = fn(tx.objectStore(store));
      if (request) {
        request.onsuccess = () => {
          result = request.result;
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    });

  return {
    kind: "indexeddb",
    get: <T>(store: StoreName, key: string) =>
      run<T>(store, "readonly", (os) => os.get(key) as IDBRequest<T>),
    getAll: <T>(store: StoreName) =>
      run<T[]>(store, "readonly", (os) => os.getAll() as IDBRequest<T[]>).then(
        (rows) => rows ?? []
      ),
    put: (store, key, value) =>
      run(store, "readwrite", (os) =>
        INLINE_KEY_STORES[store] ? os.put(value) : os.put(value, key)
      ).then(() => undefined),
    del: (store, key) =>
      run(store, "readwrite", (os) => os.delete(key)).then(() => undefined),
    clear: (store) =>
      run(store, "readwrite", (os) => os.clear()).then(() => undefined),
  };
}

function createLocalStorageAdapter(): StorageAdapter {
  const prefixOf = (store: StoreName) => `${LS_PREFIX}${store}:`;

  return {
    kind: "localstorage",
    async get<T>(store: StoreName, key: string) {
      const raw = localStorage.getItem(prefixOf(store) + key);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    async getAll<T>(store: StoreName) {
      const prefix = prefixOf(store);
      const rows: T[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        try {
          rows.push(JSON.parse(raw) as T);
        } catch {
          // Skip corrupt records rather than failing the whole read.
        }
      }
      return rows;
    },
    async put(store, key, value) {
      localStorage.setItem(prefixOf(store) + key, JSON.stringify(value));
    },
    async del(store, key) {
      localStorage.removeItem(prefixOf(store) + key);
    },
    async clear(store) {
      const prefix = prefixOf(store);
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
    },
  };
}

function createMemoryAdapter(): StorageAdapter {
  const stores: Record<StoreName, Map<string, unknown>> = {
    bills: new Map(),
    app: new Map(),
  };

  return {
    kind: "memory",
    async get<T>(store: StoreName, key: string) {
      return stores[store].get(key) as T | undefined;
    },
    async getAll<T>(store: StoreName) {
      return Array.from(stores[store].values()) as T[];
    },
    async put(store, key, value) {
      stores[store].set(key, value);
    },
    async del(store, key) {
      stores[store].delete(key);
    },
    async clear(store) {
      stores[store].clear();
    },
  };
}

function localStorageWorks(): boolean {
  try {
    const probe = `${LS_PREFIX}probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

let adapterPromise: Promise<StorageAdapter> | null = null;

async function resolveAdapter(): Promise<StorageAdapter> {
  if (typeof window === "undefined") return createMemoryAdapter();

  if (typeof indexedDB !== "undefined") {
    try {
      return createIdbAdapter(await openIdb());
    } catch {
      // Private browsing modes and some in-app browsers block or hang here.
    }
  }

  if (localStorageWorks()) return createLocalStorageAdapter();

  return createMemoryAdapter();
}

export function getAdapter(): Promise<StorageAdapter> {
  if (!adapterPromise) {
    adapterPromise = resolveAdapter().catch(() => createMemoryAdapter());
  }
  return adapterPromise;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Serializes every storage operation through a single chain so concurrent
 * callers can never interleave transactions or abort one another.
 */
export function enqueue<T>(fn: (adapter: StorageAdapter) => Promise<T>): Promise<T> {
  const next = queue.then(async () => fn(await getAdapter()));
  queue = next.catch(() => undefined);
  return next;
}
