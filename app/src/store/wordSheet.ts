import { create } from 'zustand'
import type { WordTarget } from '../types/morph'

/** Разбор слова, «Слова Корана» и «Смысл Корана» — везде: в Telegram, на сайте и в приложениях из магазинов (разрешение авторов данных есть) */
export const WORD_PARSE = true

/** Окно разбора слова: какое слово открыто (null — окно закрыто) */
export const useWordSheet = create<{ target: WordTarget | null; open: (t: WordTarget) => void; close: () => void }>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}))
