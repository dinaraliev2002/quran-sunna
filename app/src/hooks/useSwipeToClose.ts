import { useEffect, useRef, type RefObject } from 'react'

/** Закрытие нижнего окна свайпом вниз: за «ручку»/заголовок, а если содержимое прокручено до верха — и за само содержимое. dim — затемнение, тает вместе с окном */
export function useSwipeToClose(ref: RefObject<HTMLDivElement | null>, dimRef: RefObject<HTMLDivElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const sheet = ref.current!
    let startY = 0, startX = 0, lastY = 0, lastT = 0, speed = 0
    let mode: 'none' | 'drag' | 'scroll' = 'none'
    let scroller: HTMLElement | null = null

    const setY = (y: number, anim: boolean) => {
      sheet.style.transition = anim ? 'transform .25s cubic-bezier(.2,.8,.2,1)' : 'none'
      sheet.style.transform = y ? `translateY(${y}px)` : ''
      if (dimRef.current) dimRef.current.style.opacity = String(Math.max(0, 1 - y / sheet.offsetHeight))
    }
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      startY = lastY = t.clientY; startX = t.clientX; lastT = e.timeStamp; speed = 0
      // листается внутренний список, а если его нет — само окно (в альбомной ориентации меню не помещается)
      scroller = (e.target as HTMLElement).closest<HTMLElement>('.body') ?? (sheet.scrollHeight > sheet.clientHeight + 1 ? sheet : null)
      mode = 'none'
    }
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      const dy = t.clientY - startY, dx = t.clientX - startX
      if (mode === 'none') {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return
        const atTop = !scroller || scroller.scrollTop <= 0
        mode = dy > 0 && Math.abs(dy) > Math.abs(dx) && atTop ? 'drag' : 'scroll'
      }
      if (mode !== 'drag') return
      e.preventDefault() // не даём прокрутке/Telegram перехватить жест
      speed = (t.clientY - lastY) / Math.max(1, e.timeStamp - lastT)
      lastY = t.clientY; lastT = e.timeStamp
      setY(Math.max(0, dy), false)
    }
    const onEnd = () => {
      if (mode !== 'drag') return
      const dy = lastY - startY
      if (dy > sheet.offsetHeight * 0.3 || speed > 0.6) {
        setY(sheet.offsetHeight, true)
        setTimeout(() => closeRef.current(), 200)
      } else setY(0, true)
      mode = 'none'
    }
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onEnd)
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
    }
  }, [ref, dimRef])
}
