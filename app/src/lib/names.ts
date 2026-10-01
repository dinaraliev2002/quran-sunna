// Раздел «99 имён Аллаха»: public/data/names.json (см. scripts/build-names.py)
// Источник: Са‘ид аль-Кахтани, «Толкование прекрасных имён Аллаха в свете Корана и Сунны» (пер. Э. Кулиева)
import { DATA_BASE } from './data'
import { cachedJson, dataKey } from './net'

export interface AllahName {
  n: number
  ar: string // с огласовками
  tr: string // транскрипция
  st: number // позиция ударной буквы в tr (-1 — нет)
  ru: string // значение
  g: number // номер толкования в groups
}
/** Толкование — одно на несколько близких по смыслу имён */
export interface NameGroup { title: string; text: string[]; ayahs: [number, number][]; url: string }
export interface NamesData { names: AllahName[]; groups: NameGroup[]; source: string }

const NAMES_VERSION = 1
let cache: Promise<NamesData> | null = null
export function loadNames(): Promise<NamesData> {
  cache ??= cachedJson<NamesData>(dataKey(`names.json?v=${NAMES_VERSION}`), `${DATA_BASE}names.json?v=${NAMES_VERSION}`)
  cache.catch(() => { cache = null })
  return cache
}

/** Значение — первое из перечисленных («Могучий, Способный» → «Могучий») для коротких подписей */
export const shortMeaning = (ru: string) => ru.split(',')[0].trim()

/** Перемешать (для теста и карточек) */
export function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]]
  }
  return r
}
