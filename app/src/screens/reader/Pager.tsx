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

  // точная (дробная) ширина ячейки: clientWidth округляет до целого, и на дальних страницах
  // ошибка набегает до половины страницы — после поворота экрана магнит уводил на соседнюю
  const slotW = () => ref.current!.getBoundingClientRect().width || ref.current!.clientWidth
  const indexNow = () => {
    const el = ref.current!
    // direction: rtl → scrollLeft отрицательный
    return Math.min(TOTAL_PAGES, Math.max(1, Math.round(Math.abs(el.scrollLeft) / slotW()) + 1))
  }
  const jump = (p: number) => { ref.current!.scrollLeft = -(p - 1) * slotW() }

  // внешняя смена страницы (колесо, «Перейти», чтец) → мгновенно встать на неё
  useLayoutEffect(() => {
    const el = ref.current!
    if (indexNow() === page && Math.abs(Math.abs(el.scrollLeft) - (page - 1) * slotW()) < 2) { setNear(page); return }
    programmatic.current = true
    jump(page)
    setNear(page)
    requestAnimationFrame(() => { programmatic.current = false })
  }, [page])

  // при повороте экрана/изменении размера — остаться на той же странице.
  // Поворот идёт несколькими шагами (Telegram/iOS меняют размер в несколько кадров),
  // поэтому держим прокрутку «своей», пока размер не успокоится, и ставим страницу ещё раз в конце
  useEffect(() => {
    const el = ref.current!
    let settle: ReturnType<typeof setTimeout> | undefined
    const ro = new ResizeObserver(() => {
      programmatic.current = true
      clearTimeout(settleTimer.current)
      jump(pageRef.current)
      clearTimeout(settle)
      settle = setTimeout(() => {
        jump(pageRef.current)
        setNear(pageRef.current)
        requestAnimationFrame(() => { programmatic.current = false })
      }, 350)
    })
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(settle) }
  }, [])

  function onScroll() {
    if (programmatic.current) return
    const p = indexNow()
    if (p !== near) setNear(p)
    clearTimeout(settleTimer.current)
    // страница «встала» → сообщаем наружу
    settleTimer.current = setTimeout(() => {
      const cur = indexNow()
      if (cur !== pageRef.current) { haptic.tick('quran'); onChange(cur) }
    }, 90)
  }

  // клавиатура на компьютере: ← следующая, → предыдущая
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = ref.current!
      if (e.key === 'ArrowLeft') el.scrollBy({ left: -slotW(), behavior: 'smooth' })
      if (e.key === 'ArrowRight') el.scrollBy({ left: slotW(), behavior: 'smooth' })
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
