// Роль слова в предложении: данные public/data/syntax (собирает scripts/build-syntax.py из The Quranic Treebank, NoorBayan, MIT).
import { DATA_BASE } from './data'
import type { SyntaxSurah } from '../types/morph'

const get = <T,>(path: string): Promise<T | null> =>
  fetch(DATA_BASE + path).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null)

let labels: Promise<string[] | null> | null = null
/** Арабские названия ролей (номер роли = место в списке) */
export function loadSyntaxLabels() {
  if (!labels) {
    labels = get<string[]>('syntax/labels.json')
    labels.then((r) => { if (!r) labels = null })
  }
  return labels
}

const surahs = new Map<number, Promise<SyntaxSurah | null>>()
/** Роли всех слов суры (загружается один раз) */
export function loadSyntax(surah: number) {
  if (!surahs.has(surah)) {
    const p = get<SyntaxSurah>(`syntax/${String(surah).padStart(3, '0')}.json`)
    p.then((r) => { if (!r) surahs.delete(surah) })
    surahs.set(surah, p)
  }
  return surahs.get(surah)!
}
