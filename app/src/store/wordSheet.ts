import { create } from 'zustand'
import { isNative } from '../lib/telegram'
import type { WordTarget } from '../types/morph'

/** Разбор слова пока только в Telegram и на сайте; в приложениях из магазинов выключен (до разрешения авторов данных) */
export const WORD_PARSE = !isNative

/** Окно разбора слова: какое слово открыто (null — окно закрыто) */
export const useWordSheet = create<{ target: WordTarget | null; open: (t: WordTarget) => void; close: () => void }>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}))
