// Разбор слов Корана: данные Quranic Arabic Corpus 0.4 (public/data/morph, собирает scripts/build-morph.py).
import { DATA_BASE } from './data'
import type { MorphSeg, MorphSurah, MorphWord, RootIndex } from '../types/morph'

const get = <T,>(path: string): Promise<T | null> =>
  fetch(DATA_BASE + path).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null)

const surahs = new Map<number, Promise<MorphSurah | null>>()
/** Разбор всех слов суры (загружается один раз) */
export function loadMorph(surah: number) {
  if (!surahs.has(surah)) {
    const p = get<MorphSurah>(`morph/${String(surah).padStart(3, '0')}.json`)
    p.then((r) => { if (!r) surahs.delete(surah) }) // нет сети — в следующий раз попробуем снова
    surahs.set(surah, p)
  }
  return surahs.get(surah)!
}

let roots: Promise<RootIndex | null> | null = null
/** Все корни: где встречаются и в каких формах (около 2 МБ, грузится при первом открытии вкладок «Где ещё» и «Формы») */
export function loadRoots() {
  if (!roots) {
    roots = get<RootIndex>('morph/roots.json')
    roots.then((r) => { if (!r) roots = null })
  }
  return roots
}

const tagsOf = (seg: MorphSeg) => seg[2].split('|')
/** Значение метки вида «ИМЯ:значение» (корень, лемма, форма глагола…) */
export const tagValue = (seg: MorphSeg, name: string) => tagsOf(seg).find((t) => t.startsWith(name + ':'))?.slice(name.length + 1) ?? null
/** Основа слова — часть с корнем (или первая не приставка) */
export const stemOf = (word: MorphWord): MorphSeg | null =>
  word.find((g) => tagValue(g, 'ROOT')) ?? word.find((g) => !g[2].split('|').includes('PREF')) ?? word[0] ?? null
/** Слово целиком, как оно написано */
export const wordText = (word: MorphWord) => word.map((g) => g[0]).join('')
/** Корень буквами через точку: «س · م · و» */
export const rootLetters = (root: string) => [...root].join(' · ')
