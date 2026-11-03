import { plural } from '../../../lib/plural'
import { type Surah } from '../../../types/quran'
import { inDays } from '../../../lib/hifz'
import { pagesText, surahProgress } from '../../../lib/hifzQuran'
import { type QSet } from '../../../types/hifzQuran'
// Подписи раздела «Заучивание → Коран»: объём, упражнения, прогресс суры

/** Сколько аятов в подборке */
export const setSize = (q: QSet, surahs: Surah[]) => {
  const n = q.ranges.reduce((a, r) => a + (r.b ? r.b - (r.a ?? 1) + 1 : surahs[r.s - 1].ayahs - (r.a ?? 1) + 1), 0)
  return `${n} ${plural(n, 'аят', 'аята', 'аятов')}`
}
export const amount = (words: number, ayahs: number) => `${pagesText(words)} (${ayahs} ${plural(ayahs, 'аят', 'аята', 'аятов')})`

export const drillText = (d: number) => (d === 3 ? 'видно слово через два' : d === 2 ? 'видно слово через одно' : d === 23 ? 'через одно, потом через два' : 'без упражнений')

export function rowText(pr: ReturnType<typeof surahProgress>, total: number) {
  if (!pr.started) return `Не начата · ${total} ${plural(total, 'аят', 'аята', 'аятов')}`
  const head = pr.learned >= total ? 'Выучена' : `${pr.started} из ${total} ${plural(total, 'аята', 'аятов', 'аятов')}`
  return `${head} · ${pr.due !== null && pr.due <= 0 ? 'повтор сегодня' : `повтор ${inDays(pr.due ?? 0)}`}`
}
