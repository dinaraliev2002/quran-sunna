// Азкары («Крепость мусульманина»)

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
