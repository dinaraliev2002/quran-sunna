import { phraseGroups } from '../../../lib/wbwPhrases'
import { pageFont, pagePalette, useFontReady } from '../../../lib/fonts'
import { useWordOf } from '../../../lib/wordSync'
import { useWordSheet, WORD_PARSE } from '../../../store/wordSheet'
import { useUi } from '../../../store/ui'
import { useWbw } from '../../../hooks/useWbw'
import type { Ayah } from '../../../types/quran'
import { GlyphWord } from './GlyphWord'
import { QpcText } from './QpcText'

/** Аят по словам: арабское слово (глифом страницы мусхафа, с цветами таджвида) и русская подпись под ним */
export function WbwText({ sid, a, tajweed, hidden }: { sid: number; a: Ayah; tajweed: boolean; hidden: boolean }) {
  const word = useWordOf(`${sid}:${a.n}`) // звучащее слово (0 — нет)
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
  const open = (i: number) => (WORD_PARSE ? () => useWordSheet.getState().open({ s: sid, a: a.n, w: i + 1 }) : undefined)
  const arWord = (i: number) => glyph
    ? <GlyphWord glyph={gl[i]} family={family} ready={ready} style={st!} />
    : colored ? <span className="wa" dangerouslySetInnerHTML={{ __html: parts[i] }} /> : <span className="wa">{a.w[i]}</span>
  // в источнике фраза («من قبلك» — «до тебя») бывает переведена целиком: у следующих слов подписи нет — собираем их в один блок
  const groups = phraseGroups(tr, a.w.length)
  return (
    <div className={'wbw a-wbw' + (glyph && !ready ? ' loading-font' : '') + (hidden ? ' hidden' : '')}>
      {groups.map((g) => g.length === 1 ? (
        <div className={'w' + (word === g[0] + 1 ? ' wl' : '')} key={g[0]} onClick={open(g[0])}>
          {arWord(g[0])}
          <span className="wt">{tr?.[g[0]] || ' '}</span>
        </div>
      ) : (
        <div className="w phrase" key={g[0]}>
          <div className="wphr">
            {g.map((i) => <span key={i} className={'wi' + (word === i + 1 ? ' wl' : '')} onClick={open(i)}>{arWord(i)}</span>)}
          </div>
          <span className="wt">{tr![g[0]]}</span>
        </div>
      ))}
      {/* номер аята — тем же глифом страницы, что и в обычном чтении */}
      <QpcText page={a.p} glyphs={gl[gl.length - 1]} tajweed={tajweed} className="wbw-end" />
    </div>
  )
}
