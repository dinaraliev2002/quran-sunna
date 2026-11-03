import { pageFont, pagePalette, useFontReady } from '../../../lib/fonts'
import { useUi } from '../../../store/ui'
import { useWbw } from '../../../hooks/useWbw'
import type { Ayah } from '../../../types/quran'
import { GlyphWord } from './GlyphWord'
import { QpcText } from './QpcText'

/** Аят по словам: арабское слово (глифом страницы мусхафа, с цветами таджвида) и русская подпись под ним */
export function WbwText({ sid, a, tajweed, hidden }: { sid: number; a: Ayah; tajweed: boolean; hidden: boolean }) {
  const theme = useUi((s) => s.theme)
  const family = pageFont(a.p, tajweed, theme)
  const ready = useFontReady(family)
  const tr = useWbw(sid)?.[a.n - 1]
  const gl = a.g.split(' ')
  const glyph = gl.length === a.w.length + 1 // у части аятов глифы не совпадают со словами — тогда текст Усмани
  const st = glyph ? { fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(a.p) } : undefined
  // запасной вариант: разметка таджвида по словам (пробелы внутри тегов не делят слова)
  const parts = a.tj.replace(/<[^>]+>/g, (m) => m.replace(/ /g, '')).split(' ').map((x) => x.replace(//g, ' '))
  const colored = !glyph && tajweed && parts.length === a.w.length
  return (
    <div className={'wbw a-wbw' + (glyph && !ready ? ' loading-font' : '') + (hidden ? ' hidden' : '')}>
      {a.w.map((w, i) => (
        <div className="w" key={i}>
          {glyph
            ? <GlyphWord glyph={gl[i]} family={family} ready={ready} style={st!} />
            : colored ? <span className="wa" dangerouslySetInnerHTML={{ __html: parts[i] }} /> : <span className="wa">{w}</span>}
          <span className="wt">{tr ? tr[i] || '·' : ' '}</span>
        </div>
      ))}
      {/* номер аята — тем же глифом страницы, что и в обычном чтении */}
      <QpcText page={a.p} glyphs={gl[gl.length - 1]} tajweed={tajweed} className="wbw-end" />
    </div>
  )
}
