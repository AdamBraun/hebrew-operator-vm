type CacheValue = string;

export interface TextCache {
  get(key: string): Promise<CacheValue | undefined>;
  set(key: string, value: CacheValue): Promise<void>;
  clear(prefix?: string): Promise<void>;
}

export interface LayeredTextCacheOptions {
  namespace?: string;
  useIndexedDb?: boolean;
  indexedDbName?: string;
  indexedDbStoreName?: string;
}

class MemoryTextCache implements TextCache {
  private readonly map = new Map<string, CacheValue>();

  async get(key: string): Promise<CacheValue | undefined> {
    return this.map.get(key);
  }

  async set(key: string, value: CacheValue): Promise<void> {
    this.map.set(key, value);
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.map.clear();
      return;
    }

    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
      }
    }
  }
}

class IndexedDbTextCache implements TextCache {
  private readonly dbName: string;
  private readonly storeName: string;
  private openPromise: Promise<IDBDatabase | null> | null = null;
  private disabled = false;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async get(key: string): Promise<CacheValue | undefined> {
    const db = await this.open();
    if (!db) {
      return undefined;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).get(key);

      request.onsuccess = () => {
        resolve(typeof request.result === 'string' ? request.result : undefined);
      };
      request.onerror = () => {
        resolve(undefined);
      };
    });
  }

  async set(key: string, value: CacheValue): Promise<void> {
    const db = await this.open();
    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  async clear(prefix?: string): Promise<void> {
    const db = await this.open();
    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      if (!prefix) {
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
        return;
      }

      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const next = cursor.result;
        if (!next) {
          return;
        }
        if (String(next.key).startsWith(prefix)) {
          next.delete();
        }
        next.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  private async open(): Promise<IDBDatabase | null> {
    if (this.disabled) {
      return null;
    }

    if (!this.openPromise) {
      this.openPromise = this.openInternal();
    }

    return this.openPromise;
  }

  private async openInternal(): Promise<IDBDatabase | null> {
    if (typeof globalThis.indexedDB === 'undefined') {
      return null;
    }

    return new Promise((resolve) => {
      const request = globalThis.indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.disabled = true;
        resolve(null);
      };

      request.onblocked = () => {
        this.disabled = true;
        resolve(null);
      };
    });
  }
}

class LayeredTextCache implements TextCache {
  private readonly memory = new MemoryTextCache();
  private readonly persistent: IndexedDbTextCache | null;
  private readonly namespace: string;

  constructor(options: LayeredTextCacheOptions) {
    this.namespace = options.namespace?.trim() ?? 'letters-ui';

    if (options.useIndexedDb === false) {
      this.persistent = null;
    } else {
      this.persistent = new IndexedDbTextCache(
        options.indexedDbName ?? 'letters-ui-cache-v1',
        options.indexedDbStoreName ?? 'bundle-text'
      );
    }
  }

  async get(key: string): Promise<CacheValue | undefined> {
    const cacheKey = this.toKey(key);
    const memoryHit = await this.memory.get(cacheKey);
    if (memoryHit !== undefined) {
      return memoryHit;
    }

    if (!this.persistent) {
      return undefined;
    }

    const persistentHit = await this.persistent.get(cacheKey);
    if (persistentHit !== undefined) {
      await this.memory.set(cacheKey, persistentHit);
    }
    return persistentHit;
  }

  async set(key: string, value: CacheValue): Promise<void> {
    const cacheKey = this.toKey(key);
    await this.memory.set(cacheKey, value);
    if (this.persistent) {
      await this.persistent.set(cacheKey, value);
    }
  }

  async clear(prefix?: string): Promise<void> {
    const scopedPrefix = prefix ? this.toKey(prefix) : `${this.namespace}:`;
    await this.memory.clear(scopedPrefix);
    if (this.persistent) {
      await this.persistent.clear(scopedPrefix);
    }
  }

  private toKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}

export function createLayeredTextCache(
  options: LayeredTextCacheOptions = {}
): TextCache {
  return new LayeredTextCache(options);
}
