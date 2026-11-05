// Новости «Что нового» (public/updates.json)

/** only: карточка только для Telegram и сайта ('web') или только для приложения из магазина ('native') */
export type NewsCard = { only?: 'web' | 'native'; icon: string; color?: string; title: string; text: string; tip?: string; img?: string; imgs?: string[] }
export type News = { id: string; version?: string; kind: 'update' | 'message'; date?: string; title: string; /** intro — короткая сводка обновления над карточками; introWeb — вариант для Telegram и сайта (там больше разделов) */
  intro?: string; introWeb?: string; cards?: NewsCard[]; fixes?: string[]; points?: string[]; text?: string }
