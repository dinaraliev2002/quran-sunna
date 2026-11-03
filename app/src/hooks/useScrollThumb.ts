import { useEffect, useRef, useState, type DependencyList, type RefObject } from 'react'

/**
 * Полоска прокрутки справа: где мы в тексте — в начале, в середине или у конца.
 * Размер полоски — через состояние (меняется редко), а положение бегунка — напрямую на каждом кадре экрана:
 * так он идёт ровно за пальцем, без перерисовки окна и без запаздывания.
 * Полоска видна только пока листают, через секунду после остановки гаснет.
 * deps — когда содержимое сменилось и полоску надо перемерить.
 */
export function useScrollThumb(bodyRef: RefObject<HTMLDivElement | null>, deps: DependencyList) {
  const [bar, setBar] = useState<{ h: number; areaTop: number; areaH: number } | null>(null)
  const thumbRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const place = () => {
    const el = bodyRef.current, th = thumbRef.current
    if (!el || !th) return
    const max = el.scrollHeight - el.clientHeight
    const pos = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0
    th.style.transform = `translate3d(0, ${pos * (el.clientHeight - 16 - th.offsetHeight)}px, 0)`
  }
  const onScroll = () => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(place)
    barRef.current?.classList.add('on')
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => barRef.current?.classList.remove('on'), 900)
  }
  const measure = () => {
    const el = bodyRef.current
    if (!el || el.scrollHeight <= el.clientHeight + 4) { setBar(null); return }
    const areaH = el.clientHeight - 16
    const next = { h: Math.round(Math.max(28, areaH * (el.clientHeight / el.scrollHeight))), areaTop: el.offsetTop + 8, areaH }
    setBar((b) => (b && b.h === next.h && b.areaTop === next.areaTop && b.areaH === next.areaH ? b : next))
    requestAnimationFrame(place)
  }
  useEffect(() => {
    measure()
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => { ro.disconnect(); cancelAnimationFrame(frame.current); clearTimeout(hideTimer.current) }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { place() }, [bar]) // eslint-disable-line react-hooks/exhaustive-deps
  return { bar, barRef, thumbRef, onScroll }
}
