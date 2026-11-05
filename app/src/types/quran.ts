// Коран: суры, аяты, страницы мусхафа, глоссарий, земные поклоны

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

/** Запись словаря; n — в скольких аятах термин встречается в переводе, h — первые из них («сура:аят») */
export interface GlossaryItem { ar: string; tr: string; mean: string; n?: number; h?: string[] }

export interface SajdaData {
  places: { n: number; juz: number; surah: number; name: string; ayah: number; disputed: boolean }[]
  note: string; dua_ar: string; dua_ru: string; dua_src: string
}
