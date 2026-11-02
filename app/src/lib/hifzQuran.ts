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

/** Отрезок для заучивания: сура, с аята a по b (b не задан — до конца суры) */
export interface QRange { s: number; a?: number; b?: number }
/** Подборка: что учить по порядку */
export interface QSet { id: string; name: string; sub: string; why?: string; ranges: QRange[] }
const whole = (...ids: number[]) => ids.map((s) => ({ s }))
export const QSETS: QSet[] = [
  { id: 'juz30', name: '30-й джуз · с конца', sub: 'ан-Нас, аль-Фаляк, аль-Ихлас … ан-Наба', why: 'Короткие суры — с них обычно начинают', ranges: whole(...JUZ30) },
  { id: 'salah', name: 'Для намаза', sub: 'аль-Фатиха и 10 коротких сур', why: 'Аль-Фатиха читается в каждом ракаате', ranges: whole(1, 114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 103) },
  { id: 'kursi', name: 'Аят аль-Курси', sub: 'Аль-Бакара, 255', why: 'Величайший аят Корана (Муслим)', ranges: [{ s: 2, a: 255, b: 255 }] },
  { id: 'baqara-end', name: 'Конец суры аль-Бакара', sub: 'Аль-Бакара, 285–286', why: 'Кто прочтёт их ночью, тому их будет достаточно (аль-Бухари, Муслим)', ranges: [{ s: 2, a: 285, b: 286 }] },
  { id: 'kahf10', name: 'Начало суры аль-Кахф', sub: 'Аль-Кахф, 1–10', why: 'Кто выучит первые десять аятов, будет защищён от Даджаля (Муслим)', ranges: [{ s: 18, a: 1, b: 10 }] },
  { id: 'mulk', name: 'Аль-Мульк', sub: '30 аятов', why: 'Сура заступится за читавшего её, пока ему не простят (ат-Тирмизи)', ranges: whole(67) },
  { id: 'juz29', name: '29-й джуз', sub: 'аль-Мульк … аль-Мурсалят', ranges: whole(67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77) },
  { id: 'popular', name: 'Известные суры', sub: 'Йа Син, ар-Рахман, аль-Ваки‘а, ас-Саджда', ranges: whole(36, 55, 56, 32) },
  { id: 'kahf', name: 'Аль-Кахф', sub: '110 аятов', why: 'Сура, которую читают в пятницу', ranges: whole(18) },
]
export const qSet = (id: string) => QSETS.find((x) => x.id === id) ?? QSETS[0]

/** Откуда начать новый отрывок: выбранное место (если ещё не учено), иначе первый неначатый аят подборки. end — последний аят отрезка */
export function nextStart(cards: Record<string, HifzCard>, pos: { s: number; a: number } | null, ayahCount: (s: number) => number, set: QSet = QSETS[0]) {
  if (pos && pos.a <= ayahCount(pos.s)) {
    const cov = coveredAyahs(cards, pos.s)
    let a = pos.a
    while (a <= ayahCount(pos.s) && cov.has(a)) a++
    if (a <= ayahCount(pos.s)) return { s: pos.s, a, end: ayahCount(pos.s) }
  }
  for (const r of set.ranges) {
    const cov = coveredAyahs(cards, r.s)
    const end = r.b ?? ayahCount(r.s)
    for (let a = r.a ?? 1; a <= end; a++) if (!cov.has(a)) return { s: r.s, a, end }
  }
  return null
}

/** Сколько аятов подборки уже в заучивании и сколько всего */
export function setProgress(cards: Record<string, HifzCard>, set: QSet, ayahCount: (s: number) => number) {
  let done = 0, total = 0
  for (const r of set.ranges) {
    const cov = coveredAyahs(cards, r.s)
    const end = r.b ?? ayahCount(r.s)
    for (let a = r.a ?? 1; a <= end; a++) { total++; if (cov.has(a)) done++ }
  }
  return { done, total }
}

/** Отрывок с аята a: до n аятов подряд (не дальше end, конца суры и уже выученных), не длиннее MAX_WORDS слов */
export function passageFrom(ayahs: Ayah[], cards: Record<string, HifzCard>, s: number, a: number, n: number, end = ayahs.length) {
  const cov = coveredAyahs(cards, s)
  let b = a, words = ayahs[a - 1]?.w.length ?? 0
  while (b - a + 1 < n && b < Math.min(end, ayahs.length) && !cov.has(b + 1) && words + ayahs[b].w.length <= MAX_WORDS) { words += ayahs[b].w.length; b++ }
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
