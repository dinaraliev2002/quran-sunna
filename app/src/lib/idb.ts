// Постоянное хранилище на телефоне (IndexedDB) — работает во встроенном браузере Telegram на iOS и Android.
// Храним тексты (JSON), шрифты страниц (ArrayBuffer) и аудио (Blob), чтобы открывать без интернета и мгновенно.
// Ключи с префиксом категории: "data:…", "font:…", "audio:…".

import { fileDeletePrefix, fileGet, fileHas, fileList, filePut, isBig } from './nativeFiles'

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

const dbGet = <T>(key: string) => tx<T>('readonly', (s) => s.get(key) as IDBRequest<T>)
const dbPut = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key))
const dbHas = (key: string) => tx<IDBValidKey | undefined>('readonly', (s) => s.getKey(key)).then((k) => k !== undefined)

// В приложении из магазина аудио и шрифты — файлы на диске (nativeFiles.ts); если запись файла не удалась или файла
// ещё нет (старые скачивания лежали в браузерном хранилище) — работаем с IndexedDB, как раньше.
export const idbGet = async <T>(key: string): Promise<T | undefined> => (isBig(key) ? (await fileGet<T>(key)) ?? dbGet<T>(key) : dbGet<T>(key))
export const idbPut = async (key: string, value: unknown) => {
  if (isBig(key) && (await filePut(key, value))) { await dbDelete(key); return }
  return dbPut(key, value)
}
export const idbHas = async (key: string) => (isBig(key) && (await fileHas(key))) || dbHas(key)

/** Все ключи с данным префиксом */
export const idbKeys = async (prefix: string) => {
  const own = ((await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(prefix, prefix + '￿')))) ?? []) as string[]
  if (!isBig(prefix)) return own
  return [...new Set([...own, ...(await fileList(prefix)).map((f) => f.key)])]
}

/** Размеры записей с префиксом: [{ key, size }] — для экрана «Загрузки» */
export async function idbSizes(prefix: string): Promise<{ key: string; size: number }[]> {
  const files = isBig(prefix) ? await fileList(prefix) : []
  const own = await dbSizes(prefix)
  const seen = new Set(files.map((f) => f.key))
  return [...files, ...own.filter((o) => !seen.has(o.key))]
}
function dbSizes(prefix: string): Promise<{ key: string; size: number }[]> {
  return db().then((d) => new Promise((resolve) => {
    const out: { key: string; size: number }[] = []
    if (!d) return resolve(out)
    try {
      const req = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor(IDBKeyRange.bound(prefix, prefix + '￿'))
      req.onsuccess = () => {
        const c = req.result
        if (!c) return resolve(out)
        const v = c.value
        out.push({ key: String(c.key), size: v instanceof Blob ? v.size : v instanceof ArrayBuffer ? v.byteLength : 0 })
        c.continue()
      }
      req.onerror = () => resolve(out)
    } catch { resolve(out) }
  }))
}

/** Удалить все записи с префиксом */
const dbDelete = (key: string) => tx('readwrite', (s) => s.delete(key))
export const idbDeletePrefix = async (prefix: string) => {
  if (isBig(prefix)) await fileDeletePrefix(prefix)
  return tx('readwrite', (s) => s.delete(IDBKeyRange.bound(prefix, prefix + '￿')))
}

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
