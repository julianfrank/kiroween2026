// Raw key-value storage. Keys and values are plain strings; encryption happens above this layer.

export interface KV {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

export class MemoryKV implements KV {
  readonly data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key);
  }
  async put(key: string, value: string) {
    this.data.set(key, value);
  }
  async delete(key: string) {
    this.data.delete(key);
  }
  async keys() {
    return [...this.data.keys()];
  }
  async clear() {
    this.data.clear();
  }
}

const STORE = 'items';

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDbKV implements KV {
  private dbPromise: Promise<IDBDatabase>;

  constructor(name = 'scary-money-manager') {
    this.dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }

  private async store(mode: IDBTransactionMode) {
    const db = await this.dbPromise;
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async get(key: string) {
    return (await wrap((await this.store('readonly')).get(key))) as string | undefined;
  }
  async put(key: string, value: string) {
    await wrap((await this.store('readwrite')).put(value, key));
  }
  async delete(key: string) {
    await wrap((await this.store('readwrite')).delete(key));
  }
  async keys() {
    return (await wrap((await this.store('readonly')).getAllKeys())) as string[];
  }
  async clear() {
    await wrap((await this.store('readwrite')).clear());
  }
}
