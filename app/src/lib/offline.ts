// Загрузки для работы без интернета: текст Корана, шрифты страниц, аудио чтеца.
import { create } from 'zustand'
import { DATA_BASE, loadSurahs, TOTAL_PAGES, type Surah } from './data'
import { fontKey, fontUrl } from './fonts'
import { idbDeletePrefix, idbKeys, requestPersistence } from './idb'
import { cachedBuffer, cachedJson, dataKey, DATA_VERSION, downloadBlob } from './net'
import { audioKey, audioUrls } from '../store/player'

export type JobKind = 'data' | 'fonts' | 'audio'
interface Job { id: string; kind: JobKind; title: string; done: number; total: number; failed: number }

export const useDownloads = create<{ job: Job | null; version: number }>(() => ({ job: null, version: 0 }))
let abort: AbortController | null = null

const pad = (n: number) => String(n).padStart(3, '0')

/** Все файлы текста: список сур, аяты, тафсир, раскладка страниц */
export function dataFiles(): string[] {
  const f = ['surahs.json', 'meta.json']
  for (let i = 1; i <= 114; i++) f.push(`quran/${pad(i)}.json`, `tafsir/${pad(i)}.json`)
  for (let p = 1; p <= TOTAL_PAGES; p++) f.push(`mushaf/${pad(p)}.json`)
  return f
}

async function run(id: string, kind: JobKind, title: string, tasks: (() => Promise<unknown>)[]) {
  if (useDownloads.getState().job) return
  requestPersistence()
  abort = new AbortController()
  const job: Job = { id, kind, title, done: 0, total: tasks.length, failed: 0 }
  useDownloads.setState({ job: { ...job } })
  let i = 0
  const worker = async () => {
    while (i < tasks.length && !abort!.signal.aborted) {
      const t = tasks[i++]
      try { await t() } catch { if (!abort!.signal.aborted) job.failed++ }
      job.done++
      if (job.done % 5 === 0 || job.done === job.total) useDownloads.setState({ job: { ...job } })
    }
  }
  await Promise.all(Array.from({ length: kind === 'audio' ? 4 : 6 }, worker))
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
  return run('audio:' + reciter, 'audio', title, tasks)
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

export async function deleteDownloads(kind: 'fonts' | 'audio' | 'all', key?: string) {
  if (kind === 'fonts') await idbDeletePrefix(`font:${key}:`)
  else if (kind === 'audio') await idbDeletePrefix(`audio:${key}:`)
  else { await idbDeletePrefix('font:'); await idbDeletePrefix('audio:') }
  useDownloads.setState((s) => ({ version: s.version + 1 }))
}
