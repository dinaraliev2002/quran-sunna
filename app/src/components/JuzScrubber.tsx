import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { haptic } from '../lib/telegram'
import { juzByPage } from '../lib/data'
import type { Surah } from '../types/quran'
import './JuzScrubber.css'

// Шкала джузов у правого края списка сур: появляется, пока листают; бегунок можно зажать и перетащить на нужный джуз.
// Лежит выше боковой панели разделов (QuickMenu), поэтому во время прокрутки перекрывает её язычок.

const MARKS = [1, 5, 10, 15, 20, 25, 30]
const PAD = 22 // отступ от краёв шкалы, чтобы бегунок и цифры 1 и 30 не выходили за её рамки
/** положение джуза на шкале: от верхнего до нижнего отступа */
const place = (j: number) => `calc(${PAD}px + (100% - ${PAD * 2}px) * ${(j - 1) / 29})`

export function JuzScrubber({ scroll, surahs, juzPages, enabled, onHold }: { scroll: RefObject<HTMLDivElement | null>; surahs: Surah[]; juzPages: number[]; enabled: boolean; /** бегунок зажали / отпустили — список в это время не должен показывать верхние кнопки */ onHold?: (on: boolean) => void }) {
  const [on, setOn] = useState(false) // шкала видна
  const [juz, setJuz] = useState(1) // джуз сура наверху списка (или выбранный бегунком)
  const [name, setName] = useState('')
  const [held, setHeld] = useState(false) // бегунок зажат — показываем подсказку с названием суры
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined)
  const frame = useRef(0)
  const last = useRef(0)

  const keepVisible = useCallback((ms = 1100) => {
    setOn(true)
    clearTimeout(hide.current)
    if (!dragging.current) hide.current = setTimeout(() => setOn(false), ms)
  }, [])

  /** Первая сура, видимая под шапкой: по ней определяем, какой сейчас джуз */
  const topSurah = useCallback(() => {
    const el = scroll.current, tr = track.current
    if (!el || !tr) return null
    const y = tr.getBoundingClientRect().top
    const rows = el.querySelectorAll<HTMLElement>('.srow')
    for (let i = 0; i < rows.length; i++) if (rows[i].getBoundingClientRect().bottom > y + 4) return surahs[i] ?? null
    return null
  }, [scroll, surahs])

  useEffect(() => {
    const el = scroll.current
    if (!enabled || !el) return
    const onScroll = () => {
      if (dragging.current) return
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const s = topSurah()
        if (s) { setJuz(juzByPage(juzPages, s.pages[0])); setName(s.name) }
      })
      keepVisible()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame.current); clearTimeout(hide.current) }
  }, [scroll, enabled, juzPages, topSurah, keepVisible])

  useEffect(() => { if (!enabled) setOn(false) }, [enabled])

  /** Прыгнуть к первой суре, которая захватывает начало джуза j */
  const jump = (j: number) => {
    const el = scroll.current, tr = track.current
    if (!el || !tr) return
    const page = juzPages[j - 1]
    const i = surahs.findIndex((s) => s.pages[1] >= page)
    const row = el.querySelectorAll<HTMLElement>('.srow')[i < 0 ? 0 : i]
    if (!row) return
    setName(surahs[i < 0 ? 0 : i].name)
    el.querySelectorAll('.juz-flash').forEach((x) => x.classList.remove('juz-flash'))
    row.classList.add('juz-flash') // первая сура джуза чуть подсвечивается
    setTimeout(() => row.classList.remove('juz-flash'), 1600)
    el.scrollTop += row.getBoundingClientRect().top - tr.getBoundingClientRect().top
  }

  /** Положение бегунка и подсказки — одна CSS-переменная (--y, в пикселях от верха шкалы). Двигаем через translate:
   *  это делает видеокарта, без пересчёта страницы. (Прошлая анимация меняла top — каждый кадр пересчитывалась
   *  страница и размытие под шкалой, и на iPhone всё тормозило.) */
  const root = useRef<HTMLDivElement>(null)
  const setY = (f: number) => {
    const h = track.current?.clientHeight ?? 0
    root.current?.style.setProperty('--y', (PAD + (h - PAD * 2) * f).toFixed(1) + 'px')
  }

  const at = (e: React.PointerEvent) => {
    const r = track.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientY - r.top - PAD) / (r.height - PAD * 2)))
    setY(f) // пока палец на шкале — бегунок идёт прямо за ним, без рывков по джузам
    const j = Math.round(f * 29) + 1
    setJuz(j)
    if (j !== last.current) { last.current = j; haptic.tick(); jump(j) }
  }
  const down = (e: React.PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; setHeld(true); onHold?.(true); keepVisible(); at(e) }
  const move = (e: React.PointerEvent<HTMLDivElement>) => { if (dragging.current) at(e) }
  const up = () => { dragging.current = false; setHeld(false); onHold?.(false); last.current = 0; keepVisible(900) }

  // в покое (палец отпущен, список листают) бегунок стоит на своём джузе — плавно «доезжает» до него
  useLayoutEffect(() => { if (!dragging.current) setY((juz - 1) / 29) }, [juz, held, on, enabled])

  // Экран со списком уходит (переход на другой экран): шкала нарисована поверх всего, поэтому прячем её сразу,
  // иначе она на долю секунды видна над новым экраном
  useLayoutEffect(() => {
    if (root.current) root.current.style.visibility = scroll.current?.closest('.pt-out') ? 'hidden' : ''
  })

  if (!enabled) return null
  // выносим в <body>: контейнер экрана создаёт свой «слой», и шкала оказалась бы под боковой панелью
  return createPortal(
    <div ref={root} className={'js' + (on ? ' on' : '') + (held ? ' held' : '')} aria-hidden={!on}>
      <div className="js-track" ref={track} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {MARKS.map((m) => <span key={m} className={'js-mark' + (m === juz ? ' cur' : '')} style={{ top: place(m) }}>{m}</span>)}
        <div className="js-thumb"><b>{juz}</b></div>
        <div className="js-bubble"><b>Джуз {juz}</b>{name && <span>{name}</span>}</div>
      </div>
    </div>,
    document.body,
  )
}
