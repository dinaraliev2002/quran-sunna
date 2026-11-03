// Новости «Что нового» (public/updates.json)

export type NewsCard = { icon: string; color?: string; title: string; text: string; tip?: string; img?: string; imgs?: string[] }
export type News = { id: string; version?: string; kind: 'update' | 'message'; date?: string; title: string; cards?: NewsCard[]; fixes?: string[]; points?: string[]; text?: string }
