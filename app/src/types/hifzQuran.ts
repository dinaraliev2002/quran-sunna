// Заучивание Корана
import type { Ayah } from './quran'

/** Отрезок для заучивания: сура, с аята a по b (b не задан — до конца суры) */
export interface QRange { s: number; a?: number; b?: number }

/** Подборка: что учить по порядку */
export interface QSet { id: string; name: string; /** название на арабском и короткое — для карточки */ ar: string; short: string; sub: string; why?: string; ranges: QRange[] }

export interface QItem { key: string; s: number; a: number; b: number; ayahs: Ayah[] }
