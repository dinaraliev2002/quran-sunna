// Подсветка терминов: ищем в русском тексте слова из словаря (приложение к переводу Кулиева) и отмечаем их.
// Русские слова склоняются, поэтому у слова допускаем только обычные падежные окончания (без «lookbehind» — его не понимают старые iPhone).
import { loadGlossary, type GlossaryItem } from './data'

const ART = /^(?:аль|ас|ат|ад|ар|аз|аш|ан|эль)-/i
const ENDINGS = new Set(['', 'а', 'у', 'е', 'ы', 'и', 'я', 'ю', 'ом', 'ем', 'ой', 'ов', 'ей', 'ам', 'ах', 'ами', 'ям', 'ях', 'ию', 'ии', 'ие'])
// слишком общие слова: они были бы подсвечены в каждом абзаце
const SKIP = new Set(['сура', 'аят', 'ад', 'рай', 'хадис']) // «хадис» есть почти в каждом комментарии
// перед этими словами идёт имя человека («Абу Ханифа», «ибн Бадр») — это не термин
const NAME_BEFORE = new Set(['абу', 'ибн', 'бин', 'бинт', 'умм'])
const MIN_STEM = 4
const TOKEN = /[А-Яа-яЁё’‘ʼ'-]+/g

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[’‘ʼ']/g, '')
const words = (s: string) => (s.match(TOKEN) ?? []).map((w) => norm(w.replace(ART, '')))

/** Слово w — это основа stem с обычным окончанием? */
const same = (w: string, stem: string) => w.startsWith(stem) && ENDINGS.has(w.slice(stem.length))

export interface TermMatcher { find: (text: string, seen: Set<string>) => (string | { text: string; item: GlossaryItem })[] }

/** Строит поиск по записям словаря; первое слово записи — ключ, остальные слова проверяются следом */
export function buildMatcher(items: GlossaryItem[]): TermMatcher {
  const byFirst = new Map<string, { item: GlossaryItem; rest: string[] }[]>()
  for (const item of items) {
    const w = words(item.tr)
    if (!w.length || w[0].length < MIN_STEM || SKIP.has(w[0])) continue
    const list = byFirst.get(w[0]) ?? []
    list.push({ item, rest: w.slice(1) })
    byFirst.set(w[0], list)
  }
  // самые длинные записи (из нескольких слов) проверяем первыми
  for (const l of byFirst.values()) l.sort((a, b) => b.rest.length - a.rest.length)

  return {
    find(text, seen) {
      const out: (string | { text: string; item: GlossaryItem })[] = []
      const toks = [...text.matchAll(TOKEN)].map((m) => ({ raw: m[0], i: m.index ?? 0, w: norm(m[0].replace(ART, '')), art: ART.test(m[0]) }))
      let last = 0
      for (let t = 0; t < toks.length; t++) {
        const tk = toks[t]
        if (tk.i < last) continue
        let hit: { item: GlossaryItem; len: number } | null = null
        for (let cut = 0; cut <= 3 && !hit; cut++) {
          const key = tk.w.slice(0, tk.w.length - cut)
          if (key.length < MIN_STEM) break
          for (const c of byFirst.get(key) ?? []) {
            if (!same(tk.w, key)) continue
            if (c.rest.every((r, k) => toks[t + 1 + k] && same(toks[t + 1 + k].w, r))) { hit = { item: c.item, len: c.rest.length + 1 }; break }
          }
        }
        if (!hit || seen.has(hit.item.tr)) continue
        if (tk.art && !ART.test(hit.item.tr)) continue // «аль-Бадр» — это не «Бадр»
        if (t > 0 && NAME_BEFORE.has(toks[t - 1].w)) continue
        const end = toks[t + hit.len - 1]
        seen.add(hit.item.tr) // в одном тексте подсвечиваем только первое упоминание
        if (tk.i > last) out.push(text.slice(last, tk.i))
        out.push({ text: text.slice(tk.i, end.i + end.raw.length), item: hit.item })
        last = end.i + end.raw.length
      }
      if (last < text.length) out.push(text.slice(last))
      return out
    },
  }
}

let matcher: Promise<TermMatcher | null> | null = null
/** Поиск терминов (словарь грузится один раз) */
export function loadTermMatcher() {
  if (!matcher) matcher = loadGlossary().then((g) => (g ? buildMatcher(g) : null))
  return matcher
}
