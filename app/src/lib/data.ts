// Загрузка подготовленных данных из public/data (см. scripts/fetch-data.mjs)
import { cachedJson, dataKey } from './net'

export interface Surah {
  id: number
  name: string // русская транслитерация
  meaning: string
  ar: string
  ayahs: number
  mk: boolean // мекканская
  rev: number // порядок ниспослания
  pages: [number, number]
  bism: boolean
}

export interface Ayah {
  n: number
  p: number // страница мусхафа
  j: number // джуз
  r: number // четверть хизба 1–240 (хизб = ⌈r/4⌉)
  rs?: 1 // с этого аята начинается четверть хизба
  t: string // текст Усмани
  tj: string // текст с разметкой таджвида
  ku: string // перевод Кулиева
  aa: string // перевод Абу Аделя
  w: string[] // слова
  g: string // глифы слов для шрифта страницы QPC (через пробел, в конце — знак конца аята)
}

/** Строка страницы мусхафа: [глиф QPC, "сура:аят", 1 если это знак конца аята] */
export type MushafWord = [string, string, 0 | 1]
export interface MushafPage {
  p: number
  lines: Record<string, MushafWord[]>
  starts: [number, number][] // [сура, строка первого аята]
}

export const TOTAL_PAGES = 604
export const DATA_BASE = import.meta.env.BASE_URL + 'data/'
const cache = new Map<string, Promise<unknown>>()

// Данные берутся с телефона, если уже скачаны; иначе из сети (и сохраняются на телефоне)
function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = cachedJson<T>(dataKey(path), DATA_BASE + path)
    p.catch(() => cache.delete(path)) // при ошибке сети — попробуем снова в следующий раз
    cache.set(path, p)
  }
  return cache.get(path) as Promise<T>
}

const pad = (n: number) => String(n).padStart(3, '0')

export const loadSurahs = () => load<Surah[]>('surahs.json')
export const loadSurah = (id: number) => load<{ id: number; ayahs: Ayah[] }>(`quran/${pad(id)}.json`).then((d) => d.ayahs)
export const loadTafsir = (id: number) => load<Record<string, string>>(`tafsir/${pad(id)}.json`)
export const loadMushafPage = (p: number) => load<MushafPage>(`mushaf/${pad(p)}.json`)
export const loadMeta = () => load<{ juzPages: number[] }>('meta.json')

/** История аята (причина ниспослания) — запись из книги по асбаб ан-нузуль */
export interface AsbabPart { k: 'src' | 'isnad' | 'text' | 'note' | 'foot'; t: string }
export interface AsbabStory { id: string; book: string; from: number; to: number; page: string | null; title: string; verdict?: string; parts: AsbabPart[] }
export interface AsbabBook { author: string; title: string; about: string; edition: string }
/** Оглавление историй: книги и для каждой суры — диапазоны аятов [от, до], у которых есть истории */
export interface AsbabIndex { books: Record<string, AsbabBook>; s: Record<string, [number, number][]> }

// Пока перевод пополняется, файлы не кэшируем на телефоне. Нет файлов (публикация без них) — раздела просто нет.
const getJson = <T,>(path: string): Promise<T | null> => fetch(DATA_BASE + path).then((r) => (r.ok ? r.json() : null)).catch(() => null)
let asbabIndex: Promise<AsbabIndex | null> | null = null
export const loadAsbabIndex = () => (asbabIndex ??= getJson<AsbabIndex>('asbab/index.json'))
const asbabSurah = new Map<number, Promise<AsbabStory[] | null>>()
export function loadAsbabSurah(id: number) {
  if (!asbabSurah.has(id)) asbabSurah.set(id, getJson<AsbabStory[]>(`asbab/${pad(id)}.json`))
  return asbabSurah.get(id)!
}
/** Есть ли у аята история (по оглавлению, без загрузки самой суры) */
export const hasAsbab = (ix: AsbabIndex | null, surah: number, ayah: number) =>
  !!ix?.s[surah]?.some(([a, b]) => a <= ayah && ayah <= b)

/** Сура, на странице которой находится данная страница (по первой строке) */
export function surahByPage(surahs: Surah[], page: number): Surah {
  let s = surahs[0]
  for (const x of surahs) if (x.pages[0] <= page) s = x
  return s
}

export function juzByPage(juzPages: number[], page: number) {
  let j = 1
  juzPages.forEach((start, i) => { if (start <= page) j = i + 1 })
  return j
}

/** Тафсир ас-Саади дан группами: текст стоит на последнем аяте группы */
export function tafsirFor(tf: Record<string, string>, ayah: number, total: number): { text: string; from: number; to: number } | null {
  let to = ayah
  while (to <= total && !tf[to]) to++
  if (to > total) return null
  let from = ayah
  while (from > 1 && !tf[from - 1]) from--
  return { text: tf[to], from, to }
}

export const arDigits = (n: number) => n.toLocaleString('ar-EG')
export const surahGlyph = (id: number) => 'surah' + pad(id)

/** Хизб и четверть: 1 хизб = 4 четверти, 2 хизба = 1 джуз */
export const hizbOf = (r: number) => ({ hizb: Math.ceil(r / 4), quarter: (r - 1) % 4 }) // quarter: 0 — начало, 1 — ¼, 2 — ½, 3 — ¾
export const QUARTER_LABEL = ['', '¼', '½', '¾']
