// Понятия Корана (люди, места, существа, растения, предметы): данные public/data/concepts.json (собирает scripts/build-concepts.py).
import { DATA_BASE } from './data'
import type { Concept } from '../types/concepts'

let all: Promise<Concept[] | null> | null = null
/** Все понятия (около 250, грузятся один раз) */
export function loadConcepts() {
  if (!all) {
    all = fetch(DATA_BASE + 'concepts.json').then((r) => (r.ok ? (r.json() as Promise<Concept[]>) : null)).catch(() => null)
    all.then((r) => { if (!r) all = null })
  }
  return all
}

/** Понятия, которые упоминаются в аяте «сура:аят» (самые «весомые» — с небольшим числом упоминаний — первыми) */
export function conceptsOfAyah(list: Concept[], key: string): Concept[] {
  return list.filter((c) => c.v.includes(key)).sort((a, b) => a.n - b.n)
}

let wordMap: Promise<Record<string, string[]> | null> | null = null
/** Какие слова Корана — понятия: «сура:аят:слово» → номера понятий */
export function loadConceptWords() {
  if (!wordMap) {
    wordMap = fetch(DATA_BASE + 'concept-words.json').then((r) => (r.ok ? (r.json() as Promise<Record<string, string[]>>) : null)).catch(() => null)
    wordMap.then((r) => { if (!r) wordMap = null })
  }
  return wordMap
}
