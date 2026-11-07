import { arDigits } from '../../../lib/data'
import { wordCaption } from '../../../lib/wbwPhrases'
import { pageFont, pagePalette, useFontReady } from '../../../lib/fonts'
import { useUi } from '../../../store/ui'
import type { Ayah } from '../../../types/quran'
import { GlyphWord } from './GlyphWord'
import { QpcText } from './QpcText'

/**
 * Аят по словам для заучивания: глифы страницы мусхафа (с таджвидом), скрытые слова — пустые рамки той же ширины.
 * hide(i) — скрыто ли слово i; нажатие на скрытое слово — onPeek(i).
 */
export function AyahWords({ a, tajweed, hide, onPeek, tr, after }: { a: Ayah; tajweed: boolean; hide?: (i: number) => boolean; onPeek?: (i: number) => void; tr?: string[] | null; after?: React.ReactNode }) {
  const theme = useUi((s) => s.theme)
  const family = pageFont(a.p, tajweed, theme)
  const ready = useFontReady(family)
  const gl = a.g.split(' ')
  const glyph = gl.length === a.w.length + 1
  const parts = a.tj.replace(/<[^>]+>/g, (m) => m.replace(/ /g, '')).split(' ').map((x) => x.replace(//g, ' '))
  const colored = !glyph && tajweed && parts.length === a.w.length
  const st = glyph ? { fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(a.p) } : undefined
  // пословный перевод (tr задан): слово и русская подпись под ним; у скрытого слова подпись остаётся — подсказка по смыслу
  if (tr !== undefined) return (
    <div className={'wbw a-wbw qw-wbw' + (glyph && !ready ? ' loading-font' : '')}>
      {a.w.map((w, i) => {
        const word = glyph ? <GlyphWord glyph={gl[i]} family={family} ready={ready} style={st!} /> : colored ? <span className="wa" dangerouslySetInnerHTML={{ __html: parts[i] }} /> : <span className="wa">{w}</span>
        const t = <span className="wt">{wordCaption(tr, i)}</span>
        return hide?.(i)
          ? <button key={i} className="w gap" onClick={() => onPeek?.(i)} aria-label="Показать слово">{word}{t}</button>
          : <div key={i} className="w">{word}{t}</div>
      })}
      {glyph ? <QpcText page={a.p} glyphs={gl[gl.length - 1]} tajweed={tajweed} className="wbw-end" /> : <span className="wbw-end qw txt end">{arDigits(a.n)}</span>}
      {after}
    </div>
  )
  return (
    <div className={'qw-ayah' + (glyph ? ' qpc' : '') + (glyph && !ready ? ' loading-font' : '')} dir="rtl" style={st}>
      {a.w.map((w, i) => {
        const inner = glyph ? gl[i] : colored ? <span dangerouslySetInnerHTML={{ __html: parts[i] }} /> : w
        return hide?.(i)
          ? <button key={i} className={'qw gap' + (glyph ? '' : ' txt')} onClick={() => onPeek?.(i)} aria-label="Показать слово"><span>{inner}</span></button>
          : <span key={i} className={'qw' + (glyph ? '' : ' txt')}>{inner}</span>
      })}
      {glyph ? <span className="qw end">{gl[gl.length - 1]}</span> : <span className="qw txt end">{arDigits(a.n)}</span>}
      {after}
    </div>
  )
}
