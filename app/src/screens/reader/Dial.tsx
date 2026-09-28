import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { Icon } from '../../components/Icon'
import { TOTAL_PAGES } from '../../lib/data'
import { haptic } from '../../lib/telegram'

const TICK = 9

const Ticks = memo(function Ticks() {
  return (
    <>
      {Array.from({ length: TOTAL_PAGES }, (_, i) => {
        const p = i + 1
        return (
          <div key={p} className={'tk' + (p % 10 === 0 ? ' m10' : p % 5 === 0 ? ' m5' : '')}>
            {p % 10 === 0 && <span>{p}</span>}
          </div>
        )
      })}
    </>
  )
})

/**
 * Колесо страниц 1–604. Крутится влево-вправо; когда останавливается — сообщает страницу.
 * Свайп вверх, тап по подписи или удержание ~0,5 с — открыть выбор суры.
 */
export function Dial({ page, juz, onChange, onOpenPicker }: { page: number; juz: (p: number) => number; onChange: (p: number) => void; onOpenPicker: () => void }) {
  const ruler = useRef<HTMLDivElement>(null)
  const dial = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(page)
  const [pad, setPad] = useState(0)
  const silent = useRef(false)
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [press, setPress] = useState(false)
  const gesture = useRef<{ x: number; y: number; moved: boolean; timer: ReturnType<typeof setTimeout> } | null>(null)

  useLayoutEffect(() => {
    const el = ruler.current!
    const resize = () => setPad((el.clientWidth - TICK) / 2)
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // внешняя смена страницы → повернуть колесо без события
  useEffect(() => {
    const el = ruler.current
    if (!el || !pad) return
    const target = (page - 1) * TICK
    if (Math.abs(el.scrollLeft - target) > 2) {
      silent.current = true
      el.scrollLeft = target
      setTimeout(() => (silent.current = false), 100)
    }
    setShown(page)
  }, [page, pad])

  function onScroll() {
    const el = ruler.current!
    const p = Math.max(1, Math.min(TOTAL_PAGES, Math.round(el.scrollLeft / TICK) + 1))
    if (p !== shown) { setShown(p); if (!silent.current) haptic.tick() }
    if (silent.current) return
    clearTimeout(settle.current)
    settle.current = setTimeout(() => { if (p !== page) onChange(p) }, 180)
  }

  // жесты
  function down(e: RPE) {
    const timer = setTimeout(() => {
      if (gesture.current && !gesture.current.moved) { gesture.current = null; setPress(false); haptic.tap(); onOpenPicker() }
    }, 500)
    gesture.current = { x: e.clientX, y: e.clientY, moved: false, timer }
    setPress(true)
  }
  function move(e: RPE) {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x, dy = e.clientY - g.y
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { g.moved = true; clearTimeout(g.timer); setPress(false) }
    if (dy < -24 && Math.abs(dy) > Math.abs(dx) * 1.2) { clearTimeout(g.timer); gesture.current = null; onOpenPicker() }
    // мышью на компьютере — тащим линейку
    if (e.pointerType === 'mouse' && g.moved && e.buttons) ruler.current!.scrollLeft -= e.movementX
  }
  function up() {
    if (gesture.current) clearTimeout(gesture.current.timer)
    gesture.current = null
    setPress(false)
  }

  return (
    <div ref={dial} className={'dial glass' + (press ? ' press' : '')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
      onWheel={(e) => { ruler.current!.scrollLeft += e.deltaY || e.deltaX }}>
      <div className="grip" />
      <button className="lbl" onPointerDown={(e) => e.stopPropagation()} onClick={onOpenPicker}>
        <Icon id="up" />Стр. {shown}<em>Джуз {juz(shown)}</em>
      </button>
      <div ref={ruler} className="ruler" onScroll={onScroll}>
        <div className="pad" style={{ width: pad }} />
        <Ticks />
        <div className="pad" style={{ width: pad }} />
      </div>
      <div className="needle" />
    </div>
  )
}
