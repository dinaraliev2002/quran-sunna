import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '../lib/telegram'
import { usePlayer } from '../store/player'
import { WORD_PARSE } from '../store/wordSheet'
import { Icon } from './Icon'

// Круглая кнопка внизу справа: по нажатию из неё веером вылетают кнопки разделов.
// Настройки — самая нижняя. Новые разделы добавлять в ITEMS (порядок: от верхней к нижней).

interface Item { to: string; icon: string; label: string; color: string; show?: boolean }

const ITEMS: Item[] = [
  { to: '/meaning', icon: 'book', label: 'Смысл Корана', color: '#C9A24B', show: WORD_PARSE },
  { to: '/words', icon: 'words', label: 'Слова Корана', color: '#2F7FD8', show: WORD_PARSE },
  { to: '/settings', icon: 'gear', label: 'Настройки', color: '#6B7280' },
]

/** Только на главных экранах: внутри чтения, занятий и т.п. кнопка мешала бы */
const SHOW_ON = ['/', '/quran', '/azkar', '/hadith', '/names']

export function QuickMenu() {
  const loc = useLocation()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const playing = usePlayer((s) => !!s.current)
  useEffect(() => setOpen(false), [loc.pathname])

  if (!SHOW_ON.includes(loc.pathname)) return null
  const items = ITEMS.filter((i) => i.show !== false)
  const R = items.length > 4 ? 185 : items.length > 2 ? 130 : 100
  // веер: от «влево» (самая нижняя, настройки) до «вверх» (самая верхняя)
  const pos = (i: number) => {
    const a = Math.PI - (Math.PI / 2) * ((items.length - 1 - i) / (items.length - 1)) // i=последний → 180°
    return { x: Math.cos(a) * R, y: -Math.sin(a) * R, ux: Math.cos(a), uy: Math.sin(a) }
  }
  const go = (to: string) => { haptic.tap(); setOpen(false); nav(to) }

  return (
    <>
      {open && <div className="qm-dim" onClick={() => setOpen(false)} />}
      <div className={'qm' + (open ? ' open' : '') + (loc.pathname === '/' ? ' home' : playing ? ' up' : '')}>
        {items.map((it, i) => {
          const p = pos(i)
          return (
            <button
              key={it.to}
              className="qm-item"
              style={{ ['--x' as string]: `${p.x}px`, ['--ux' as string]: p.ux.toFixed(3), ['--uy' as string]: p.uy.toFixed(3), ['--y' as string]: `${p.y}px`, ['--d' as string]: `${(items.length - 1 - i) * 30}ms`, background: it.color }}
              onClick={() => go(it.to)}
              aria-label={it.label}
              tabIndex={open ? 0 : -1}
            >
              <Icon id={it.icon} />
              <span className="qm-lbl">{it.label}</span>
            </button>
          )
        })}
        <button className="qm-main" onClick={() => { haptic.tap(); setOpen((v) => !v) }} aria-label={open ? 'Закрыть меню' : 'Меню разделов'} aria-expanded={open}>
          <Icon id={open ? 'close' : 'grid'} />
        </button>
      </div>
    </>
  )
}
