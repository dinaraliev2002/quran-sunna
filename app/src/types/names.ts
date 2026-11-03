// 99 имён Аллаха

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
