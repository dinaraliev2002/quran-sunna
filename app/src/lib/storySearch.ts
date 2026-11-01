// Поиск по историям ниспослания и комментариям Кулиева — по всем сурам сразу.
// Индекс строится при первом поиске (около сотни небольших файлов) и хранится, пока открыто приложение.

import { loadAsbabSurah, loadKulievSurah, type AsbabIndex, type KulievIndex } from './data'

export interface StoryHit { s: number; from: number; to: number; kind: 'st' | 'kv'; title: string; text: string; low: string }

const norm = (t: string) => t.toLowerCase().replace(/ё/g, 'е')

let index: Promise<StoryHit[]> | null = null

export function buildStoryIndex(ix: AsbabIndex | null, kx: KulievIndex | null, progress?: (done: number, total: number) => void): Promise<StoryHit[]> {
  if (index) return index
  const stSurahs = ix ? [...new Set([...Object.keys(ix.n ?? {}), ...Object.keys(ix.w ?? {})].map(Number))] : []
  const kvSurahs = kx ? Object.entries(kx.s).filter(([, v]) => v.intro || v.n.length).map(([k]) => Number(k)) : []
  const all = [...new Set([...stSurahs, ...kvSurahs])].sort((a, b) => a - b)
  let done = 0
  index = (async () => {
    const hits: StoryHit[] = []
    const run = async (sid: number) => {
      const [stories, kv] = await Promise.all([
        stSurahs.includes(sid) ? loadAsbabSurah(sid) : null,
        kvSurahs.includes(sid) ? loadKulievSurah(sid) : null,
      ])
      for (const x of stories ?? []) {
        if (x.whole) continue
        const text = [x.main, ...x.opinions].flatMap((o) => [o.title, ...o.parts.filter((p) => p.k !== 'isnad').map((p) => p.t)]).join(' ')
        hits.push({ s: sid, from: x.from, to: x.to, kind: 'st', title: x.main.title, text, low: norm(text) })
      }
      if (kv) {
        if (kv.intro.length) { const text = kv.intro.join(' '); hits.push({ s: sid, from: 1, to: 1, kind: 'kv', title: 'О суре', text, low: norm(text) }) }
        for (const [a, notes] of Object.entries(kv.notes)) {
          const text = notes.flat().join(' ')
          hits.push({ s: sid, from: Number(a), to: Number(a), kind: 'kv', title: `Комментарий к аяту ${a}`, text, low: norm(text) })
        }
      }
      progress?.(++done, all.length)
    }
    // по несколько сур за раз, чтобы не перегружать сеть
    for (let i = 0; i < all.length; i += 6) await Promise.all(all.slice(i, i + 6).map(run))
    return hits
  })().catch((e) => { index = null; throw e })
  return index
}

/** Совпадения: все слова запроса должны встретиться в записи; сначала те, где слова в названии */
export function searchStories(hits: StoryHit[], query: string, kind: 'all' | 'st' | 'kv', onlySurah?: number, limit = 60) {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1)
  if (!words.length) return []
  const out: { hit: StoryHit; score: number; at: number }[] = []
  for (const h of hits) {
    if (kind !== 'all' && h.kind !== kind) continue
    if (onlySurah && h.s !== onlySurah) continue
    if (!words.every((w) => h.low.includes(w))) continue
    const inTitle = words.every((w) => norm(h.title).includes(w))
    out.push({ hit: h, score: inTitle ? 0 : 1, at: h.low.indexOf(words[0]) })
  }
  out.sort((a, b) => a.score - b.score || a.hit.s - b.hit.s || a.hit.from - b.hit.from)
  return out.slice(0, limit)
}

/** Кусок текста вокруг найденного слова */
export function snippet(text: string, query: string, len = 150) {
  const w = norm(query).split(/\s+/).filter((x) => x.length > 1)[0]
  const at = w ? norm(text).indexOf(w) : 0
  const from = Math.max(0, at - 50)
  return (from > 0 ? '…' : '') + text.slice(from, from + len).trim() + (from + len < text.length ? '…' : '')
}
