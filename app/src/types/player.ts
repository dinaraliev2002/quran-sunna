// Плеер Корана: чтецы, режим заучивания, таймер сна

export interface Reciter { name: string; /** папка на everyayah по качеству, кбит/с */ folders: Record<number, string>; def: number }

export type PauseMode = 0 | 2000 | 5000 | 'len'

export interface MemoOptions { repeatEach: number; repeatRange: number; pause: PauseMode; hideText: boolean }

export type Sleep = { mode: 'time'; until: number } | { mode: 'suras'; left: number }
