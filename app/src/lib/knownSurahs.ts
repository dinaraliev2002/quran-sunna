// Заученные суры: отметить суры, которые человек уже знает, и понять, какие суры заучены целиком.
// Заученная сура — это обычные карточки заучивания Корана на ступени «выучено»: она сама возвращается на повтор.
import { loadSurah } from './data'
import { dayNum, LEARNED_STAGE, type HifzCard } from './hifz'
import { parseQKey, passageFrom, qKey } from './hifzQuran'
import type { Surah } from '../types/quran'

/** Суры, у которых все аяты выучены (отрывки на ступени «выучено» и выше) */
export function learnedSurahs(cards: Record<string, HifzCard>, surahs: Surah[]): number[] {
  const got = new Map<number, number>()
  for (const [k, c] of Object.entries(cards)) {
    const p = parseQKey(k)
    if (p && c.s >= LEARNED_STAGE) got.set(p.s, (got.get(p.s) ?? 0) + p.b - p.a + 1)
  }
  return surahs.filter((s) => (got.get(s.id) ?? 0) >= s.ayahs).map((s) => s.id)
}

/**
 * Карточки для сур, которые человек уже знает: суру делим на отрывки (как при обычном заучивании)
 * и ставим на ступень «выучено». Первый повтор — в ближайшие две недели, чтобы все суры не вернулись в один день.
 */
export async function knownCards(ids: number[], today = dayNum()): Promise<Record<string, HifzCard>> {
  const out: Record<string, HifzCard> = {}
  let n = 0
  for (const s of ids) {
    const ayahs = await loadSurah(s)
    const d = today + 2 + (n++ % 13)
    for (let a = 1; a <= ayahs.length;) {
      const p = passageFrom(ayahs, {}, s, a, ayahs.length)
      out[qKey(s, p.a, p.b)] = { s: LEARNED_STAGE, d }
      a = p.b + 1
    }
  }
  return out
}
