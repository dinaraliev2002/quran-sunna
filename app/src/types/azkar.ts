// Азкары («Крепость мусульманина»)

export interface AzkarItem {
  ch: number // глава
  ar: string // арабский текст
  ru: string // перевод
  ref: string // источник хадиса
  rep: number // сколько раз читать
  audio?: string
  /** Если в азкаре есть аяты: текст по частям — слова хадиса и отрывки мусхафа (глифы шрифта страницы) */
  ap?: AzkarPart[]
}

/** Отрывок Корана глифами мусхафа: [страница, глифы] по аяту; b — басмала отдельной строкой */
export interface AzkarQuran { q: [number, string][]; b?: 1 }
export type AzkarPart = string | AzkarQuran

export interface AzkarChapter { id: number; cat: number; name: string; items: number[] }

export interface AzkarCategory { id: number; name: string }

export interface AzkarData { categories: AzkarCategory[]; chapters: AzkarChapter[]; items: Record<string, AzkarItem> }
