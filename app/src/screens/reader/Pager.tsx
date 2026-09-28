import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { TOTAL_PAGES } from '../../lib/data'
import { haptic } from '../../lib/telegram'

// Листание страниц как в арабской книге: следующая страница слева.
// Используем нативную прокрутку браузера с «примагничиванием» (scroll-snap) — плавно, с инерцией,
// как в системных приложениях. Все 604 ячейки есть в разметке, но содержимое рисуется только
// у текущей страницы и её соседей.

const Slot = memo(function Slot({ p, active, render }: { p: number; active: boolean; render: (p: number) => ReactNode }) {
  return <div className="hslot">{active ? render(p) : null}</div>
})

export function Pager({ page, onChange, render }: { page: number; onChange: (p: number) => void; render: (p: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(page) // страница, вокруг которой рисуем соседей
  const programmatic = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pageRef = useRef(page)
  pageRef.current = page

  const indexNow = () => {
    const el = ref.current!
    // direction: rtl → scrollLeft отрицательный
    return Math.min(TOTAL_PAGES, Math.max(1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth) + 1))
  }

  // внешняя смена страницы (колесо, «Перейти», чтец) → мгновенно встать на неё
  useLayoutEffect(() => {
    const el = ref.current!
    if (indexNow() === page && Math.abs(Math.abs(el.scrollLeft) - (page - 1) * el.clientWidth) < 2) { setNear(page); return }
    programmatic.current = true
    el.scrollLeft = -(page - 1) * el.clientWidth
    setNear(page)
    requestAnimationFrame(() => { programmatic.current = false })
  }, [page])

  // при повороте экрана/изменении размера — остаться на той же странице
  useEffect(() => {
    const el = ref.current!
    const ro = new ResizeObserver(() => { programmatic.current = true; el.scrollLeft = -(pageRef.current - 1) * el.clientWidth; requestAnimationFrame(() => { programmatic.current = false }) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function onScroll() {
    const p = indexNow()
    if (p !== near) setNear(p)
    if (programmatic.current) return
    clearTimeout(settleTimer.current)
    // страница «встала» → сообщаем наружу
    settleTimer.current = setTimeout(() => {
      const cur = indexNow()
      if (cur !== pageRef.current) { haptic.tick(); onChange(cur) }
    }, 90)
  }

  // клавиатура на компьютере: ← следующая, → предыдущая
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = ref.current!
      if (e.key === 'ArrowLeft') el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' })
      if (e.key === 'ArrowRight') el.scrollBy({ left: el.clientWidth, behavior: 'smooth' })
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <div className="hpager" ref={ref} onScroll={onScroll}>
      {Array.from({ length: TOTAL_PAGES }, (_, i) => (
        <Slot key={i} p={i + 1} active={Math.abs(i + 1 - near) <= 1} render={render} />
      ))}
    </div>
  )
}
