// Загрузки для работы без интернета: текст Корана, шрифты страниц, аудио чтеца.
import { create } from 'zustand'
import { DATA_BASE, TOTAL_PAGES, type Surah } from './data'
import { fontKey, fontUrl, isBundled } from './fonts'
import { idbDeletePrefix, idbKeys, requestPersistence } from './idb'
import { cachedBuffer, cachedJson, dataKey, DATA_VERSION, downloadBlob } from './net'
import { downloadToFile, useFiles } from './nativeFiles'
import { loadReciteIndex, loadTiming, suraKey, surahBytes, surahUrl } from './recite'

export type JobKind = 'data' | 'fonts' | 'audio'
/** done/total — число файлов, а у аудио — байты (записи сур большие, прогресс виден внутри файла) */
interface Job { id: string; kind: JobKind; title: string; done: number; total: number; failed: number; /** суры, поставленные на скачивание (аудио) */ queued?: number[] }
/** Задача загрузки: weight — её доля в прогрессе; onBytes — сколько уже скачано из weight */
interface Task { weight: number; run: (onBytes: (n: number) => void) => Promise<unknown> }
const simple = (fn: () => Promise<unknown>): Task => ({ weight: 1, run: fn })

export const useDownloads = create<{ job: Job | null; version: number }>(() => ({ job: null, version: 0 }))
let abort: AbortController | null = null
// текущая очередь: пока идёт загрузка, в неё можно добавлять ещё (аудио нескольких сур подряд)
let live: { id: string; tasks: Task[]; job: Job; spawn: () => void } | null = null

const pad = (n: number) => String(n).padStart(3, '0')

/** Все файлы текста: список сур, аяты, тафсир, раскладка страниц */
export function dataFiles(): string[] {
  const f = ['surahs.json', 'meta.json']
  for (let i = 1; i <= 114; i++) f.push(`quran/${pad(i)}.json`, `tafsir/${pad(i)}.json`)
  for (let p = 1; p <= TOTAL_PAGES; p++) f.push(`mushaf/${pad(p)}.json`)
  return f
}

const weightOf = (tasks: Task[]) => tasks.reduce((n, t) => n + t.weight, 0)

async function run(id: string, kind: JobKind, title: string, tasks: Task[], surahIds?: number[]) {
  const cur = live
  if (cur) {
    // уже качается аудио этого чтеца — дописываем в очередь, не блокируя кнопки
    if (cur.id !== id || kind !== 'audio') return
    cur.tasks.push(...tasks)
    cur.job.total += weightOf(tasks)
    cur.job.queued = [...new Set([...(cur.job.queued ?? []), ...(surahIds ?? [])])]
    cur.job.title = 'Несколько сур'
    useDownloads.setState({ job: { ...cur.job } })
    cur.spawn()
    return
  }
  if (useDownloads.getState().job) return
  requestPersistence()
  abort = new AbortController()
  const max = kind === 'audio' ? 2 : 6
  const job: Job = { id, kind, title, done: 0, total: weightOf(tasks), failed: 0, queued: surahIds }
  useDownloads.setState({ job: { ...job } })
  let i = 0
  let workers = 0
  let shown = 0
  const show = (force = false) => {
    // не чаще ~10 раз в секунду
    const now = Date.now()
    if (force || now - shown > 100) { shown = now; useDownloads.setState({ job: { ...job } }) }
  }
  const running: Promise<void>[] = []
  const worker = async () => {
    workers++
    while (i < tasks.length && !abort!.signal.aborted) {
      const t = tasks[i++]
      let got = 0
      const onBytes = (n: number) => { const d = Math.min(n, t.weight) - got; if (d > 0) { got += d; job.done += d; show() } }
      try { await t.run(onBytes) } catch { if (!abort!.signal.aborted) job.failed++ }
      job.done += t.weight - got
      show(job.done >= job.total || t.weight > 1)
    }
    workers--
  }
  const spawn = () => { while (workers < max && i < tasks.length) running.push(worker()) }
  live = { id, tasks, job, spawn }
  spawn()
  // ждём, пока не разберут всю очередь (в неё могли дописать новое)
  while (running.length) await running.shift()
  live = null
  abort = null
  useDownloads.setState((s) => ({ job: null, version: s.version + 1 }))
}

export const cancelDownload = () => abort?.abort()

export async function downloadData() {
  const have = new Set(await idbKeys(`data:${DATA_VERSION}:`))
  const todo = dataFiles().filter((f) => !have.has(dataKey(f)))
  return run('data', 'data', 'Текст Корана', todo.map((f) => simple(() => cachedJson(dataKey(f), DATA_BASE + f, abort?.signal))))
}

export async function downloadFonts(variant: string) {
  if (isBundled(variant)) return // шрифты этого варианта уже внутри приложения
  const have = new Set(await idbKeys(`font:${variant}:`))
  const todo = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).filter((p) => !have.has(fontKey(p, variant)))
  return run('fonts:' + variant, 'fonts', 'Страницы мусхафа', todo.map((p) => simple(() => cachedBuffer(fontKey(p, variant), fontUrl(p, variant), abort?.signal))))
}

/** Аудио: запись каждой суры целиком (и её разметка — чтобы без интернета подсвечивались аяты) */
export async function downloadAudio(reciter: string, surahs: Surah[], title: string) {
  const ix = await loadReciteIndex()
  const have = new Set(await idbKeys(`sura:${reciter}:`))
  const queued = new Set(useDownloads.getState().job?.queued ?? [])
  surahs = surahs.filter((s) => !queued.has(s.id) && !have.has(suraKey(reciter, s.id)))
  const tasks: Task[] = surahs.map((s) => ({
    weight: Math.max(1, surahBytes(ix, reciter, s.id)),
    run: async (onBytes) => {
      const url = surahUrl(ix, reciter, s.id)
      if (!url) throw new Error('нет записи')
      await loadTiming(reciter, s.id)
      if (abort?.signal.aborted) throw new Error('отменено')
      if (useFiles) await downloadToFile(suraKey(reciter, s.id), url, onBytes)
      else await downloadBlob(suraKey(reciter, s.id), url, abort?.signal, onBytes)
    },
  }))
  return run('audio:' + reciter, 'audio', title, tasks, surahs.map((s) => s.id))
}

// ---------- состояние «что уже скачано» ----------
export async function offlineStatus(fontVariantNow: string, reciter: string) {
  const [data, fonts, audio, ix] = await Promise.all([
    idbKeys(`data:${DATA_VERSION}:`), idbKeys(`font:${fontVariantNow}:`), idbKeys(`sura:${reciter}:`), loadReciteIndex().catch(() => null),
  ])
  const fullSurahs = audio.map((k) => Number(k.slice(-3))).filter((n) => n >= 1 && n <= 114).sort((a, b) => a - b)
  const sizes = ix?.[reciter]?.b ?? []
  return {
    data: { done: data.length, total: dataFiles().length },
    fonts: { done: isBundled(fontVariantNow) ? TOTAL_PAGES : fonts.length, total: TOTAL_PAGES },
    /** суры чтеца: сколько скачано из 114, размер всех записей и каждой */
    audio: { done: fullSurahs.length, total: 114, fullSurahs, sizes, bytes: sizes.reduce((a, b) => a + b, 0) },
  }
}

/** Удалить скачанное аудио одной суры у чтеца */
export async function deleteAudioSurah(reciter: string, surah: number) {
  await idbDeletePrefix(suraKey(reciter, surah))
  useDownloads.setState((s) => ({ version: s.version + 1 }))
}

export async function deleteDownloads(kind: 'fonts' | 'audio' | 'all', key?: string) {
  if (kind === 'fonts') await idbDeletePrefix(`font:${key}:`)
  else if (kind === 'audio') await idbDeletePrefix(`sura:${key}:`)
  else { await idbDeletePrefix('font:'); await idbDeletePrefix('sura:'); await idbDeletePrefix('audio:') }
  useDownloads.setState((s) => ({ version: s.version + 1 }))
}
