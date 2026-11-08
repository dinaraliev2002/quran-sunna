// Плеер Корана: чтецы, режим заучивания, таймер сна

/** ayahs — папка файлов аятов на everyayah.com: запасной путь, если у суры нет разметки (начать с середины, заучивание) */
export interface Reciter { name: string; ayahs: string }

/** Записи сур одного чтеца (public/data/recite/index.json) */
export interface ReciteEntry {
  /** адрес записи суры, по порядку сур */
  u: string[]
  /** размер файла суры, байт */
  b: number[]
  /** есть разметка слов */
  w: boolean
  /** суры без разметки аятов (звучат только целиком) */
  n: number[]
}
export type ReciteIndex = Record<string, ReciteEntry>

/** Разметка суры: a — [начало, конец] аятов в мс от начала файла; w — слова аятов [номер слова, начало, конец] */
export interface SurahTiming { a: [number, number][]; w?: [number, number, number][][] }

export type PauseMode = 0 | 2000 | 5000 | 'len'

/** lead — сколько первых аятов очереди звучат один раз за круг (связка с прошлым отрывком), остальные — repeatEach раз */
export interface MemoOptions { repeatEach: number; repeatRange: number; pause: PauseMode; hideText: boolean; lead?: number }

export type Sleep = { mode: 'time'; until: number } | { mode: 'suras'; left: number }
