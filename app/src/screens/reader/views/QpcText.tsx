import { Fragment, useRef, type MouseEvent } from 'react'
import { pageFont, pagePalette, useFontReady } from '../../../lib/fonts'
import { haptic } from '../../../lib/telegram'
import { useWordOf } from '../../../lib/wordSync'
import { useUi } from '../../../store/ui'
import { useWordSheet, WORD_PARSE } from '../../../store/wordSheet'

// ---------- Текст глифами шрифта страницы мусхафа (пока шрифт грузится — не показываем «квадратики») ----------
// С ayahKey («сура:аят») каждое слово отдельное: звучащее подсвечивается, а двойное нажатие открывает разбор слова.
export function QpcText({ page, glyphs, tajweed, className = '', ayahKey }: { page: number; glyphs: string; tajweed: boolean; className?: string; ayahKey?: string }) {
  const theme = useUi((s) => s.theme)
  const family = pageFont(page, tajweed, theme)
  const ready = useFontReady(family)
  const word = useWordOf(ayahKey) // звучащее слово этого аята (0 — нет)
  const tap = useRef<{ i: number; t: number } | null>(null)
  const split = !!ayahKey && (WORD_PARSE || word > 0)

  // двойное нажатие на слово → разбор слова
  const onClick = (e: MouseEvent) => {
    if (!ayahKey || !WORD_PARSE) return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-w]')
    if (!el) return
    const i = Number(el.dataset.w)
    const now = Date.now()
    if (tap.current && tap.current.i === i && now - tap.current.t < 380) {
      tap.current = null
      haptic.tap()
      const [s, a] = ayahKey.split(':').map(Number)
      useWordSheet.getState().open({ s, a, w: i })
    } else tap.current = { i, t: now }
  }

  return (
    <div className={className + ' qpc' + (ready ? '' : ' loading-font')} style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }} onClick={split ? onClick : undefined}>
      {split
        ? glyphs.split(' ').map((g, i, all) => {
            const isWord = i < all.length - 1 // последнее — знак конца аята
            return <Fragment key={i}>{i > 0 && ' '}<span data-w={isWord ? i + 1 : undefined} className={isWord && i + 1 === word ? 'wl' : undefined}>{g}</span></Fragment>
          })
        : glyphs}
    </div>
  )
}
