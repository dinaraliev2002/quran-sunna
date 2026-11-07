import { pageFont, pagePalette, useFontReady } from '../../lib/fonts'
import type { AzkarQuran } from '../../types/azkar'
import { useStore } from '../../store/settings'
import { useUi } from '../../store/ui'

// Аят внутри азкара — глифами шрифта страницы мусхафа, ровно так же, как в разделе Корана.
// Текст не набирается буквами, поэтому огласовки и знаки не могут разойтись с мусхафом.

function Chunk({ page, glyphs }: { page: number; glyphs: string }) {
  const tajweed = useStore((s) => s.tajweed)
  const theme = useUi((s) => s.theme)
  const family = pageFont(page, tajweed, theme)
  const ready = useFontReady(family)
  return <span className={'azt-q qpc' + (ready ? '' : ' loading')} style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }}>{glyphs}</span>
}

export function QuranPart({ part }: { part: AzkarQuran }) {
  return <>{part.q.map(([p, g], i) => <Chunk key={i} page={p} glyphs={g} />)}</>
}
