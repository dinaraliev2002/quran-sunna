// Раскладка печатной страницы мусхафа: какие строки — слова, где заголовок суры, «Бисмилля» или пустая строка
import type { MushafPage } from '../types/quran'

export type Line = { kind: 'words'; n: number } | { kind: 'head'; sid: number } | { kind: 'bism' } | { kind: 'empty' }

export function layoutLines(mp: MushafPage): Line[] {
  const nums = Object.keys(mp.lines).map(Number)
  const lastLine = mp.p <= 2 ? Math.max(...nums) : 15
  const startAt = new Map(mp.starts.map(([sid, line]) => [line, sid]))
  const lastWords = mp.lines[String(Math.max(...nums))]
  const lastSid = Number(lastWords[lastWords.length - 1][1].split(':')[0])
  const out: Line[] = []
  let n = 1
  while (n <= lastLine) {
    if (mp.lines[n]) { out.push({ kind: 'words', n }); n++; continue }
    // серия пустых строк: заголовок суры и/или «Бисмилля»
    let end = n
    while (end + 1 <= lastLine && !mp.lines[end + 1]) end++
    const len = end - n + 1
    const atPageEnd = end === lastLine
    const sid = atPageEnd ? lastSid + 1 : startAt.get(end + 1) ?? lastSid
    if (len >= 2) { out.push({ kind: 'head', sid }, sid === 9 || sid === 1 ? { kind: 'empty' } : { kind: 'bism' }); for (let i = 2; i < len; i++) out.push({ kind: 'empty' }) }
    else if (atPageEnd || sid === 9 || sid === 1) out.push({ kind: 'head', sid })
    else out.push({ kind: 'bism' })
    n = end + 1
  }
  return out
}
