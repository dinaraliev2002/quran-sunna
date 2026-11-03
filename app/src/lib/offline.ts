// Загрузки для работы без интернета: текст Корана, шрифты страниц, аудио чтеца.
import { create } from 'zustand'
import { DATA_BASE, loadSurahs, TOTAL_PAGES, type Surah } from './data'
import { fontKey, fontUrl } from './fonts'
import { idbDeletePrefix, idbKeys, requestPersistence } from './idb'
import { cachedBuffer, cachedJson, dataKey, DATA_VERSION, downloadBlob } from './net'
import { audioKey, audioUrls } from '../store/player'

export type JobKind = 'data' | 'fonts' | 'audio'
interface Job { id: string; kind: JobKind; title: string; done: number; total: number; failed: number; /** суры, поставленные на скачивание (аудио) */ queued?: number[] }

export const useDownloads = create<{ job: Job | null; version: number }>(() => ({ job: null, version: 0 }))
let abort: AbortController | null = null
// текущая очередь: пока идёт загрузка, в неё можно добавлять ещё (аудио нескольких сур подряд)
let live: { id: string; tasks: (() => Promise<unknown>)[]; job: Job; next: () => number; spawn: () => void } | null = null

const pad = (n: number) => String(n).padStart(3, '0')

/** Все файлы текста: список сур, аяты, тафсир, раскладка страниц */
export function dataFiles(): string[] {
  const f = ['surahs.json', 'meta.json']
  for (let i = 1; i <= 114; i++) f.push(`quran/${pad(i)}.json`, `tafsir/${pad(i)}.json`)
  for (let p = 1; p <= TOTAL_PAGES; p++) f.push(`mushaf/${pad(p)}.json`)
  return f
}

async function run(id: string, kind: JobKind, title: string, tasks: (() => Promise<unknown>)[], surahIds?: number[]) {
  const cur = live
  if (cur) {
    // уже качается аудио этого чтеца — дописываем в очередь, не блокируя кнопки
    if (cur.id !== id || kind !== 'audio') return
    cur.tasks.push(...tasks)
    cur.job.total += tasks.length
    cur.job.queued = [...new Set([...(cur.job.queued ?? []), ...(surahIds ?? [])])]
    cur.job.title = 'Несколько сур'
    useDownloads.setState({ job: { ...cur.job } })
    cur.spawn()
    return
  }
  if (useDownloads.getState().job) return
  requestPersistence()
  abort = new AbortController()
  const max = kind === 'audio' ? 4 : 6
  const job: Job = { id, kind, title, done: 0, total: tasks.length, failed: 0, queued: surahIds }
  useDownloads.setState({ job: { ...job } })
  let i = 0
  let workers = 0
  const running: Promise<void>[] = []
  const worker = async () => {
    workers++
    while (i < tasks.length && !abort!.signal.aborted) {
      const t = tasks[i++]
      try { await t() } catch { if (!abort!.signal.aborted) job.failed++ }
      job.done++
      if (job.done % 5 === 0 || job.done === job.total) useDownloads.setState({ job: { ...job } })
    }
    workers--
  }
  const spawn = () => { while (workers < max && i < tasks.length) running.push(worker()) }
  live = { id, tasks, job, next: () => i, spawn }
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
  return run('data', 'data', 'Текст Корана', todo.map((f) => () => cachedJson(dataKey(f), DATA_BASE + f, abort?.signal)))
}

export async function downloadFonts(variant: string) {
  const have = new Set(await idbKeys(`font:${variant}:`))
  const todo = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).filter((p) => !have.has(fontKey(p, variant)))
  return run('fonts:' + variant, 'fonts', 'Страницы мусхафа', todo.map((p) => () => cachedBuffer(fontKey(p, variant), fontUrl(p, variant), abort?.signal)))
}

export async function downloadAudio(reciter: string, surahs: Surah[], title: string) {
  const have = new Set(await idbKeys(`audio:${reciter}:`))
  const queued = new Set(useDownloads.getState().job?.queued ?? [])
  surahs = surahs.filter((s) => !queued.has(s.id))
  const tasks: (() => Promise<unknown>)[] = []
  for (const s of surahs) for (let a = 1; a <= s.ayahs; a++) {
    const key = `${s.id}:${a}`
    if (have.has(audioKey(reciter, key))) continue
    tasks.push(async () => {
      const [primary, mirror] = audioUrls(reciter, key)
      try { await downloadBlob(audioKey(reciter, key), primary, abort?.signal) } catch (e) {
        if (abort?.signal.aborted) throw e
        await downloadBlob(audioKey(reciter, key), mirror, abort?.signal)
      }
    })
  }
  return run('audio:' + reciter, 'audio', title, tasks, surahs.map((s) => s.id))
}

// ---------- состояние «что уже скачано» ----------
export async function offlineStatus(fontVariantNow: string, reciter: string) {
  const [data, fonts, audio, surahs] = await Promise.all([
    idbKeys(`data:${DATA_VERSION}:`), idbKeys(`font:${fontVariantNow}:`), idbKeys(`audio:${reciter}:`), loadSurahs(),
  ])
  // аудио по сурам: сколько аятов скачано
  const perSurah = new Map<number, number>()
  for (const k of audio) { const s = Number(k.slice(-6, -3)); perSurah.set(s, (perSurah.get(s) ?? 0) + 1) }
  const fullSurahs = surahs.filter((s) => (perSurah.get(s.id) ?? 0) >= s.ayahs).map((s) => s.id)
  return {
    data: { done: data.length, total: dataFiles().length },
    fonts: { done: fonts.length, total: TOTAL_PAGES },
    audio: { done: audio.length, total: 6236, perSurah, fullSurahs },
  }
}

/** Удалить скачанное аудио одной суры у чтеца */
export async function deleteAudioSurah(reciter: string, surah: number) {
  await idbDeletePrefix(`audio:${reciter}:${String(surah).padStart(3, '0')}`)
  useDownloads.setState((s) => ({ version: s.version + 1 }))
}

export async function deleteDownloads(kind: 'fonts' | 'audio' | 'all', key?: string) {
  if (kind === 'fonts') await idbDeletePrefix(`font:${key}:`)
  else if (kind === 'audio') await idbDeletePrefix(`audio:${key}:`)
  else { await idbDeletePrefix('font:'); await idbDeletePrefix('audio:') }
  useDownloads.setState((s) => ({ version: s.version + 1 }))
}
