// Плеер Корана: чтецы, режим заучивания, таймер сна

export interface Reciter { name: string; /** папка на everyayah по качеству, кбит/с */ folders: Record<number, string>; def: number }

export type PauseMode = 0 | 2000 | 5000 | 'len'

/** lead — сколько первых аятов очереди звучат один раз за круг (связка с прошлым отрывком), остальные — repeatEach раз */
export interface MemoOptions { repeatEach: number; repeatRange: number; pause: PauseMode; hideText: boolean; lead?: number }

export type Sleep = { mode: 'time'; until: number } | { mode: 'suras'; left: number }
