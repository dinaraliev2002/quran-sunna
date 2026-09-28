// Загрузка с кэшем на телефоне: сначала хранилище (мгновенно, без интернета), потом сеть.
import { idbDeletePrefix, idbGet, idbKeys, idbPut } from './idb'

/** Версия данных Корана: увеличиваем, когда меняем public/data (старые копии на телефоне удалятся) */
export const DATA_VERSION = 'v3'
export const dataKey = (path: string) => `data:${DATA_VERSION}:${path}`

const inflight = new Map<string, Promise<unknown>>()
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!inflight.has(key)) {
    const p = fn().finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return inflight.get(key) as Promise<T>
}

async function net(url: string, signal?: AbortSignal): Promise<Response> {
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r
}

/** JSON: всегда сохраняем на телефоне (тексты небольшие, а открываться должны мгновенно) */
export function cachedJson<T>(key: string, url: string, signal?: AbortSignal): Promise<T> {
  return once(key, async () => {
    const hit = await idbGet<T>(key)
    if (hit !== undefined) return hit
    const data = (await (await net(url, signal)).json()) as T
    idbPut(key, data)
    return data
  })
}

/** Файл (шрифт): сохраняем на телефоне после первой загрузки */
export function cachedBuffer(key: string, url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  return once(key, async () => {
    const hit = await idbGet<ArrayBuffer>(key)
    if (hit) return hit
    const buf = await (await net(url, signal)).arrayBuffer()
    idbPut(key, buf)
    return buf
  })
}

/** Аудио: сохраняется только при скачивании из «Загрузок» (иначе быстро съест память телефона) */
export async function downloadBlob(key: string, url: string, signal?: AbortSignal): Promise<number> {
  const blob = await (await net(url, signal)).blob()
  await idbPut(key, blob)
  return blob.size
}
export const cachedBlob = (key: string) => idbGet<Blob>(key)

/** Удалить копии данных старых версий */
export async function cleanupOldData() {
  const keys = await idbKeys('data:')
  const stale = new Set(keys.filter((k) => !k.startsWith(`data:${DATA_VERSION}:`)).map((k) => k.split(':').slice(0, 2).join(':') + ':'))
  for (const prefix of stale) await idbDeletePrefix(prefix)
}
