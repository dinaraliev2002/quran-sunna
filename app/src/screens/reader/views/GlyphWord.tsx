import { useLayoutEffect, useRef } from 'react'

/** Слово глифом страницы: у растянутых (кашида) слов «хвост» выходит за поле глифа — расширяем поля, чтобы он поместился в рамку */
export function GlyphWord({ glyph, family, ready, style }: { glyph: string; family: string; ready: boolean; style: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current, box = el?.parentElement
    if (!el || !box || !ready) return
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.font = `${getComputedStyle(el).fontSize} '${family}'`
    const m = ctx.measureText(glyph)
    const over = Math.max(0, m.actualBoundingBoxLeft + m.actualBoundingBoxRight - m.width)
    box.style.paddingInline = `${12 + Math.ceil(over / 2)}px`
  }, [ready, family, glyph])
  return <span ref={ref} className="wa qpc" style={style}>{glyph}</span>
}
