// Передатчики хадисов: карточки, высказывания критиков, цепочки

// высказывание учёного: [имя, год смерти (0 — нет), арабский текст, русский перевод или null, окраска, id учёного]
export type Quote = [string, number, string, string | null, 'praise' | 'note' | 'crit', number]
export interface Narrator {
  n: string; k?: string; rn?: string; r?: string; t?: number; ts?: 't' | 'd'; d?: number; nq?: number
  tz?: 1; ik?: 1; st?: 1; tq?: string | null; tr?: string | null; c?: Quote[]
}

export interface RichQuote { who: string; era: string; kind: 'praise' | 'note' | 'crit'; ar: string; ru: string }
export interface RichNarrator {
  ru: string; kunya: string; nisba: string; role: string; taq_ar: string; taq_ru: string; tab: number
  born: string; died: string; lived: string; post: string; flags?: string[]; quotes: RichQuote[]
}
export interface Rich { hadith: { title: string; source: string; type: string; grade: string; facts: string[] }; narrators: Record<string, RichNarrator> }

// src — откуда цепочка, если она взята из первоисточника (для ан-Навави и «Рияда»)
export type NarratorLink = { chain?: number[]; src?: [string, string]; sahabi?: { id: number; sure: boolean } } | null
