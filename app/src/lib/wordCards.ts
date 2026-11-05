// Заучивание частых слов Корана: карточки повторения (те же интервалы, что у хадисов и сур) и план на день.
// Карточки пока хранятся на этом устройстве (localStorage), в облако Telegram не уходят.
import { dayNum, LEARNED_STAGE, schedule, type Grade, type HifzCard } from './hifz'
import type { FreqData, FreqWord } from '../types/morph'

const CARDS_KEY = 'fw_cards_v1'
const PERDAY_KEY = 'fw_perday_v1'
export const WORDS_PER_DAY = [5, 10, 15, 20] as const

export type WordCards = Record<string, HifzCard>

export function loadWordCards(): WordCards {
  try { return JSON.parse(localStorage.getItem(CARDS_KEY) || '{}') as WordCards } catch { return {} }
}
export function saveWordCards(c: WordCards) {
  try { localStorage.setItem(CARDS_KEY, JSON.stringify(c)) } catch { /* нет хранилища — не страшно */ }
}
export function loadWordsPerDay(): number {
  try { const n = Number(localStorage.getItem(PERDAY_KEY)); return (WORDS_PER_DAY as readonly number[]).includes(n) ? n : 10 } catch { return 10 }
}
export function saveWordsPerDay(n: number) {
  try { localStorage.setItem(PERDAY_KEY, String(n)) } catch { /* не страшно */ }
}

/** Оценка слова → новая карточка */
export const gradeWord = (cards: WordCards, lemma: string, grade: Grade): WordCards => ({ ...cards, [lemma]: schedule(cards[lemma], grade) })

export interface WordsToday { due: FreqWord[]; fresh: FreqWord[]; learned: number; started: number; pct: number }

/** Что на сегодня: слова на повтор, новые слова по частоте (сколько ещё можно сегодня) и общий прогресс */
export function wordsToday(data: FreqData, cards: WordCards, perDay: number, today = dayNum()): WordsToday {
  const byLemma = new Map(data.w.map((w) => [w[0], w]))
  const due: FreqWord[] = []
  let learned = 0, cnt = 0
  for (const [l, c] of Object.entries(cards)) {
    const w = byLemma.get(l)
    if (!w) continue
    if (c.d <= today) due.push(w)
    if (c.s >= LEARNED_STAGE) { learned++; cnt += w[3] }
  }
  due.sort((a, b) => b[3] - a[3])
  // новые слова, начатые сегодня (карточка поставлена на завтра с первой ступенью) считаем уже выданными
  const startedToday = Object.values(cards).filter((c) => c.s === 0 && c.d === today + 1).length
  const left = Math.max(0, perDay - startedToday)
  const fresh = data.w.filter((w) => !cards[w[0]]).slice(0, left)
  return { due, fresh, learned, started: Object.keys(cards).length, pct: Math.round((1000 * cnt) / data.total) / 10 }
}
