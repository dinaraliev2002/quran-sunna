// Загрузка подготовленных данных из public/data (см. scripts/fetch-data.mjs)
import { cachedJson, dataKey } from './net'
import type { Surah, Ayah, MushafWord, MushafPage, GlossaryItem, SajdaData } from '../types/quran'
export type { Surah, Ayah, MushafWord, MushafPage, GlossaryItem, SajdaData }
import type { AsbabPart, AsbabOpinion, AsbabStory, AsbabBook, AsbabIndex } from '../types/asbab'
export type { AsbabPart, AsbabOpinion, AsbabStory, AsbabBook, AsbabIndex }
import type { KulievIndex, KulievSurah } from '../types/kuliev'
export type { KulievIndex, KulievSurah }

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
/** Пословный перевод: по аятам — подписи к словам (пустая — слово переведено вместе с соседним) */
export const loadWbw = (id: number) => load<string[][]>(`wbw/${pad(id)}.json`)
export const loadMeta = () => load<{ juzPages: number[] }>('meta.json')

// Пока перевод пополняется, файлы не кэшируем на телефоне. Нет файлов (публикация без них) — раздела просто нет.
// Оглавление берём всегда свежим, а файлы сур — с его версией, чтобы после обновления не показать старое.
const getJson = <T,>(path: string, init?: RequestInit): Promise<T | null> =>
  fetch(DATA_BASE + path, init).then((r) => (r.ok ? r.json() : null)).catch(() => null)
// «История суры» (рассказ о ниспослании суры целиком) пока не показываем — включить: true
export const SURAH_STORY = false
let asbabIndex: Promise<AsbabIndex | null> | null = null
export const loadAsbabIndex = () => {
  if (!asbabIndex) {
    asbabIndex = getJson<AsbabIndex>('asbab/index.json', { cache: 'no-store' }).then((ix) => (ix && !SURAH_STORY ? { ...ix, w: {} } : ix))
    // нет файла или пропал интернет — в следующий раз попробуем снова
    asbabIndex.then((r) => { if (!r) asbabIndex = null })
  }
  return asbabIndex
}
const asbabSurah = new Map<number, Promise<AsbabStory[] | null>>()
export function loadAsbabSurah(id: number) {
  if (!asbabSurah.has(id)) {
    const p = loadAsbabIndex()
      .then((ix) => (ix ? getJson<AsbabStory[]>(`asbab/${pad(id)}.json?v=${ix.v}`) : null))
      .then((list) => (list && !SURAH_STORY ? list.filter((x) => !x.whole) : list))
    // не загрузилось (пропал интернет) — не запоминаем неудачу, в следующий раз попробуем снова
    p.then((r) => { if (!r) asbabSurah.delete(id) })
    asbabSurah.set(id, p)
  }
  return asbabSurah.get(id)!
}
/** Есть ли у аята история (по оглавлению, без загрузки самой суры) */
export const hasAsbab = (ix: AsbabIndex | null, surah: number, ayah: number) =>
  !!ix?.s[surah]?.some(([a, b]) => a <= ayah && ayah <= b)

let kulievIndex: Promise<KulievIndex | null> | null = null
export const loadKulievIndex = () => {
  if (!kulievIndex) {
    kulievIndex = getJson<KulievIndex>('kuliev/index.json', { cache: 'no-store' })
    kulievIndex.then((r) => { if (!r) kulievIndex = null })
  }
  return kulievIndex
}
const kulievSurah = new Map<number, Promise<KulievSurah | null>>()
export function loadKulievSurah(id: number) {
  if (!kulievSurah.has(id)) {
    const p = loadKulievIndex().then((ix) => (ix ? getJson<KulievSurah>(`kuliev/${pad(id)}.json?v=${ix.v}`) : null))
    p.then((r) => { if (!r) kulievSurah.delete(id) })
    kulievSurah.set(id, p)
  }
  return kulievSurah.get(id)!
}
export const loadGlossary = () => loadKulievIndex().then((ix) => (ix ? getJson<GlossaryItem[]>(`kuliev/glossary.json?v=${ix.v}`) : null))
export const loadSajda = () => loadKulievIndex().then((ix) => (ix ? getJson<SajdaData>(`kuliev/sajda.json?v=${ix.v}`) : null))
/** Есть ли у аята пояснения Кулиева (по оглавлению) */
export const hasKuliev = (ix: KulievIndex | null, surah: number, ayah: number) => !!ix?.s[surah]?.n.includes(ayah)
export const isSajda = (ix: KulievIndex | null, surah: number, ayah: number) => !!ix?.sajda.some(([s, a]) => s === surah && a === ayah)

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
