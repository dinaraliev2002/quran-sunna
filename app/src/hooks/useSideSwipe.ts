import { useEffect, useRef, type RefObject } from 'react'
import { haptic } from '../lib/telegram'

/** Свайп вбок по прокручиваемому блоку — соседняя сура (как листание страниц: вправо — следующая, влево — предыдущая).
 *  Содержимое едет за пальцем, подсказки «Следующая/Предыдущая» проявляются. */
export function useSideSwipe(
  box: RefObject<HTMLDivElement | null>, content: RefObject<HTMLDivElement | null>,
  hintNext: RefObject<HTMLDivElement | null>, hintPrev: RefObject<HTMLDivElement | null>,
  onSwipe: (dir: 1 | -1) => void, hasNext: boolean, hasPrev: boolean,
) {
  const swipeRef = useRef({ onSwipe, hasNext, hasPrev })
  swipeRef.current = { onSwipe, hasNext, hasPrev }
  useEffect(() => {
    const el = box.current!, c = content.current!
    let x = 0, y = 0, dx = 0, lock: null | 'h' | 'v' = null
    const set = (v: number, anim: boolean) => {
      c.style.transition = anim ? 'transform .28s cubic-bezier(.22,1,.36,1), opacity .28s' : 'none'
      c.style.transform = v ? `translateX(${v}px)` : ''
      c.style.opacity = String(1 - Math.min(0.5, Math.abs(v) / 600))
      const k = Math.min(1, Math.abs(v) / 90)
      if (hintNext.current) hintNext.current.style.opacity = String(v > 0 ? k : 0)
      if (hintPrev.current) hintPrev.current.style.opacity = String(v < 0 ? k : 0)
    }
    const start = (e: TouchEvent) => { x = e.touches[0].clientX; y = e.touches[0].clientY; dx = 0; lock = null }
    const move = (e: TouchEvent) => {
      const mx = e.touches[0].clientX - x, my = e.touches[0].clientY - y
      if (!lock && (Math.abs(mx) > 10 || Math.abs(my) > 10)) lock = Math.abs(mx) > Math.abs(my) * 1.3 ? 'h' : 'v'
      if (lock !== 'h') return
      e.preventDefault()
      const { hasNext, hasPrev } = swipeRef.current
      // у первой/последней суры — «резиновый» упор
      dx = (mx > 0 && !hasNext) || (mx < 0 && !hasPrev) ? mx * 0.25 : mx
      set(dx, false)
    }
    const end = () => {
      if (lock !== 'h') return
      const { hasNext, hasPrev, onSwipe } = swipeRef.current
      if (dx > 90 && hasNext) { set(el.clientWidth, true); haptic.tick(); setTimeout(() => onSwipe(1), 200) }
      else if (dx < -90 && hasPrev) { set(-el.clientWidth, true); haptic.tick(); setTimeout(() => onSwipe(-1), 200) }
      else set(0, true)
      lock = null
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end)
    }
  }, [])
}
