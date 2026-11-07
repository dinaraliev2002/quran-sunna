import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { excludeRightEdge, haptic, isNative } from '../lib/telegram'
import { useStore } from '../store/settings'
import { WORD_PARSE } from '../store/wordSheet'
import { Icon } from './Icon'

// Боковая панель разделов: у правого края — тонкий язычок. Нажать или потянуть влево — выезжает панель с разделами.
// Шестерёнка в панели — выбор, какие пункты показывать. Новые разделы добавлять в ITEMS.

interface Item { to: string; icon: string; label: string; color: string; show?: boolean }

const ITEMS: Item[] = [
  { to: '/meaning', icon: 'book', label: 'Смысл Корана', color: '#C9A24B', show: WORD_PARSE },
  { to: '/words', icon: 'words', label: 'Слова Корана', color: '#2F7FD8', show: WORD_PARSE },
  { to: '/hifz', icon: 'brain', label: 'Заучивание', color: '#13704B' },
  { to: '/names', icon: 'star', label: 'Имена Аллаха', color: '#C9A24B' },
  { to: '/plan', icon: 'compass', label: 'Личный план', color: '#D9A441' },
  { to: '/profile', icon: 'users', label: 'Профиль', color: '#9B59D0' },
  { to: '/settings', icon: 'gear', label: 'Настройки', color: '#6B7280' },
]

/** Все остальные известные разделы (там язычка нет). Любой другой адрес роутер показывает как главную — значит, язычок нужен */
const INNER = /^\/(read|stories|glossary|sajda|settings|reminders|words|meaning|downloads|profile|plan|notifications|hifz|names\/|azkar\/|hadith\/)/

export function QuickMenu() {
  const loc = useLocation()
  const nav = useNavigate()
  const hidden = useStore((s) => s.quickHidden)
  const set = useStore((s) => s.set)
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(false)
  const sx = useRef<number | null>(null)
  const sy = useRef(0)
  const drag = useRef(false)
  const pid = useRef<number | null>(null)
  const p0 = useRef({ x: 0, y: 0 })
  const ly = useRef<number | null>(null) // положение язычка во время перетаскивания
  const tabY = useStore((s) => s.quickTabY)
  const [liveY, setLiveY] = useState<number | null>(null) // пока тянем
  useEffect(() => { setOpen(false); setEdit(false) }, [loc.pathname])
  // пока экран прокручивают — язычок прячется (не мешает шкале джузов и тексту), остановилась прокрутка — плавно возвращается.
  // scroll не всплывает, поэтому слушаем в фазе перехвата: ловим прокрутку любого контейнера на странице
  const [moving, setMoving] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const on = () => { setMoving(true); clearTimeout(t); t = setTimeout(() => setMoving(false), 1200) } // шкала джузов гаснет через 1,1 с после остановки — язычок возвращается чуть позже неё
    addEventListener('scroll', on, { capture: true, passive: true })
    return () => { removeEventListener('scroll', on, { capture: true }); clearTimeout(t) }
  }, [])
  // язычок виден (на экране без него — INNER — исключение снимаем) и панель закрыта: освобождаем полосу у края от системного жеста «назад»
  const shown = !INNER.test(loc.pathname)
  useEffect(() => {
    if (!shown) { excludeRightEdge(0, 0); return }
    const apply = () => excludeRightEdge(Math.max(0, innerHeight * ((liveY ?? tabY) / 100) - 90), 180)
    apply()
    addEventListener('resize', apply)
    return () => { removeEventListener('resize', apply); excludeRightEdge(0, 0) }
  }, [shown, tabY, liveY])

  // Telegram при запуске дописывает в адрес свои параметры (#tgWebAppData=…): роутер видит это как «неизвестный путь» и показывает главную, а язычок раньше пропадал
  if (INNER.test(loc.pathname)) return null
  const avail = ITEMS.filter((i) => i.show !== false)
  const items = avail.filter((i) => !hidden.includes(i.to) || i.to === '/settings')
  const close = () => { setOpen(false); setEdit(false) }
  const go = (to: string) => { haptic.tap(); close(); nav(to) }
  const toggle = (to: string) => set({ quickHidden: hidden.includes(to) ? hidden.filter((x) => x !== to) : [...hidden, to] })

  // жест: на язычке — потянуть влево открывает; на панели — вправо закрывает
  const down = (e: React.TouchEvent) => { sx.current = e.touches[0].clientX; sy.current = e.touches[0].clientY; drag.current = false }
  // язычок: палец или мышь. Тап/потянуть влево — открыть, потянуть вверх-вниз — передвинуть
  const pdown = (e: React.PointerEvent<HTMLButtonElement>) => { pid.current = e.pointerId; p0.current = { x: e.clientX, y: e.clientY }; drag.current = false; e.currentTarget.setPointerCapture(e.pointerId) }
  const pmove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pid.current !== e.pointerId) return
    const dy = e.clientY - p0.current.y, dx = e.clientX - p0.current.x
    if (!drag.current && Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) drag.current = true
    if (drag.current) { ly.current = Math.min(86, Math.max(10, (e.clientY / innerHeight) * 100)); setLiveY(ly.current) }
  }
  const pup = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pid.current !== e.pointerId) return
    pid.current = null
    if (drag.current) { drag.current = false; if (ly.current != null) set({ quickTabY: Math.round(ly.current) }); ly.current = null; setLiveY(null); return }
    haptic.tap(); setOpen(true)
  }
  const up = (e: React.TouchEvent, dir: 'open' | 'close') => {
    if (sx.current == null) return
    const dx = e.changedTouches[0].clientX - sx.current
    sx.current = null
    if (dir === 'open' && dx < -20) { haptic.tap(); setOpen(true) }
    if (dir === 'close' && dx > 50) close()
  }

  return (
    <>
      {!open && <button className={'qm-tab' + (isNative ? ' native' : '') + (moving ? ' away' : '')} style={{ top: `${liveY ?? tabY}%` }} onPointerDown={pdown} onPointerMove={pmove} onPointerUp={pup} onPointerCancel={() => { pid.current = null; setLiveY(null) }} onClick={(e) => { if (e.detail === 0) setOpen(true) }} aria-label="Меню разделов"><Icon id="back" /></button>}
      {open && <div className="qm-dim" onClick={close} />}
      <aside className={'qm-panel' + (open ? ' open' : '') + (edit ? ' edit' : '')} style={{ top: `${Math.min(70, Math.max(30, tabY))}%` }} onTouchStart={down} onTouchEnd={(e) => up(e, 'close')} aria-hidden={!open}>
        <div className="qm-head">
          {edit && <b>Что показывать</b>}
          <button onClick={() => { haptic.tap(); setEdit((v) => !v) }} aria-label="Настроить пункты"><Icon id={edit ? 'check' : 'gear'} /></button>
        </div>
        {edit ? avail.filter((i) => i.to !== '/settings').map((it) => (
          <button key={it.to} className="qm-row" onClick={() => toggle(it.to)}>
            <span className="qm-ic" style={{ background: it.color }}><Icon id={it.icon} /></span>
            <span className="qm-t">{it.label}</span>
            <span className={'switch' + (hidden.includes(it.to) ? '' : ' on')} />
          </button>
        )) : items.map((it) => (
          <button key={it.to} className="qm-row" onClick={() => go(it.to)} tabIndex={open ? 0 : -1}>
            <span className="qm-ic" style={{ background: it.color }}><Icon id={it.icon} /></span>
            <span className="qm-t">{it.label}</span>
          </button>
        ))}
      </aside>
    </>
  )
}
