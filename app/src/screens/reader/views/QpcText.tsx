import { Fragment } from 'react'
import { pageFont, pagePalette, useFontReady } from '../../../lib/fonts'
import { useWordOf } from '../../../lib/wordSync'
import { useUi } from '../../../store/ui'

// ---------- Текст глифами шрифта страницы мусхафа (пока шрифт грузится — не показываем «квадратики») ----------
export function QpcText({ page, glyphs, tajweed, className = '', ayahKey }: { page: number; glyphs: string; tajweed: boolean; className?: string; ayahKey?: string }) {
  const theme = useUi((s) => s.theme)
  const family = pageFont(page, tajweed, theme)
  const ready = useFontReady(family)
  const word = useWordOf(ayahKey) // звучащее слово этого аята (0 — нет)
  return (
    <div className={className + ' qpc' + (ready ? '' : ' loading-font')} style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }}>
      {word > 0
        ? glyphs.split(' ').map((g, i, all) => <Fragment key={i}>{i > 0 && ' '}<span className={i + 1 === word && i < all.length - 1 ? 'wl' : undefined}>{g}</span></Fragment>)
        : glyphs}
    </div>
  )
}
