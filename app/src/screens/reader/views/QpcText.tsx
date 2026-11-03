import { pageFont, pagePalette, useFontReady } from '../../../lib/fonts'
import { useUi } from '../../../store/ui'

// ---------- Текст глифами шрифта страницы мусхафа (пока шрифт грузится — не показываем «квадратики») ----------
export function QpcText({ page, glyphs, tajweed, className = '' }: { page: number; glyphs: string; tajweed: boolean; className?: string }) {
  const theme = useUi((s) => s.theme)
  const family = pageFont(page, tajweed, theme)
  const ready = useFontReady(family)
  return (
    <div className={className + ' qpc' + (ready ? '' : ' loading-font')} style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }}>
      {glyphs}
    </div>
  )
}
