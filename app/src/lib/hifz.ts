// Заучивание хадисов: подборки из public/data/hifz (см. scripts/build-hifz.py), «Мой набор» и интервальное повторение.
//  • выучил новый хадис → повтор завтра;
//  • при повторе «Хорошо» — следующий интервал (1 → 3 → 7 → 14 → 30 → 60 дней),
//    «Средне» — тот же интервал ещё раз, «Плохо» — прогресс сбрасывается, снова завтра.
import { DATA_BASE } from './data'
import { isSourcePara, loadBook, loadEnc, loadHadithIndex } from './hadith'
import { cachedJson, dataKey } from './net'

export interface HifzItem {
  /** ключ карточки повторения: префикс набора + номер («n1», «r13», «u3») */
  key: string
  /** номер для показа (в сборнике) */
  id: number
  /** заголовок в сборнике */
  t: string
  /** подсказка для повторения: «Расскажи хадис …» */
  q: string
  /** передатчик-сподвижник (может быть пустым — у своих хадисов) */
  by: string
  /** где приводится */
  src: string
  /** вводные слова перевода («Сообщается, что ‘Умар … сказал:») */
  intro: string
  /** что заучивается — абзацы перевода */
  ru: string[]
  /** [абзац, слово], с которого начинаются сами слова Пророка ﷺ */
  start: [number, number]
  /** подсказка «начало хадиса» */
  hint: string
  ar: string[]
  /** озвучка (есть у готовых подборок) */
  audio?: string
  /** часть длинного хадиса: [номер части, всего частей] (ключ тогда «n2.1») */
  part?: [number, number]
  /** слова части среди всех слов хадиса (вводные + перевод): [с, до) — для озвучки части */
  range?: [number, number]
  /** у части — целый хадис, из которого она вырезана (чтобы переразбить) */
  whole?: HifzItem
}
interface SetFile { id: string; name: string; items: Omit<HifzItem, 'key' | 'audio'>[] }

/** Карточка в повторении: s — ступень (номер интервала), d — день следующего повтора */
export interface HifzCard { s: number; d: number }
export type Grade = 'bad' | 'mid' | 'good'
/** Хадис в «Моём наборе»: номер, откуда (как в избранном: «c:сборник:книга:номер» или «e:id»), подсказка */
export interface MyHifz { id: number; r: string; q: string }

export const INTERVALS = [1, 3, 7, 14, 30, 60]
/** С этой ступени хадис считается выученным (прошёл повтор через 2 недели) */
export const LEARNED_STAGE = 4
/** Больше стольких новых хадисов в день — предупреждение */
export const MAX_NEW = 5

export type SetId = 'nawawi' | 'riyad' | 'my'
export const SETS: { id: SetId; prefix: string; name: string; short: string; ar: string; size?: number }[] = [
  { id: 'nawawi', prefix: 'n', name: '40 хадисов ан-Навави', short: 'ан-Навави', ar: 'الأربعون النووية', size: 42 },
  { id: 'riyad', prefix: 'r', name: 'Рияд ас-Салихин: главное', short: 'Рияд ас-Салихин', ar: 'رياض الصالحين', size: 44 },
  { id: 'my', prefix: 'u', name: 'Мой набор', short: 'Мой набор', ar: 'مختاراتي' },
]
/** Ключ хадиса без номера части: «n2.1» → «n2» */
export const baseOf = (key: string) => key.split('.')[0]
export const setOf = (key: string) => SETS.find((s) => s.prefix === key[0]) ?? SETS[0]
export const setById = (id: string) => SETS.find((s) => s.id === id) ?? SETS[0]

const HIFZ_VERSION = 3
const cache = new Map<string, Promise<HifzItem[]>>()
/** Хадисы готовой подборки */
function loadFixedSet(id: SetId): Promise<HifzItem[]> {
  if (!cache.has(id)) {
    const set = setById(id)
    const p = cachedJson<SetFile>(dataKey(`hifz/${id}.json?v=${HIFZ_VERSION}`), `${DATA_BASE}hifz/${id}.json?v=${HIFZ_VERSION}`)
      .then((f) => f.items.map((it) => ({ ...it, key: set.prefix + it.id, audio: `${DATA_BASE}hifz/audio/${id}/${it.id}.mp3?v=${HIFZ_VERSION}` })))
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return cache.get(id)!
}

/** Хадисы набора (для «Моего набора» — текст подгружается из сборников и «Энциклопедии») */
export function loadHifzSet(id: SetId, my: MyHifz[]): Promise<HifzItem[]> {
  if (id !== 'my') return loadFixedSet(id)
  return Promise.all(my.map((m) => loadMyItem(m).catch(() => null))).then((list) => list.filter((x): x is HifzItem => !!x))
}

/** Хадисы по ключам карточек — из всех наборов (для повторения); split — на сколько частей разбит хадис */
export async function loadByKeys(keys: string[], my: MyHifz[], split: Record<string, Split>): Promise<HifzItem[]> {
  const sets = [...new Set(keys.map((k) => setOf(k).id))]
  const bases = keys.map(baseOf)
  const items = (await Promise.all(sets.map((s) => loadHifzSet(s, my.filter((m) => bases.includes('u' + m.id)))))).flat()
  return expand(items, split).filter((u) => keys.includes(u.key))
}

// ===== длинные хадисы — по частям =====

/** С какого числа слов хадис считается длинным (предлагаем учить частями); на 3 части — от LONG3_WORDS */
export const LONG_WORDS = 60
export const LONG3_WORDS = 110

/** Слова самого хадиса (без «Я слышал, как Посланник Аллаха ﷺ сказал:») */
export const bodyWords = (it: HifzItem) => it.ru.slice(it.start[0]).join(' ').split(/\s+/).filter(Boolean).length - it.start[1]

/** Как разбит хадис: число частей (поровну, автоматически) или свои места разрезов — номера слов перевода, с которых начинаются части 2, 3, … */
export type Split = number | number[]
export const partsOf = (v: Split | undefined) => (Array.isArray(v) ? v.length + 1 : v ?? 1)

/** Хадисы → то, что учится по отдельности: целый хадис или его части */
export const expand = (items: HifzItem[], split: Record<string, Split>) => items.flatMap((it) => (partsOf(split[it.key]) > 1 ? splitItem(it, split[it.key]) : [it]))

/** Слова перевода с номером абзаца */
export const ruWords = (it: HifzItem) => it.ru.flatMap((p, pi) => p.split(/\s+/).filter(Boolean).map((w) => ({ w, pi })))
/** Сколько слов до начала самих слов Пророка ﷺ (они всегда в первой части) */
const preWords = (it: HifzItem) => it.ru.slice(0, it.start[0]).join(' ').split(/\s+/).filter(Boolean).length + it.start[1]

/** Разрезы «поровну на n частей» — по концам предложений (или абзацев), примерно равные */
export function autoCuts(it: HifzItem, n: number): number[] {
  const words = ruWords(it)
  const first = preWords(it)
  const body = words.length - first
  const cuts = [first]
  for (let k = 1; k < n; k++) {
    const target = first + Math.round((body * k) / n)
    let best = target, bestScore = -Infinity
    for (let i = cuts[cuts.length - 1] + 3; i < words.length - 3; i++) {
      const w = words[i - 1].w
      const kind = words[i].pi !== words[i - 1].pi ? 8 : /[.!?]["»”“)]*$/.test(w) ? 7 : /[;:]$/.test(w) ? 4 : /,$/.test(w) ? 2 : 0
      if (!kind) continue
      // отойти от середины на 10% длины части стоит 4 очка: части выходят примерно равными
      const score = kind - (40 * Math.abs(i - target)) / (body / n)
      if (score > bestScore) { bestScore = score; best = i }
    }
    cuts.push(best)
  }
  return cuts.slice(1)
}

/** Разбить хадис на части: поровну на n или по своим разрезам */
export function splitItem(it: HifzItem, split: Split): HifzItem[] {
  const words = ruWords(it)
  const cuts = (Array.isArray(split) ? split : autoCuts(it, split)).filter((c) => c > 0 && c < words.length)
  const bounds = [0, ...cuts, words.length]
  const n = bounds.length - 1
  const first = preWords(it)
  const introLen = it.intro.split(/\s+/).filter(Boolean).length
  return Array.from({ length: n }, (_, k) => {
    const ws = words.slice(bounds[k], bounds[k + 1])
    const ru: string[] = []
    ws.forEach((x, i) => { if (i === 0 || x.pi !== ws[i - 1].pi) ru.push(x.w); else ru[ru.length - 1] += ' ' + x.w })
    const skip = k === 0 ? Math.min(first, ws.length - 1) : 0
    const hintWords = ws.slice(skip, skip + 4).map((x) => x.w).join(' ')
    return {
      ...it,
      key: `${it.key}.${k + 1}`,
      part: [k + 1, n] as [number, number],
      whole: it,
      // озвучка части: с первого слова части (у первой — с вводных слов) до начала следующей
      range: [k === 0 ? 0 : introLen + bounds[k], introLen + bounds[k + 1]] as [number, number],
      intro: k === 0 ? it.intro : '',
      ru: k === 0 ? ru : ['…' + ru[0], ...ru.slice(1)],
      start: k === 0 ? it.start : [0, 0] as [number, number],
      hint: hintWords.replace(/[«»“”„]/g, '').replace(/[,.;:]$/, '') + '…',
    }
  })
}

/** Хадис по частям: сколько начато и выучено (хадис выучен, когда выучены все его части) */
export function hadithProgress(hifz: Record<string, HifzCard>, prefix: string, split: Record<string, Split>) {
  const by = new Map<string, HifzCard[]>()
  for (const [k, c] of Object.entries(hifz)) {
    if (!k.startsWith(prefix)) continue
    const b = baseOf(k)
    by.set(b, [...(by.get(b) ?? []), c])
  }
  let learned = 0
  for (const [b, cs] of by) if (cs.length >= partsOf(split[b]) && cs.every((c) => c.s >= LEARNED_STAGE)) learned++
  return { started: by.size, learned }
}

// ===== «Мой набор»: хадис из сборника или «Энциклопедии» → карточка заучивания =====

// ссылка на источник в конце абзаца («(Этот хадис передал Муслим 2564)»)
const SOURCE = /\s*\(?(?:Этот хадис|Хадис хороший|Достоверный хадис|Ибн Маджах \d|[Аа]ль-Бухари(?: \d|;|\))|Муслим \d|Передал)/

async function loadMyItem(m: MyHifz): Promise<HifzItem | null> {
  const p = m.r.split(':')
  if (p[0] === 'e') {
    const h = await loadEnc(Number(p[1]))
    if (!h) return null
    const body = h.in ? h.ru.slice(h.in.length).trim() : h.ru
    return finish({ key: 'u' + m.id, id: m.id, t: h.t, q: m.q || h.t, by: '', src: h.src, intro: h.in, ru: [body], ar: h.ar ? [h.ar] : [] })
  }
  const [cid, n, i] = [p[1], Number(p[2]), Number(p[3])]
  const [book, idx] = await Promise.all([loadBook(cid, n), loadHadithIndex()])
  const it = book.items[i]
  if (!it) return null
  const col = idx.collections.find((c) => c.id === cid)
  const paras = it.ru.filter((x) => !isSourcePara(x)).map((x) => x.replace(/\*\*/g, '').replace(/^\d+ — /, '').replace(/^— /, '').split(SOURCE)[0].trim()).filter(Boolean)
  if (!paras.length) return null
  let intro = '', ru = paras
  if (paras[0].endsWith(':')) { intro = paras[0]; ru = paras.slice(1) }
  else if (paras[0].indexOf('«') > 0) { const k = paras[0].indexOf('«'); intro = paras[0].slice(0, k).trim(); ru = [paras[0].slice(k), ...paras.slice(1)] }
  const no = it.t.match(/^(\d+)\./)?.[1] ?? it.h
  return finish({ key: 'u' + m.id, id: m.id, t: it.t.replace(/^\d+\.\s*/, ''), q: m.q || it.t.replace(/^\d+\.\s*/, ''), by: '', src: `${col?.name ?? ''}${no ? `, № ${no}` : ''}`, intro, ru: ru.length ? ru : paras, ar: it.ar })
}

/** Начало самих слов Пророка ﷺ и подсказка — как в scripts/build-hifz.py */
function finish(it: Omit<HifzItem, 'start' | 'hint'>): HifzItem {
  const first = it.ru[0] ?? ''
  const m = first.match(/(?:сказал|говорил|говорит|сказал нам|сказал мне)\s*:\s*[«“„]+/)
  let start: [number, number] = [0, 0]
  if (m && m.index! < 160 && !/[«“„»”]/.test(first.slice(1, m.index))) start = [0, first.slice(0, m.index! + m[0].length).replace(/[«“„]+$/, '').split(/\s+/).filter(Boolean).length]
  const words = it.ru.join(' ').split(/\s+/).filter(Boolean).slice(start[1])
  const hint = words.slice(0, 4).join(' ').replace(/[«»“”„]/g, '').replace(/[,.;:]$/, '') + '…'
  return { ...it, start, hint }
}

/** Номер дня (по местному времени) */
export const dayNum = (t = Date.now()) => Math.floor((t - new Date(t).getTimezoneOffset() * 6e4) / 864e5)

/** Новая карточка после оценки */
export function schedule(card: HifzCard | undefined, grade: Grade, today = dayNum()): HifzCard {
  if (!card || grade === 'bad') return { s: 0, d: today + INTERVALS[0] }
  const s = grade === 'good' ? Math.min(card.s + 1, INTERVALS.length - 1) : card.s
  return { s, d: today + INTERVALS[s] }
}

/** Через сколько дней вернётся хадис при такой оценке */
export const nextInterval = (card: HifzCard | undefined, grade: Grade) => schedule(card, grade, 0).d

export function inDays(n: number) {
  if (n <= 0) return 'сегодня'
  if (n === 1) return 'завтра'
  if (n === 2) return 'послезавтра'
  if (n % 30 === 0) return n === 30 ? 'через месяц' : `через ${n / 30} ${n / 30 < 5 ? 'месяца' : 'месяцев'}`
  if (n % 7 === 0) return n === 7 ? 'через неделю' : `через ${n / 7} ${n / 7 < 5 ? 'недели' : 'недель'}`
  const m10 = n % 10, m100 = n % 100
  const w = m10 === 1 && m100 !== 11 ? 'день' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'дня' : 'дней'
  return `через ${n} ${w}`
}

// ===== упражнения: текст → слова =====

export interface Word { w: string; /** есть ли в слове буквы (а не только знаки, «ﷺ», тире) */ letter: boolean; /** слово из самого хадиса (после «… сказал:») */ body: boolean }

/** Слова хадиса по абзацам */
export function toWords(paras: string[], start: [number, number] = [0, 0]): Word[][] {
  return paras.map((p, pi) => p.split(/\s+/).filter(Boolean).map((w, wi) => ({
    w,
    letter: /[a-zа-яё]/i.test(w) && w !== 'ﷺ',
    body: pi > start[0] || (pi === start[0] && wi >= start[1]),
  })))
}

/** Скрываемые слова: каждое n-е (n = 3 → треть, 2 → половина, 1 → все); только в самом хадисе */
export function hiddenMask(words: Word[][], every: number, seed = 0): boolean[][] {
  let k = seed
  return words.map((p) => p.map((w) => w.letter && w.body && (every === 1 || k++ % every === every - 1)))
}

/** Первая буква слова, остальные — точками; знаки препинания остаются */
export function firstLetter(w: string) {
  const m = w.match(/^([^a-zа-яё]*)([a-zа-яё])([a-zа-яё\-‘’]*)(.*)$/i)
  if (!m) return w
  return m[1] + m[2] + '·'.repeat(Math.min(m[3].length, 6)) + m[4]
}

/** Кусочки для сборки: по ~size слов, режем по знакам препинания, если они рядом */
export function toChunks(paras: string[], size = 6): string[] {
  const out: string[] = []
  for (const p of paras) {
    const ws = p.split(/\s+/).filter(Boolean)
    let cur: string[] = []
    ws.forEach((w, i) => {
      cur.push(w)
      const punct = /[,.;:!?»”—]$/.test(w)
      const left = ws.length - i - 1
      if ((cur.length >= size && (punct || cur.length >= size + 3)) || (punct && cur.length >= size - 2 && left > 2)) {
        out.push(cur.join(' '))
        cur = []
      }
    })
    if (cur.length) {
      // хвост из 1–2 слов — к предыдущему кусочку
      if (cur.length < 3 && out.length) out[out.length - 1] += ' ' + cur.join(' ')
      else out.push(cur.join(' '))
    }
  }
  return out
}

export function shuffled<T>(a: T[]): T[] {
  const r = a.slice()
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]]
  }
  return r
}
