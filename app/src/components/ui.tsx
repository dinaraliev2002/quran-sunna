import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { loadMeta, loadSurahs, surahGlyph, type Surah } from '../lib/data'

export function TabBar() {
  const tabs = [
    { to: '/', icon: 'home', end: true },
    { to: '/quran', icon: 'book' },
    { to: '/azkar', icon: 'hands' },
    { to: '/hadith', icon: 'scroll' },
    { to: '/settings', icon: 'more' },
  ]
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'on' : '')}>
          <Icon id={t.icon} />
        </NavLink>
      ))}
    </nav>
  )
}

export function SurahRow({ s, sort, current, onClick }: { s: Surah; sort?: 'mushaf' | 'rev'; current?: boolean; onClick: () => void }) {
  return (
    <button className={'srow' + (current ? ' cur' : '')} onClick={onClick}>
      <div className="num-badge"><span>{s.id}</span></div>
      <div className="t">
        <b>{s.name}</b>
        <span>{sort === 'rev' ? `${s.rev}-я по ниспосланию` : s.meaning} · {s.ayahs} {plural(s.ayahs, 'аят', 'аята', 'аятов')}</span>
      </div>
      <div className="r">
        <span className="sname">{surahGlyph(s.id)}</span>
        <span className={'tag ' + (s.mk ? 'mk' : 'md')}>{s.mk ? 'Мекканская' : 'Мединская'}</span>
      </div>
    </button>
  )
}

/**
 * Всплывающее окно снизу. Закрывается: тапом по затемнению, крестиком или свайпом вниз —
 * за «ручку»/заголовок, а если содержимое прокручено до верха — и за само содержимое.
 */
export function Sheet({ onClose, children, tall }: { onClose: () => void; children: ReactNode; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
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
      scroller = (e.target as HTMLElement).closest<HTMLElement>('.body')
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
  }, [])

  return (
    <>
      <div className="dim" ref={dimRef} onClick={onClose} />
      <div className={'sheet' + (tall ? ' tall' : '')} ref={ref}>
        <div className="handle" />
        {children}
      </div>
    </>
  )
}

export function SheetHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="sh">
      <div><h3>{title}</h3>{sub && <span>{sub}</span>}</div>
      <button className="xbtn" onClick={onClose}><Icon id="close" /></button>
    </div>
  )
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** Список сур + таблица начала джузов (загружаются один раз) */
export function useQuranMeta() {
  const [data, setData] = useState<{ surahs: Surah[]; juzPages: number[] } | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadSurahs(), loadMeta()]).then(([surahs, meta]) => alive && setData({ surahs, juzPages: meta.juzPages }))
    return () => { alive = false }
  }, [])
  return data
}
