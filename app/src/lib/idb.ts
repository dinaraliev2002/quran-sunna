// Постоянное хранилище на телефоне (IndexedDB) — работает во встроенном браузере Telegram на iOS и Android.
// Храним тексты (JSON), шрифты страниц (ArrayBuffer) и аудио (Blob), чтобы открывать без интернета и мгновенно.
// Ключи с префиксом категории: "data:…", "font:…", "audio:…".

const DB = 'quran-offline'
const STORE = 'files'
let dbp: Promise<IDBDatabase | null> | null = null

function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null) // хранилище недоступно (приватный режим) — просто работаем онлайн
    } catch {
      resolve(null)
    }
  })
  return dbp
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then((d) => new Promise((resolve) => {
    if (!d) return resolve(undefined)
    try {
      const req = fn(d.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  }))
}

export const idbGet = <T>(key: string) => tx<T>('readonly', (s) => s.get(key) as IDBRequest<T>)
export const idbPut = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key))
export const idbHas = (key: string) => tx<IDBValidKey | undefined>('readonly', (s) => s.getKey(key)).then((k) => k !== undefined)

/** Все ключи с данным префиксом */
export const idbKeys = (prefix: string) =>
  tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(prefix, prefix + '￿'))).then((k) => (k ?? []) as string[])

/** Удалить все записи с префиксом */
export const idbDeletePrefix = (prefix: string) => tx('readwrite', (s) => s.delete(IDBKeyRange.bound(prefix, prefix + '￿')))

/** Попросить систему не удалять наши данные при нехватке места */
export function requestPersistence() {
  try { navigator.storage?.persist?.() } catch { /* ignore */ }
}

export async function storageUsage(): Promise<{ used: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    return e ? { used: e.usage ?? 0, quota: e.quota ?? 0 } : null
  } catch {
    return null
  }
}
