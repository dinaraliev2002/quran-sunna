import { useEffect, useLayoutEffect, useRef } from 'react'
import { haptic } from '../../../lib/telegram'
import { tickSound } from '../../../lib/tickSound'

const W = 54 // ширина одной цифры, px

/** Выбор числа повторов: числа 1…max в ряд, листаются вбок; посередине «стеклышко» — число под ним выбрано.
 *  При смене числа — лёгкая вибрация и тихий щелчок */
export function RepeatPick({ value, onChange, max = 30 }: { value: number; onChange: (n: number) => void; max?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const cur = useRef(value)
  const silent = useRef(true)
  const raf = useRef(0)

  // подгоняем крупность цифр под расстояние до стеклышка
  const paint = () => {
    const el = box.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    for (const c of Array.from(el.children) as HTMLElement[]) {
      const d = Math.abs(c.offsetLeft + W / 2 - mid) / W
      c.style.transform = `scale(${Math.max(0.62, 1 - d * 0.2)})`
      c.style.opacity = String(Math.max(0.28, 1 - d * 0.3))
    }
  }

  // поставить колесо на текущее число (при открытии и если число поменяли снаружи)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const left = (value - 1) * W
    if (Math.abs(el.scrollLeft - left) > 2) { silent.current = true; el.scrollLeft = left; setTimeout(() => { silent.current = false }, 120) }
    cur.current = value
    paint()
  }, [value])
  useEffect(() => { const t = setTimeout(() => { silent.current = false }, 150); return () => clearTimeout(t) }, [])

  const onScroll = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(paint)
    const el = box.current!
    const n = Math.max(1, Math.min(max, Math.round(el.scrollLeft / W) + 1))
    if (n === cur.current) return
    cur.current = n
    if (!silent.current) { haptic.tick(); tickSound() }
    onChange(n)
  }
  const go = (n: number) => box.current?.scrollTo({ left: (n - 1) * W, behavior: 'smooth' })

  return (
    <div className="qh-wheel">
      <div className="qh-lens" />
      <div className="qh-scroll" ref={box} onScroll={onScroll}>
        {Array.from({ length: max }, (_, i) => <button key={i} onClick={() => go(i + 1)} aria-label={`${i + 1} раз`}>{i + 1}</button>)}
      </div>
    </div>
  )
}
