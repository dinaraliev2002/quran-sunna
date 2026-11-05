// Поиск по грамматике: фильтр по меткам Quranic Arabic Corpus среди всех форм слов с корнем (roots.json).
import type { RootIndex } from '../types/morph'

/** Выбранные признаки; пустое значение — «любое». Значения — метки корпуса */
export interface GrammarFilter {
  pos: '' | 'V' | 'N'
  form: string // порода глагола: «1»…«10»
  tense: string // PERF | IMPF | IMPV
  pass: boolean // страдательный залог
  person: string // 1 | 2 | 3
  gender: string // M | F
  number: string // S | D | P
  kind: string // для имён: ACT_PCPL | PASS_PCPL | VN | ADJ | PN
  case: string // NOM | GEN | ACC
  mood: string // для глаголов: IND | SUBJ | JUS
}
export const EMPTY_FILTER: GrammarFilter = { pos: '', form: '', tense: '', pass: false, person: '', gender: '', number: '', kind: '', case: '', mood: '' }

export interface GrammarHit { w: string; lemma: string; root: string; n: number; refs: string[] }
export interface GrammarResult { total: number; hits: GrammarHit[] }

const AGREE = /^([123])?([MF])?([SDP])?$/

/** Подходит ли форма (теги основы через «|», первый — часть речи) под фильтр */
function match(tags: string[], f: GrammarFilter): boolean {
  const set = new Set(tags)
  if (f.pos && tags[0] !== f.pos) return false
  if (f.form && !set.has('VF:' + f.form)) return false
  if (f.tense && !set.has(f.tense)) return false
  if (f.pass && !set.has('PASS')) return false
  if (f.kind && !set.has(f.kind)) return false
  if (f.case && !set.has(f.case)) return false
  if (f.mood && !set.has('MOOD:' + f.mood)) return false
  if (f.person || f.gender || f.number) {
    const a = tags.map((t) => (t ? AGREE.exec(t) : null)).find(Boolean)
    if (!a) return false
    if (f.person && a[1] !== f.person) return false
    if (f.gender && a[2] !== f.gender) return false
    if (f.number && a[3] !== f.number) return false
  }
  return true
}

/** Выбран ли хоть один признак (без него искать нечего) */
export const hasFilter = (f: GrammarFilter) => Object.values(f).some((v) => !!v)

/** Все подходящие формы: сколько слов всего и первые по частоте */
export function searchForms(roots: RootIndex, f: GrammarFilter, limit = 120): GrammarResult {
  const hits: GrammarHit[] = []
  let total = 0
  for (const [root, info] of Object.entries(roots)) {
    for (const x of info.f) {
      if (!match(x[2].split('|'), f)) continue
      total += x[3]
      hits.push({ w: x[0], lemma: x[1], root, n: x[3], refs: x[4] })
    }
  }
  hits.sort((a, b) => b.n - a.n)
  return { total, hits: hits.slice(0, limit) }
}
