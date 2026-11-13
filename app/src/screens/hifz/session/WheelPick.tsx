import { useEffect, useLayoutEffect, useRef } from 'react'
import { haptic } from '../../../lib/telegram'
import { tickSound } from '../../../lib/tickSound'

export interface WheelItem<T> { v: T; l: string }

/** w — ширина одной ячейки, px (широкие подписи вроде «0,75×» — больше).
 *  Колесо выбора: значения в ряд, листаются вбок свайпом (докручивается само, как колесо); посередине «стеклышко» — значение под ним выбрано.
 *  При смене значения — лёгкая вибрация и тихий щелчок */
export function WheelPick<T>({ items, value, onChange, w = 40 }: { items: WheelItem<T>[]; value: T; onChange: (v: T) => void; w?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const idx = Math.max(0, items.findIndex((x) => x.v === value))
  const cur = useRef(idx)
  const silent = useRef(true)
  const raf = useRef(0)
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const touching = useRef(false)

  // крупность и яркость цифр — по расстоянию до стеклышка
  const paint = () => {
    const el = box.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    for (const c of Array.from(el.children) as HTMLElement[]) {
      const d = Math.abs(c.offsetLeft + w / 2 - mid) / w
      c.style.transform = `scale(${Math.max(0.7, 1 - d * 0.15)})`
      c.style.opacity = String(Math.max(0.3, 1 - d * 0.3))
    }
  }

  // поставить колесо на текущее значение (при открытии и если его поменяли снаружи)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    if (Math.abs(el.scrollLeft - idx * w) > 2) { silent.current = true; el.scrollLeft = idx * w; setTimeout(() => { silent.current = false }, 120) }
    cur.current = idx
    paint()
  }, [idx])
  useEffect(() => { const t = setTimeout(() => { silent.current = false }, 150); return () => clearTimeout(t) }, [])

  const onScroll = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(paint)
    const el = box.current!
    const n = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / w)))
    if (n !== cur.current) {
      cur.current = n
      if (!silent.current) { haptic.tick(); tickSound() }
      onChange(items[n].v)
    }
    // колесо докрутилось само (инерция) и палец не на нём — плавно становимся ровно на значение
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      if (touching.current || silent.current) return
      if (Math.abs(el.scrollLeft - n * w) > 1) el.scrollTo({ left: n * w, behavior: 'smooth' })
    }, 110)
  }
  const go = (i: number) => box.current?.scrollTo({ left: i * w, behavior: 'smooth' })

  return (
    <div className="qh-wheel" style={{ ['--w' as string]: w + 'px' }}>
      <div className="qh-lens" />
      <div className="qh-scroll" ref={box} onScroll={onScroll} onTouchStart={() => { touching.current = true }} onTouchEnd={() => { touching.current = false }} onTouchCancel={() => { touching.current = false }}>
        {items.map((x, i) => <button key={i} onClick={() => go(i)} aria-label={x.l}>{x.l}</button>)}
      </div>
    </div>
  )
}
