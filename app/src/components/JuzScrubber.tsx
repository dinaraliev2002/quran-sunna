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

/** Размеры списка, замеренные один раз (замеры при каждом движении пальца заставляли браузер пересчитывать раскладку — шкала тормозила) */
interface Measure { tops: number[]; bottoms: number[]; trackTop: number; trackH: number; elTop: number }

export function JuzScrubber({ scroll, surahs, juzPages, enabled, onHold }: { scroll: RefObject<HTMLDivElement | null>; surahs: Surah[]; juzPages: number[]; enabled: boolean; /** бегунок зажали / отпустили — список в это время не должен показывать верхние кнопки */ onHold?: (on: boolean) => void }) {
  const [on, setOn] = useState(false) // шкала видна
  const [juz, setJuz] = useState(1) // джуз сура наверху списка (или выбранный бегунком)
  const [name, setName] = useState('')
  const [held, setHeld] = useState(false) // бегунок зажат — показываем подсказку с названием суры
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined)
  const frame = useRef(0)
  const last = useRef(0)
  const juzNow = useRef(1)
  const unflash = useRef<ReturnType<typeof setTimeout>>(undefined)
  const meas = useRef<Measure | null>(null) // замеры списка; сбрасываются при смене списка и размера окна
  const rows = useRef<HTMLElement[]>([])
  const flashed = useRef<HTMLElement | null>(null)
  const quietUntil = useRef(0) // после прыжка бегунком прокрутку не пересчитываем в джуз — иначе бегунок отскочит на джуз начала суры

  const keepVisible = useCallback((ms = 1100) => {
    setOn(true)
    clearTimeout(hide.current)
    if (!dragging.current) hide.current = setTimeout(() => setOn(false), ms)
  }, [])

  /** Один раз замеряем положение всех строк списка и шкалы (координаты внутри прокручиваемого содержимого) */
  const measure = useCallback((): Measure | null => {
    const el = scroll.current, tr = track.current
    if (!el || !tr) return null
    if (meas.current) return meas.current
    const er = el.getBoundingClientRect(), st = el.scrollTop
    rows.current = [...el.querySelectorAll<HTMLElement>('.srow')]
    const tops: number[] = [], bottoms: number[] = []
    for (const r of rows.current) { const b = r.getBoundingClientRect(); tops.push(b.top - er.top + st); bottoms.push(b.bottom - er.top + st) }
    const tb = tr.getBoundingClientRect()
    meas.current = { tops, bottoms, trackTop: tb.top - er.top, trackH: tb.height, elTop: er.top }
    return meas.current
  }, [scroll])
  useEffect(() => { meas.current = null }, [surahs, enabled])
  useEffect(() => {
    const reset = () => { meas.current = null }
    addEventListener('resize', reset)
    return () => removeEventListener('resize', reset)
  }, [])

  /** Положение бегунка и подсказки: одна CSS-переменная на корне, без пересчёта раскладки (двигаем через transform) */
  const setY = useCallback((f: number) => {
    const h = track.current?.clientHeight ?? 0
    root.current?.style.setProperty('--y', (PAD + (h - PAD * 2) * f).toFixed(1) + 'px')
  }, [])

  /** Первая сура, видимая под шапкой (по ней определяем джуз): двоичный поиск по замеренным строкам, без обращения к раскладке */
  const topSurahIdx = useCallback(() => {
    const el = scroll.current, m = measure()
    if (!el || !m) return -1
    const y = el.scrollTop + m.trackTop + 4
    let lo = 0, hi = m.bottoms.length - 1, ans = -1
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (m.bottoms[mid] > y) { ans = mid; hi = mid - 1 } else lo = mid + 1 }
    return ans
  }, [scroll, measure])

  useEffect(() => {
    const el = scroll.current
    if (!enabled || !el) return
    const onScroll = () => {
      if (dragging.current || performance.now() < quietUntil.current) return
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const s = surahs[topSurahIdx()]
        if (s) { setJuz(juzByPage(juzPages, s.pages[0])); setName(s.name) }
      })
      keepVisible()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame.current); clearTimeout(hide.current); clearTimeout(unflash.current) }
  }, [scroll, enabled, juzPages, surahs, topSurahIdx, keepVisible])

  useEffect(() => { if (!enabled) setOn(false) }, [enabled])

  // в покое бегунок стоит на своём джузе (плавно «доезжает» через transition)
  useLayoutEffect(() => { juzNow.current = juz; if (!dragging.current) setY((juz - 1) / 29) }, [juz, setY, on, enabled])

  /** Номер строки первой суры, которая захватывает начало джуза j */
  const rowOf = (j: number) => {
    const page = juzPages[j - 1]
    const i = surahs.findIndex((s) => s.pages[1] >= page)
    return i < 0 ? 0 : i
  }

  /** Прыгнуть к первой суре джуза j */
  const jumped = useRef(0)
  const jump = (j: number) => {
    const el = scroll.current, m = measure()
    if (!el || !m) return
    jumped.current = j
    const i = rowOf(j)
    const row = rows.current[i]
    if (!row) return
    // первая сура джуза подсвечивается, пока палец на шкале: старая плавно гаснет, новая плавно загорается (transition в CSS)
    clearTimeout(unflash.current)
    if (flashed.current && flashed.current !== row) flashed.current.classList.remove('juz-flash')
    row.classList.add('juz-flash'); flashed.current = row
    quietUntil.current = performance.now() + 300
    el.scrollTop = m.tops[i] - m.trackTop // позиции уже замерены — прокрутка без чтения раскладки
  }

  // Пока палец ведёт по шкале, список НЕ прыгает на каждый джуз: iPhone не успевает перерисовывать сотни строк,
  // и всё дёргается. Как в «Контактах» iPhone: бегунок и подсказка «Джуз · сура» меняются сразу (это ничего не стоит),
  // а список переезжает, только когда палец задержался на джузе (JUMP_MS) или его отпустили
  const JUMP_MS = 140
  const pending = useRef(0)
  const tick = useRef(0)
  const jumpT = useRef<ReturnType<typeof setTimeout>>(undefined)
  const flush = () => {
    tick.current = 0
    const j = pending.current
    if (!dragging.current || j === last.current) return
    last.current = j; juzNow.current = j
    setJuz(j); setName(surahs[rowOf(j)]?.name ?? ''); haptic.tick()
    clearTimeout(jumpT.current)
    jumpT.current = setTimeout(() => { if (dragging.current) jump(j) }, JUMP_MS)
  }
  const at = (e: React.PointerEvent) => {
    const m = measure()
    if (!m) return
    // положение пальца относительно шкалы (в экранных координатах; верх списка замерен заранее)
    const f = Math.min(1, Math.max(0, (e.clientY - m.elTop - m.trackTop - PAD) / (m.trackH - PAD * 2)))
    setY(f) // бегунок идёт прямо за пальцем
    pending.current = Math.round(f * 29) + 1
    if (!tick.current) tick.current = requestAnimationFrame(flush)
  }
  useEffect(() => () => { cancelAnimationFrame(tick.current); clearTimeout(jumpT.current) }, [])

  // Экран со списком уходит (переход на другой экран): шкала нарисована поверх всего, поэтому прячем её сразу,
  // иначе она на долю секунды видна над новым экраном
  useLayoutEffect(() => {
    if (root.current) root.current.style.visibility = scroll.current?.closest('.pt-out') ? 'hidden' : ''
  })
  const down = (e: React.PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); meas.current = null; jumped.current = 0; dragging.current = true; setHeld(true); onHold?.(true); keepVisible(); at(e) }
  const move = (e: React.PointerEvent<HTMLDivElement>) => { if (dragging.current) at(e) }
  const up = () => {
    if (!dragging.current) return
    // палец отпустили — список сразу переезжает к выбранному джузу (если ещё не там)
    cancelAnimationFrame(tick.current); tick.current = 0
    clearTimeout(jumpT.current)
    const target = pending.current || juzNow.current
    if (target !== last.current) { juzNow.current = target; setJuz(target); setName(surahs[rowOf(target)]?.name ?? '') }
    if (jumped.current !== target) jump(target)
    dragging.current = false; setHeld(false); onHold?.(false); last.current = 0; keepVisible(900)
    setY((juzNow.current - 1) / 29) // садимся на свой джуз
    // отпустили палец — подсветка ещё мгновение держится и плавно гаснет
    clearTimeout(unflash.current)
    unflash.current = setTimeout(() => { flashed.current?.classList.remove('juz-flash'); flashed.current = null }, 900)
  }

  if (!enabled) return null
  // выносим в <body>: контейнер экрана создаёт свой «слой», и шкала оказалась бы под боковой панелью
  return createPortal(
    <div ref={root} className={'js' + (on ? ' on' : '') + (held ? ' held' : '')} aria-hidden={!on}>
      <div className="js-track" ref={track} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {MARKS.map((m) => <span key={m} className={'js-mark' + (m === juz ? ' cur' : '')} style={{ top: place(m) }}>{m}</span>)}
        <div className="js-thumb"><b key={juz}>{juz}</b></div>
        <div className="js-bubble"><b>Джуз {juz}</b>{name && <span key={name}>{name}</span>}</div>
      </div>
    </div>,
    document.body,
  )
}
