// Плеер Корана: чтецы, режим заучивания, таймер сна

/** ayahs — папка файлов аятов на everyayah.com: запасной путь, если у суры нет разметки (начать с середины, заучивание).
 *  Нет папки (аль-Люхайдан) — без разметки сура звучит только целиком */
export interface Reciter {
  name: string
  ayahs?: string
  /** звучат не цельные записи сур, а файлы аятов, поставленные встык (lib/glueAudio.ts); разметки в recite/ нет — слова из timing/ */
  glue?: boolean
}

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

/** rest — пауза (мс) перед повтором того же аята и перед новым кругом (аят → следующий аят идёт без неё)
 *  lead — сколько первых аятов очереди звучат один раз за круг (связка с прошлым отрывком), остальные — repeatEach раз */
export interface MemoOptions { repeatEach: number; repeatRange: number; pause: PauseMode; hideText: boolean; lead?: number; rest?: number }

export type Sleep = { mode: 'time'; until: number } | { mode: 'suras'; left: number }
