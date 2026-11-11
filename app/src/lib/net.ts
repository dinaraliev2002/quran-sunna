// Загрузка с кэшем на телефоне: сначала хранилище (мгновенно, без интернета), потом сеть.
import { idbDeletePrefix, idbGet, idbKeys, idbPut } from './idb'

/** Версия данных Корана: увеличиваем, когда меняем public/data (старые копии на телефоне удалятся) */
export const DATA_VERSION = 'v4'
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

/** Аудио: сохраняется только при скачивании из «Загрузок» (иначе быстро съест память телефона). onBytes — сколько скачано */
export async function downloadBlob(key: string, url: string, signal?: AbortSignal, onBytes?: (n: number) => void): Promise<number> {
  const res = await net(url, signal)
  let blob: Blob
  if (onBytes && res.body) {
    const reader = res.body.getReader()
    const parts: Uint8Array[] = []
    let n = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
      n += value.length
      onBytes(n)
    }
    blob = new Blob(parts as BlobPart[], { type: 'audio/mpeg' })
  } else blob = await res.blob()
  await idbPut(key, blob)
  return blob.size
}
export const cachedBlob = (key: string) => idbGet<Blob>(key)

/** Удалить копии данных старых версий и аудио по аятам (с ноября 2026 чтец звучит цельными записями сур) */
export async function cleanupOldData() {
  const keys = await idbKeys('data:')
  const stale = new Set(keys.filter((k) => !k.startsWith(`data:${DATA_VERSION}:`)).map((k) => k.split(':').slice(0, 2).join(':') + ':'))
  for (const prefix of stale) await idbDeletePrefix(prefix)
  // тексты, исправленные после выхода (lib/dataFixes.ts): их копии на телефоне удаляем один раз — скачаются заново
  const { DATA_FIXES } = await import('./dataFixes')
  let applied: string[] = []
  try { applied = JSON.parse(localStorage.getItem('data-fixes') || '[]') } catch { /* нет хранилища — применим снова, это безопасно */ }
  for (const fix of DATA_FIXES) {
    if (applied.includes(fix.id)) continue
    for (const p of fix.paths) await idbDeletePrefix(dataKey(p)) // точный путь: «…/1.json» не совпадёт ни с чем другим
    for (const p of fix.prefixes ?? []) await idbDeletePrefix(dataKey(p))
    applied.push(fix.id)
  }
  try { localStorage.setItem('data-fixes', JSON.stringify(applied)) } catch { /* без хранилища — проверим в следующий раз */ }
  if ((await idbKeys('audio:')).length) await idbDeletePrefix('audio:')
  // разметка чтецов прошлых версий (lib/recite.ts: RECITE_V)
  const { RECITE_V } = await import('./recite')
  const old = new Set(keys.filter((k) => /^data:[^:]+:recite/.test(k) && !k.startsWith(dataKey(`recite${RECITE_V}/`))).map((k) => k.slice(0, k.indexOf('/') + 1)))
  for (const prefix of old) await idbDeletePrefix(prefix)
}
