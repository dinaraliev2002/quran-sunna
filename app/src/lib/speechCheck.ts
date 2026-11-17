// Сверка сказанного вслух с текстом хадиса. Без ИИ: обычное выравнивание слов.
// Слова, которых нет в сказанном, — «пропущено»; другое слово на том же месте — «ошибка»;
// лишние слова (оговорки, «ой, не то», повторы) почти не снижают результат.
// Язык сверки: русский перевод (ru) или арабский текст (ar, без огласовок — см. arabicSpeech.ts).
import { analyzeAr, hasVowels, spokenAr, spokenArFull, vowelDiff } from './arabicSpeech'

export type VoiceLang = 'ru' | 'ar'

export type WordState = 'ok' | 'wrong' | 'missed'

export interface CheckedWord {
  /** слово как в тексте хадиса */
  w: string
  state: WordState
  /** что сказали вместо него (для ошибки) */
  said?: string
  /** ИИ засчитал слово, хотя алгоритм счёл его ошибкой */
  ai?: boolean
  /** ошибка только в огласовке: буквы верные (ИИ такие слова не пересматривает) */
  vowel?: boolean
}

export interface CheckResult {
  words: CheckedWord[]
  /** процент верно сказанных слов эталона, 0–100 */
  percent: number
  ok: number
  wrong: number
  missed: number
  /** сколько лишних слов сказано (после очистки оговорок) */
  extra: number
  /** похоже ли сказанное на этот хадис: совпала ли хоть какая-то доля значимых слов (а не случайные «и», «что») */
  relevant: boolean
}

/** слова-паразиты и «поправки», которые не считаем сказанным текстом */
const FILLERS = new Set(['э', 'ээ', 'эээ', 'м', 'мм', 'ну', 'ой', 'эм', 'так', 'короче', 'простите', 'извините', 'стоп', 'сначала'])
/** цепочки «не то», «нет не так», «то есть» вырезаются целиком */
const FIX_PHRASES = [/\bне то\b/g, /\bнет не так\b/g, /\bнет не то\b/g, /\bто есть\b/g, /\bпростите\b/g, /\bто есть\b/g]

export const normWord = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '')

/** слова текста для сверки: без знаков и без ﷺ (w — как в тексте, n — в общем виде) */
export function refWords(text: string, lang: VoiceLang = 'ru') {
  const toks = text.split(/\s+/).filter(Boolean)
  if (lang === 'ar') { const a = analyzeAr(toks); return toks.map((w, i) => ({ w, n: a[i].n, c: a[i].count })).filter((x) => x.c).map(({ w, n }) => ({ w, n })) }
  return toks.map((w) => ({ w, n: normWord(w) })).filter((x) => x.n)
}

/** Сказанное → список слов без оговорок */
export function spokenWords(text: string, lang: VoiceLang = 'ru'): string[] {
  if (lang === 'ar') return spokenAr(text)
  let t = text.toLowerCase().replace(/ё/g, 'е')
  for (const re of FIX_PHRASES) t = t.replace(re, ' ')
  return t.split(/\s+/).map(normWord).filter((w) => w && !FILLERS.has(w))
}

/** Расстояние Левенштейна для коротких слов */
function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

/** Одно ли это слово: допускаем ошибку распознавания (окончание, одна буква) */
export function sameWord(ref: string, said: string, strict: boolean) {
  if (ref === said) return true
  if (strict) return false
  const m = Math.max(ref.length, said.length)
  if (m < 5) return false
  return lev(ref, said) <= (m >= 9 ? 2 : 1)
}

const EXTRA = 0.25 // цена лишнего слова (оговорки не должны сильно ронять результат)

/** Сверка. strict — без поблажек на неточное распознавание (по умолчанию выключено); в арабском поблажек нет всегда: буква — это ошибка */
export function checkSpeech(reference: string, spoken: string, strict = false, lang: VoiceLang = 'ru', vowels = false): CheckResult {
  if (lang === 'ar') strict = true
  const R = refWords(reference, lang)
  // огласовки сверяем, только если их просили и распознавание их написало (Gemini; Whisper пишет без них)
  const SF = lang === 'ar' ? spokenArFull(spoken) : null
  const S = SF ? SF.map((x) => x.n) : spokenWords(spoken, lang)
  const checkVowels = vowels && !!SF && hasVowels(spoken)
  const n = R.length
  const m = S.length
  // d[i][j] — лучшая цена выравнивания первых i слов эталона и j сказанных
  const d: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) d[i][0] = i
  for (let j = 1; j <= m; j++) d[0][j] = j * EXTRA
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = sameWord(R[i - 1].n, S[j - 1], strict)
      d[i][j] = Math.min(
        d[i - 1][j - 1] + (same ? 0 : 1), // совпало или заменено
        d[i - 1][j] + 1, // слово пропущено
        d[i][j - 1] + EXTRA, // лишнее слово
      )
    }
  }
  // обратный ход
  const words: CheckedWord[] = []
  let i = n
  let j = m
  let extra = 0
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = sameWord(R[i - 1].n, S[j - 1], strict)
      if (d[i][j] === d[i - 1][j - 1] + (same ? 0 : 1)) {
        if (same && checkVowels && vowelDiff(R[i - 1].w, SF![j - 1].raw)) words.push({ w: R[i - 1].w, state: 'wrong', said: SF![j - 1].raw, vowel: true }) // буквы те, огласовка другая
        else words.push(same ? { w: R[i - 1].w, state: 'ok' } : { w: R[i - 1].w, state: 'wrong', said: S[j - 1] })
        i--; j--
        continue
      }
    }
    if (i > 0 && d[i][j] === d[i - 1][j] + 1) { words.push({ w: R[i - 1].w, state: 'missed' }); i--; continue }
    extra++; j--
  }
  words.reverse()
  const ok = words.filter((x) => x.state === 'ok').length
  const wrong = words.filter((x) => x.state === 'wrong').length
  const missed = n - ok - wrong
  // лишние слова (поправки, повторы) процент не снижают: важно, всё ли из хадиса сказано верно
  const percent = n ? Math.round((ok / n) * 100) : 0
  // значимые слова — от 4 букв (в арабском от 3): предлоги и союзы совпадают и в посторонней речи
  const big = R.filter((x) => x.n.length >= (lang === 'ar' ? 3 : 4)).map((x) => words[R.indexOf(x)])
  const bigOk = big.filter((x) => x.state === 'ok').length
  const relevant = big.length === 0 || bigOk / big.length >= 0.2
  return { words, percent, ok, wrong, missed, extra, relevant }
}

/** Спорные слова для ИИ: ошибки и пропуски (номер — позиция среди слов эталона) */
export const flaggedWords = (r: CheckResult) =>
  r.words.map((x, i) => ({ i, w: x.w, said: x.said, state: x.state, vowel: x.vowel })).filter((x) => x.state !== 'ok' && !x.vowel).map(({ i, w, said }) => ({ i, w, said }))

/** Засчитать слова, которые одобрил ИИ, и пересчитать процент */
export function applyAccepted(r: CheckResult, accept: number[]): CheckResult {
  const set = new Set(accept)
  const words = r.words.map((x, i) => (set.has(i) && x.state !== 'ok' ? { w: x.w, state: 'ok' as const, ai: true } : x))
  const ok = words.filter((x) => x.state === 'ok').length
  const wrong = words.filter((x) => x.state === 'wrong').length
  return { ...r, words, ok, wrong, missed: words.length - ok - wrong, percent: words.length ? Math.round((ok / words.length) * 100) : 0 }
}
