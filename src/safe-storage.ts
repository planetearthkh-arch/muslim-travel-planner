class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(String(key)) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(String(key)); }
  setItem(key: string, value: string) { this.values.set(String(key), String(value)); }
}

let fallbackStorage: Storage | undefined;
let persistentStorageAvailable = false;

export function getSafeStorage(): Storage {
  if (typeof window === 'undefined') {
    persistentStorageAvailable = false;
    return fallbackStorage ??= new MemoryStorage();
  }
  try {
    const storage = window.localStorage;
    const probe = '__safarone_storage_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    persistentStorageAvailable = true;
    return storage;
  } catch {
    persistentStorageAvailable = false;
    return fallbackStorage ??= new MemoryStorage();
  }
}

export function isPersistentStorageAvailable() {
  return persistentStorageAvailable;
}
