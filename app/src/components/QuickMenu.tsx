import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '../lib/telegram'
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

/** Только на главных экранах: внутри чтения и занятий язычок мешал бы */
const SHOW_ON = ['/', '/quran', '/azkar', '/hadith', '/names']

export function QuickMenu() {
  const loc = useLocation()
  const nav = useNavigate()
  const hidden = useStore((s) => s.quickHidden)
  const set = useStore((s) => s.set)
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(false)
  const sx = useRef<number | null>(null)
  useEffect(() => { setOpen(false); setEdit(false) }, [loc.pathname])

  if (!SHOW_ON.includes(loc.pathname)) return null
  const avail = ITEMS.filter((i) => i.show !== false)
  const items = avail.filter((i) => !hidden.includes(i.to) || i.to === '/settings')
  const close = () => { setOpen(false); setEdit(false) }
  const go = (to: string) => { haptic.tap(); close(); nav(to) }
  const toggle = (to: string) => set({ quickHidden: hidden.includes(to) ? hidden.filter((x) => x !== to) : [...hidden, to] })

  // жест: на язычке — потянуть влево открывает; на панели — вправо закрывает
  const down = (e: React.TouchEvent) => { sx.current = e.touches[0].clientX }
  const up = (e: React.TouchEvent, dir: 'open' | 'close') => {
    if (sx.current == null) return
    const dx = e.changedTouches[0].clientX - sx.current
    sx.current = null
    if (dir === 'open' && dx < -20) { haptic.tap(); setOpen(true) }
    if (dir === 'close' && dx > 50) close()
  }

  return (
    <>
      {!open && <button className="qm-tab" onClick={() => { haptic.tap(); setOpen(true) }} onTouchStart={down} onTouchEnd={(e) => up(e, 'open')} aria-label="Меню разделов"><Icon id="back" /></button>}
      {open && <div className="qm-dim" onClick={close} />}
      <aside className={'qm-panel' + (open ? ' open' : '')} onTouchStart={down} onTouchEnd={(e) => up(e, 'close')} aria-hidden={!open}>
        <div className="qm-head">
          <b>{edit ? 'Что показывать' : 'Разделы'}</b>
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
            <Icon id="right" className="icon chev" />
          </button>
        ))}
      </aside>
    </>
  )
}
