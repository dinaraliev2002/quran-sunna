// Раздел «Азкары» (Крепость мусульманина): данные из public/data/azkar.json (см. scripts/build-azkar.py)
import { DATA_BASE } from './data'
import { cachedJson, dataKey } from './net'

export interface AzkarItem {
  ch: number // глава
  ar: string // арабский текст
  ru: string // перевод
  ref: string // источник хадиса
  rep: number // сколько раз читать
  audio?: string
}
export interface AzkarChapter { id: number; cat: number; name: string; items: number[] }
export interface AzkarCategory { id: number; name: string }
export interface AzkarData { categories: AzkarCategory[]; chapters: AzkarChapter[]; items: Record<string, AzkarItem> }

// версия файла азкаров — увеличиваем при пересборке azkar.json, чтобы телефоны не держали старую копию
const AZKAR_VERSION = 3
let cache: Promise<AzkarData> | null = null
export function loadAzkar(): Promise<AzkarData> {
  cache ??= cachedJson<AzkarData>(dataKey(`azkar.json?v=${AZKAR_VERSION}`), `${DATA_BASE}azkar.json?v=${AZKAR_VERSION}`)
  cache.catch(() => { cache = null })
  return cache
}

// ---------- «Ежедневные» ----------
export const MORNING = 27
export const EVENING = 28

/** Главное на каждый день */
export const DAILY_MAIN: { ch: number; title: string; hint: string; icon: string }[] = [
  { ch: MORNING, title: 'Утренние азкары', hint: 'После утреннего намаза до восхода', icon: 'sun' },
  { ch: EVENING, title: 'Вечерние азкары', hint: 'После послеполуденного намаза до заката', icon: 'moon' },
  { ch: 25, title: 'После намаза', hint: 'После приветствия в конце молитвы', icon: 'hands' },
  { ch: 29, title: 'Перед сном', hint: 'Когда ложитесь спать', icon: 'bed' },
  { ch: 1, title: 'При пробуждении', hint: 'Как только проснулись', icon: 'sunrise' },
  { ch: 26, title: 'Дуа истихара', hint: 'Когда предстоит выбор в важном деле', icon: 'compass' },
]

/** Понятные названия для некоторых глав (в книге они сформулированы описательно) */
const TITLES: Record<number, string> = { 26: 'Дуа истихара' }
export const chapterTitle = (c: AzkarChapter) => TITLES[c.id] ?? c.name
/** Короткие мольбы, которые встречаются в течение дня */
export const DAILY_ROUTINE: number[] = [10, 11, 70, 71, 13, 14, 6, 7, 2, 8, 9]

/** Какие азкары сейчас актуальнее: утренние — до 15:00, вечерние — после */
export const nowIsMorning = () => new Date().getHours() < 15

// иконки групп
export const CATEGORY_ICON: Record<number, string> = {
  1: 'sunrise', 2: 'home', 3: 'cup', 4: 'heart', 5: 'compass', 6: 'hands', 7: 'star', 8: 'kaaba', 9: 'users', 10: 'cloud', 11: 'leaf',
}

/** Короткий заголовок азкара для списков: начало перевода */
export function snippet(text: string, n = 110) {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t
}

export const timesLabel = (n: number) => (n === 1 ? '1 раз' : n >= 2 && n <= 4 ? `${n} раза` : `${n} раз`)
