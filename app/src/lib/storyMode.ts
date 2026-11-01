// Вкладка «Истории»: что читать подряд — истории и комментарии вместе, только истории или только комментарии.
// Выбор помним на телефоне; им пользуются и список сур, и экран чтения.

import { useSyncExternalStore } from 'react'

export type StoryMode = 'all' | 'st' | 'kv'
const KEY = 'storyMode'

let mode: StoryMode = (() => {
  try { const v = localStorage.getItem(KEY); return v === 'st' || v === 'kv' ? v : 'all' } catch { return 'all' }
})()
const subs = new Set<() => void>()

export function setStoryMode(v: StoryMode) {
  mode = v
  try { localStorage.setItem(KEY, v) } catch { /* без памяти телефона просто не запоминаем */ }
  subs.forEach((f) => f())
}

/** Текущий режим; без комментариев Кулиева (публичная сборка) всегда «только истории» */
export function useStoryMode(hasKuliev: boolean): StoryMode {
  const m = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => mode)
  return hasKuliev ? m : 'st'
}
