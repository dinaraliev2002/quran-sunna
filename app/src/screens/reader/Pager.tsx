import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as RPE } from 'react'
import { TOTAL_PAGES } from '../../lib/data'
import { haptic } from '../../lib/telegram'

// Листание страниц как в арабской книге: следующая страница слева, листаем свайпом вправо.
// В DOM всегда три страницы: следующая (слева), текущая, предыдущая (справа).

export function Pager({ page, onChange, render }: { page: number; onChange: (p: number) => void; render: (p: number) => ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  const [anim, setAnim] = useState(false)
  const g = useRef<{ x: number; y: number; horiz: boolean | null; dx: number } | null>(null)

  // сброс сдвига до отрисовки, чтобы новая страница не «дёргалась»
  useLayoutEffect(() => { setDx(0); setAnim(false) }, [page])

  const width = () => trackRef.current?.clientWidth ?? window.innerWidth

  function go(dir: 1 | -1) {
    const next = page + dir
    if (next < 1 || next > TOTAL_PAGES) { setAnim(true); setDx(0); return }
    setAnim(true)
    setDx(dir === 1 ? width() : -width())
    haptic.tick()
    setTimeout(() => onChange(next), 220)
  }

  const onDown = (e: RPE) => { g.current = { x: e.clientX, y: e.clientY, horiz: null, dx: 0 }; setAnim(false) }
  const onMove = (e: RPE) => {
    const s = g.current
    if (!s) return
    const mx = e.clientX - s.x, my = e.clientY - s.y
    if (s.horiz === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.horiz = Math.abs(mx) > Math.abs(my)
    if (s.horiz) { s.dx = mx; setDx(mx) }
  }
  const onUp = () => {
    const s = g.current
    g.current = null
    if (!s?.horiz) return
    if (s.dx > 60) go(1)
    else if (s.dx < -60) go(-1)
    else { setAnim(true); setDx(0) }
  }

  // клавиатура (на компьютере): ← следующая, → предыдущая
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(1); if (e.key === 'ArrowRight') go(-1) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const slot = (p: number, offset: number) =>
    p >= 1 && p <= TOTAL_PAGES ? (
      <div className="slot" key={p} style={{ left: `${offset * 100}%` }}>{render(p)}</div>
    ) : null

  return (
    <div className="pager" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div ref={trackRef} className="track" style={{ transform: `translateX(${dx}px)`, transition: anim ? 'transform .22s ease-out' : 'none' }}>
        {slot(page + 1, -1)}
        {slot(page, 0)}
        {slot(page - 1, 1)}
      </div>
    </div>
  )
}
