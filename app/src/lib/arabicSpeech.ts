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
}

/** Разбор подряд идущих слов: формулы убираем, отдельно написанное «و» приклеиваем к следующему слову (как его произносят) */
export function analyzeAr(tokens: string[]): ArTok[] {
  const norm = tokens.map(normAr)
  const out: ArTok[] = norm.map((n) => ({ n, count: !!n }))
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

/** Слова сказанного (из распознанной строки): без значков, формул и оговорок */
export function spokenAr(text: string): string[] {
  const toks = text.split(/\s+/).filter(Boolean)
  return analyzeAr(toks).filter((t) => t.count).map((t) => t.n)
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
