// Загрузка подготовленных данных из public/data (см. scripts/fetch-data.mjs)

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
  t: string // текст Усмани
  tj: string // текст с разметкой таджвида
  ku: string // перевод Кулиева
  aa: string // перевод Абу Аделя
  w: string[] // слова
}

/** Строка страницы мусхафа: [глиф QPC, "сура:аят", 1 если это знак конца аята] */
export type MushafWord = [string, string, 0 | 1]
export interface MushafPage {
  p: number
  lines: Record<string, MushafWord[]>
  starts: [number, number][] // [сура, строка первого аята]
}

export const TOTAL_PAGES = 604
const BASE = import.meta.env.BASE_URL + 'data/'
const cache = new Map<string, Promise<unknown>>()

function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`)
      return r.json()
    })
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
