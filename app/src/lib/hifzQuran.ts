// Заучивание Корана: отрывки (сура + аяты с … по …) и то же интервальное повторение, что у хадисов (lib/hifz schedule).
//  • новый отрывок — следующие N аятов (норма в день) с того места, где остановились; по умолчанию — 30-й джуз с конца (114 → 78);
//  • длинные аяты: отрывок не длиннее MAX_WORDS слов (но хотя бы один аят).
import { loadSurah, type Ayah } from './data'
import { dayNum, LEARNED_STAGE, type HifzCard } from './hifz'

/** Ключ отрывка: «сура:с-по» */
export const qKey = (s: number, a: number, b: number) => `${s}:${a}-${b}`
export function parseQKey(k: string) {
  const m = k.match(/^(\d+):(\d+)-(\d+)$/)
  return m ? { s: +m[1], a: +m[2], b: +m[3] } : null
}

/** 30-й джуз с конца: ан-Нас, аль-Фаляк, … ан-Наба */
export const JUZ30 = Array.from({ length: 37 }, (_, i) => 114 - i)
/** Больше стольких слов в отрывке не берём (длинные аяты) */
export const MAX_WORDS = 60
/** Слов в строке мусхафа — в среднем, для подсказки «≈ N строк» */
const WORDS_PER_LINE = 9
export const linesOf = (words: number) => Math.max(1, Math.round(words / WORDS_PER_LINE))
/** Больше стольких аятов в день — предупреждение */
export const MAX_AYAHS = 10

/** Какие аяты суры уже в заучивании */
export function coveredAyahs(cards: Record<string, HifzCard>, s: number) {
  const out = new Set<number>()
  for (const k of Object.keys(cards)) {
    const p = parseQKey(k)
    if (p && p.s === s) for (let i = p.a; i <= p.b; i++) out.add(i)
  }
  return out
}

/** Откуда начать новый отрывок: выбранное место (если ещё не учено), иначе первый неначатый аят 30-го джуза с конца */
export function nextStart(cards: Record<string, HifzCard>, pos: { s: number; a: number } | null, ayahCount: (s: number) => number) {
  if (pos && pos.a <= ayahCount(pos.s)) {
    const cov = coveredAyahs(cards, pos.s)
    let a = pos.a
    while (a <= ayahCount(pos.s) && cov.has(a)) a++
    if (a <= ayahCount(pos.s)) return { s: pos.s, a }
  }
  for (const s of JUZ30) {
    const cov = coveredAyahs(cards, s)
    for (let a = 1; a <= ayahCount(s); a++) if (!cov.has(a)) return { s, a }
  }
  return null
}

/** Отрывок с аята a: до n аятов подряд (не дальше конца суры и уже выученных), не длиннее MAX_WORDS слов */
export function passageFrom(ayahs: Ayah[], cards: Record<string, HifzCard>, s: number, a: number, n: number) {
  const cov = coveredAyahs(cards, s)
  let b = a, words = ayahs[a - 1]?.w.length ?? 0
  while (b - a + 1 < n && b < ayahs.length && !cov.has(b + 1) && words + ayahs[b].w.length <= MAX_WORDS) { words += ayahs[b].w.length; b++ }
  return { s, a, b, words }
}

export interface QItem { key: string; s: number; a: number; b: number; ayahs: Ayah[] }

/** Отрывок по ключу — с текстом аятов */
export async function loadQItem(key: string): Promise<QItem | null> {
  const p = parseQKey(key)
  if (!p) return null
  const ayahs = await loadSurah(p.s)
  return { key, ...p, ayahs: ayahs.slice(p.a - 1, p.b) }
}

/** Прогресс по суре: сколько аятов в заучивании и сколько выучено; ближайший повтор */
export function surahProgress(cards: Record<string, HifzCard>, s: number) {
  let started = 0, learned = 0, due = Infinity, minS = Infinity
  for (const [k, c] of Object.entries(cards)) {
    const p = parseQKey(k)
    if (!p || p.s !== s) continue
    const n = p.b - p.a + 1
    started += n
    if (c.s >= LEARNED_STAGE) learned += n
    due = Math.min(due, c.d)
    minS = Math.min(minS, c.s)
  }
  return { started, learned, due: due === Infinity ? null : due - dayNum(), stage: minS === Infinity ? 0 : minS }
}

// ===== хранение: облако Telegram держит до 4096 символов на ключ — карточки раскладываем по нескольким ключам =====

export const QH_KEY = 'hifzq_v1'
export const QH_SHARDS = 8
const SHARD_LEN = 3900

/** «2:255-257:3:20400,…» → несколько строк, каждая в пределах лимита */
export function qhShards(cards: Record<string, HifzCard>): string[] {
  const out: string[] = ['']
  for (const [k, c] of Object.entries(cards)) {
    const rec = `${k}:${c.s}:${c.d}`
    if (out[out.length - 1].length + rec.length + 1 > SHARD_LEN) {
      if (out.length >= QH_SHARDS) break
      out.push('')
    }
    out[out.length - 1] += (out[out.length - 1] ? ',' : '') + rec
  }
  while (out.length < QH_SHARDS) out.push('')
  return out
}
export function parseQh(parts: string[]): Record<string, HifzCard> {
  const out: Record<string, HifzCard> = {}
  for (const v of parts) for (const rec of v.split(',')) {
    const m = rec.match(/^(\d+:\d+-\d+):(\d+):(\d+)$/)
    if (m && +m[3] > 0) out[m[1]] = { s: +m[2], d: +m[3] }
  }
  return out
}
