// Арабский для проверки голосом: как приводить слова к общему виду и какая часть арабского текста хадиса проверяется.
// Огласовки (харакаты) при сверке не учитываются: облачное распознавание (Whisper) их не пишет.

const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g

/** Слова, у которых усмановское написание (кинжальный алиф ـٰ) отличается от обычного, которым пишет распознавание */
const OSMANI_FIX: Record<string, string> = { الرحمان: 'الرحمن', هاذا: 'هذا', هاذه: 'هذه', ذالك: 'ذلك', لاكن: 'لكن', لاكنا: 'لكنا', اولايك: 'اوليك', الاه: 'اله', اللاه: 'الله', طاها: 'طه', ياس: 'يس' }

/** Слово без огласовок и с единым написанием букв: أإآٱ→ا, ى→ي, ة→ه, ؤ→و, ئ→ي, ء убран; всё, кроме арабских букв, отброшено */
export const normAr = (s: string) => {
  const n = s.replace(/ٰ/g, 'ا').replace(MARKS, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ک/g, 'ك').replace(/ی/g, 'ي').replace(/ء/g, '').replace(/[^ء-ي]/g, '')
  return OSMANI_FIX[n] ?? n
}

/** Слова-формулы, которые произносят вслух, а в тексте они значком (ﷺ) или в скобках: не считаются ни словами хадиса, ни лишними */
const PHRASES = ['صلي الله عليه وسلم', 'رضي الله عنهما', 'رضي الله عنها', 'رضي الله عنه', 'عليه السلام', 'صلي الله عليه واله وسلم']
const PHRASE_WORDS = PHRASES.map((p) => p.split(' '))

export interface ArTok {
  /** слово в общем виде; для приставки «و» отдельным словом — вместе со следующим словом */
  n: string
  /** считается ли слово эталоном (значки, формулы и отдельное «و» — нет) */
  count: boolean
  /** слово как написано (с огласовками), без приставки «و» — для сверки огласовок */
  raw: string
}

/** Разбор подряд идущих слов: формулы убираем, отдельно написанное «و» приклеиваем к следующему слову (как его произносят) */
export function analyzeAr(tokens: string[]): ArTok[] {
  const norm = tokens.map(normAr)
  const out: ArTok[] = norm.map((n, i) => ({ n, count: !!n, raw: tokens[i] }))
  for (let i = 0; i < norm.length; i++) {
    for (const ph of PHRASE_WORDS) {
      if (ph.every((w, k) => norm[i + k] === w)) { for (let k = 0; k < ph.length; k++) out[i + k].count = false; i += ph.length - 1; break }
    }
  }
  let pre = ''
  for (let i = 0; i < out.length; i++) {
    if (!out[i].count) continue
    if (out[i].n === 'و' || out[i].n === 'ف' || out[i].n === 'يا') { pre += out[i].n; out[i].count = false; continue }
    if (pre) { out[i].n = pre + out[i].n; pre = '' }
  }
  return out
}

/** Слова сказанного (из распознанной строки): без значков, формул и оговорок; с исходным написанием (огласовками) */
export function spokenArFull(text: string): { n: string; raw: string }[] {
  const toks = text.split(/\s+/).filter(Boolean)
  return analyzeAr(toks).filter((t) => t.count).map((t) => ({ n: t.n, raw: t.raw }))
}
export const spokenAr = (text: string): string[] => spokenArFull(text).map((t) => t.n)

// ——— огласовки (проверяются, только если распознавание их пишет — Gemini; Whisper не пишет) ———

const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ', SHADDA = 'ّ'

/** Буква в общем виде (как в normAr) или null, если это не буква / хамза, которая не считается */
function letterOf(ch: string): string | null {
  if ('أإآٱ'.includes(ch)) return 'ا'
  if (ch === 'ى' || ch === 'ی') return 'ي'
  if (ch === 'ة') return 'ه'
  if (ch === 'ؤ') return 'و'
  if (ch === 'ئ') return 'ي'
  if (ch === 'ک') return 'ك'
  return /[ء-ي]/.test(ch) && ch !== 'ء' ? ch : null
}

/** Слово → буквы и их огласовки (фатха/дамма/кясра — гласная, шадда — удвоение; сукун и танвин не берём) */
export function vowelSig(word: string): { l: string; v: string; m: boolean }[] {
  const out: { l: string; v: string; m: boolean }[] = [] // m — у буквы есть хоть какой-то знак (в т.ч. сукун)
  let skip = false // идём мимо знаков хамзы (ء)
  for (const ch of word) {
    if (ch === 'ٰ') { out.push({ l: 'ا', v: '', m: false }); skip = false; continue } // кинжальный алиф — это долгий «а»
    const l = letterOf(ch)
    if (l) { out.push({ l, v: '', m: false }); skip = false; continue }
    if (ch === 'ء') { skip = true; continue }
    if (!skip && out.length && /[ً-ْۡ]/.test(ch)) out[out.length - 1].m = true
    if (!skip && out.length && (ch === FATHA || ch === DAMMA || ch === KASRA || ch === SHADDA)) out[out.length - 1].v += ch
  }
  return out
}

/** Есть ли в тексте огласовки (не меньше трети слов с гласной) — иначе сверять нечего */
export function hasVowels(text: string): boolean {
  const w = text.split(/\s+/).filter(Boolean)
  return w.length > 0 && w.filter((x) => /[َُِ]/.test(x)).length / w.length >= 0.33
}

/**
 * Отличается ли произнесённое слово от эталона огласовкой. Слова уже совпали по буквам.
 * Не считаем ошибкой: первую букву (алиф-васль, ассимиляция на стыке слов), последнюю (остановка — вакф),
 * гласную, которую не написали (нет — не значит ошибка), и слова, где у эталона нет огласовок.
 */
export function vowelDiff(refWord: string, saidWord: string): boolean {
  const a = vowelSig(refWord)
  const b = vowelSig(saidWord)
  if (a.length !== b.length || a.some((x, i) => x.l !== b[i].l)) return false
  if (a.filter((x) => x.m).length < a.length / 2) return false // эталон без огласовок
  for (let i = 1; i < a.length - 1; i++) {
    const x = a[i].v, y = b[i].v
    if ((x.includes(SHADDA)) !== (y.includes(SHADDA))) return true // удвоение есть там, где не нужно, или нет там, где нужно
    const vx = x.replace(SHADDA, ''), vy = y.replace(SHADDA, '')
    if (vx && vy && vx !== vy) return true // другая гласная
  }
  return false
}

/** Все слова арабского текста хадиса подряд (абзацы склеены) */
export const arTokens = (ar: string[]) => ar.join(' ').split(/\s+/).filter(Boolean)

/**
 * Какие слова арабского текста проверяются: сами слова Пророка ﷺ — между ﴿ и ﴾ (без слов передатчика и пояснений после);
 * с передатчиком — с самого начала. Если значков нет (часть длинного хадиса) — весь текст.
 * В «Сорока хадисах» в разговоре кавычки могут повторяться — берём до последней ﴾; в «Риядус-салихин» после хадиса идут пояснения — до первой.
 */
export function arSpan(tokens: string[], withNarr: boolean, wholeToLast: boolean): [number, number] {
  const first = tokens.findIndex((t) => t.includes('﴿'))
  const ends = tokens.map((t, i) => (t.includes('﴾') ? i : -1)).filter((i) => i >= 0)
  const a = withNarr || first < 0 ? 0 : first
  const b = ends.length ? (wholeToLast ? ends[ends.length - 1] : ends[0]) + 1 : tokens.length
  return [a, Math.max(a, b)]
}
