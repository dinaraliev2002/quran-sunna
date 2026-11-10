import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { haptic } from '../lib/telegram'
import { juzByPage } from '../lib/data'
import type { Surah } from '../types/quran'
import { JuzGrid } from './JuzGrid'
import './JuzScrubber.css'

// Шкала джузов у правого края списка сур: появляется, пока листают, и показывает, в каком джузе сейчас список.
// Нажатие на шкалу открывает сетку 1–30 — выбрал джуз, список переехал к его первой суре.
// (Раньше бегунок тянули пальцем, но на iPhone список не успевал перерисовываться за пальцем и всё дёргалось.)
// Лежит выше боковой панели разделов (QuickMenu), поэтому во время прокрутки перекрывает её язычок.

const MARKS = [1, 5, 10, 15, 20, 25, 30]
const PAD = 22 // отступ от краёв шкалы, чтобы бегунок и цифры 1 и 30 не выходили за её рамки
/** положение джуза на шкале: от верхнего до нижнего отступа */
const place = (j: number) => `calc(${PAD}px + (100% - ${PAD * 2}px) * ${(j - 1) / 29})`

/** Положение строк списка, замеренное один раз (координаты внутри прокручиваемого содержимого) */
interface Measure { tops: number[]; bottoms: number[]; trackTop: number }

export function JuzScrubber({ scroll, surahs, juzPages, enabled, onHold }: { scroll: RefObject<HTMLDivElement | null>; surahs: Surah[]; juzPages: number[]; enabled: boolean; /** открыта сетка джузов — список в это время не должен показывать верхние кнопки */ onHold?: (on: boolean) => void }) {
  const [on, setOn] = useState(false) // шкала видна
  const [juz, setJuz] = useState(1) // джуз суры наверху списка
  const [grid, setGrid] = useState(false) // открыта сетка джузов
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLButtonElement>(null)
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined)
  const frame = useRef(0)
  const meas = useRef<Measure | null>(null) // сбрасывается при смене списка и размера окна
  const rows = useRef<HTMLElement[]>([])
  const flashed = useRef<HTMLElement | null>(null)
  const unflash = useRef<ReturnType<typeof setTimeout>>(undefined)
  // куда список переставили при выборе джуза: пока он там стоит, джуз по верхней суре не пересчитываем —
  // иначе бегунок отскочит на джуз, с которого началась сура (2-й джуз начинается внутри аль-Бакары, а она — в 1-м)
  const placedAt = useRef<number | null>(null)

  const keepVisible = useCallback((ms = 1100) => {
    setOn(true)
    clearTimeout(hide.current)
    hide.current = setTimeout(() => setOn(false), ms)
  }, [])

  const measure = useCallback((): Measure | null => {
    const el = scroll.current, tr = track.current
    if (!el || !tr) return null
    if (meas.current) return meas.current
    const er = el.getBoundingClientRect(), st = el.scrollTop
    rows.current = [...el.querySelectorAll<HTMLElement>('.srow')]
    const tops: number[] = [], bottoms: number[] = []
    for (const r of rows.current) { const b = r.getBoundingClientRect(); tops.push(b.top - er.top + st); bottoms.push(b.bottom - er.top + st) }
    meas.current = { tops, bottoms, trackTop: tr.getBoundingClientRect().top - er.top }
    return meas.current
  }, [scroll])
  useEffect(() => { meas.current = null }, [surahs, enabled])
  useEffect(() => {
    const reset = () => { meas.current = null }
    addEventListener('resize', reset)
    return () => removeEventListener('resize', reset)
  }, [])

  /** Первая сура, видимая под шапкой: двоичный поиск по замеренным строкам */
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
      keepVisible()
      if (placedAt.current !== null && Math.abs(el.scrollTop - placedAt.current) < 2) return
      placedAt.current = null // человек сам сдвинул список — дальше джуз снова считаем по верхней суре
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const s = surahs[topSurahIdx()]
        if (s) setJuz(juzByPage(juzPages, s.pages[0]))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame.current); clearTimeout(hide.current); clearTimeout(unflash.current) }
  }, [scroll, enabled, juzPages, surahs, topSurahIdx, keepVisible])

  useEffect(() => { if (!enabled) { setOn(false); setGrid(false) } }, [enabled])

  // бегунок показывает текущий джуз; двигаем через transform (без пересчёта раскладки)
  useLayoutEffect(() => {
    const h = track.current?.clientHeight ?? 0
    root.current?.style.setProperty('--y', (PAD + (h - PAD * 2) * ((juz - 1) / 29)).toFixed(1) + 'px')
  }, [juz, on, enabled])

  // Экран со списком уходит (переход на другой экран): шкала нарисована поверх всего, поэтому прячем её сразу
  useLayoutEffect(() => {
    if (root.current) root.current.style.visibility = scroll.current?.closest('.pt-out') ? 'hidden' : ''
  })

  /** Номер строки первой суры, которая захватывает начало джуза j */
  const rowOf = (j: number) => {
    const page = juzPages[j - 1]
    const i = surahs.findIndex((s) => s.pages[1] >= page)
    return i < 0 ? 0 : i
  }

  /** Перейти к первой суре джуза j: список переезжает, сура мягко подсвечивается */
  const go = (j: number) => {
    const el = scroll.current
    meas.current = null
    const m = measure()
    if (!el || !m) return
    const i = rowOf(j)
    const row = rows.current[i]
    if (!row) return
    setJuz(j)
    clearTimeout(unflash.current)
    flashed.current?.classList.remove('juz-flash')
    row.classList.add('juz-flash'); flashed.current = row
    unflash.current = setTimeout(() => { row.classList.remove('juz-flash'); flashed.current = null }, 1400)
    el.scrollTop = m.tops[i] - m.trackTop
    placedAt.current = el.scrollTop // браузер мог округлить — запоминаем фактическое положение
    keepVisible(1400)
  }

  const open = () => { haptic.tap(); setGrid(true); onHold?.(true) }
  const close = () => { setGrid(false); onHold?.(false) }
  const pick = (j: number) => { haptic.tick(); close(); setTimeout(() => go(j), 0) } // сначала закрываем окно, затем переставляем список

  if (!enabled) return null
  // выносим в <body>: контейнер экрана создаёт свой «слой», и шкала оказалась бы под боковой панелью
  return createPortal(
    <>
      <div ref={root} className={'js' + (on ? ' on' : '')} aria-hidden={!on}>
        <button className="js-track" ref={track} onClick={open} aria-label={`Джуз ${juz}. Выбрать джуз`}>
          {MARKS.map((m) => <span key={m} className={'js-mark' + (m === juz ? ' cur' : '')} style={{ top: place(m) }}>{m}</span>)}
          <div className="js-thumb"><b>{juz}</b></div>
        </button>
      </div>
      {grid && <JuzGrid current={juz} names={juzPages.map((_, k) => surahs[rowOf(k + 1)]?.name ?? '')} onPick={pick} onClose={close} />}
    </>,
    document.body,
  )
}
