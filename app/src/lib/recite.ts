// Цельные записи сур и разметка по ним (public/data/recite, собирают scripts/fetch-recitations.mjs и align-recitation.py).
// Плеер играет одну запись на всю суру — чтец звучит без пауз на стыках аятов, — а по разметке знает,
// где начинается и кончается каждый аят и (у части чтецов) каждое слово.
import { DATA_BASE } from './data'
import { cachedJson, dataKey } from './net'
import type { ReciteIndex, SurahTiming } from '../types/player'

const pad = (n: number) => String(n).padStart(3, '0')

let index: ReciteIndex | null = null
let indexP: Promise<ReciteIndex> | null = null
/** Список записей всех чтецов (адреса и размеры файлов сур) */
export function loadReciteIndex(): Promise<ReciteIndex> {
  indexP ??= cachedJson<ReciteIndex>(dataKey('recite/index.json'), DATA_BASE + 'recite/index.json')
    .then((ix) => (index = ix))
    .catch((e) => { indexP = null; throw e })
  return indexP
}
/** Уже загруженный список (или null) — для синхронных проверок */
export const reciteIndex = () => index

/** Адрес записи суры в интернете */
export const surahUrl = (ix: ReciteIndex, reciter: string, surah: number) => ix[reciter]?.u[surah - 1] ?? null
/** Размер записи суры, байт */
export const surahBytes = (ix: ReciteIndex, reciter: string, surah: number) => ix[reciter]?.b[surah - 1] ?? 0
/** Есть ли у чтеца разметка слов (подсветка звучащего слова) */
export const hasWords = (reciter: string) => !!index?.[reciter]?.w
/** Есть ли разметка аятов этой суры (без неё сура звучит только целиком, с начала) */
export const hasTiming = (ix: ReciteIndex, reciter: string, surah: number) => !!ix[reciter] && !ix[reciter].n.includes(surah)

const timings = new Map<string, SurahTiming>()
const timingP = new Map<string, Promise<SurahTiming | null>>()
/** Разметка суры, если уже загружена */
export const timingNow = (reciter: string, surah: number) => timings.get(`${reciter}:${surah}`) ?? null
/** Разметка суры: границы аятов (мс от начала файла) и слов; null — разметки нет */
export function loadTiming(reciter: string, surah: number): Promise<SurahTiming | null> {
  const k = `${reciter}:${surah}`
  let p = timingP.get(k)
  if (!p) {
    p = loadReciteIndex().then((ix) => {
      if (!hasTiming(ix, reciter, surah)) return null
      const path = `recite/${reciter}/${pad(surah)}.json`
      return cachedJson<SurahTiming>(dataKey(path), DATA_BASE + path).then((t) => { timings.set(k, t); return t })
    })
    p.catch(() => timingP.delete(k))
    timingP.set(k, p)
  }
  return p
}

/** Ключ скачанной записи суры в хранилище телефона */
export const suraKey = (reciter: string, surah: number) => `sura:${reciter}:${pad(surah)}`
