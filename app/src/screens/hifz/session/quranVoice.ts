// Проверка голосом в заучивании Корана: слова отрывка → эталон для сверки и отметки по словам
import { analyzeAr } from '../../../lib/arabicSpeech'
import type { CheckedWord } from '../../../lib/speechCheck'
import type { QItem } from '../../../types/hifzQuran'

/** Слова отрывка подряд (знаки остановки и номера аятов в слова не входят) */
export function quranRef(item: QItem) {
  const flat = item.ayahs.flatMap((a, ai) => a.w.map((w, wi) => ({ w, ai, wi })))
  const an = analyzeAr(flat.map((x) => x.w))
  return { text: flat.filter((_, i) => an[i].count).map((x) => x.w).join(' '), flat, count: an.map((x) => x.count) }
}

/** Что отметить на слове аята: «ok / wrong / missed» по результату сверки */
export function quranMarks(item: QItem, words: CheckedWord[] | undefined) {
  if (!words) return null
  const { flat, count } = quranRef(item)
  const state = new Map<string, string>()
  let k = 0
  flat.forEach((x, i) => { if (count[i]) { const m = words[k++]; if (m) state.set(`${x.ai}.${x.wi}`, m.state + (m.ai ? ' ai' : '')) } })
  return (ai: number, wi: number) => state.get(`${ai}.${wi}`)
}
