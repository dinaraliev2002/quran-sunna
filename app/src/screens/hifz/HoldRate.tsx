import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../../lib/telegram'
import { tickSound } from '../../lib/tickSound'
import { rateL, RATES } from './session/steps'

const H = 40 // высота одной цифры в колонке, px
const ITEMS = [...RATES].reverse() // сверху — быстрее, снизу — медленнее

interface Dial { left: number; top: number; w: number; sel: number; start: number }

/**
 * Кнопка скорости озвучки: коротко нажать — следующая скорость; зажать и повести вверх-вниз —
 * из-под кнопки выезжает колонка цифр (выше — быстрее), палец выбирает, отпустил — выбрано.
 */
export function HoldRate({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  const [dial, setDial] = useState<Dial | null>(null)
  const g = useRef({ y0: 0, start: 0, opened: false, timer: 0 as unknown as ReturnType<typeof setTimeout> })

  const open = () => {
    const el = btn.current
    if (!el || g.current.opened) return
    const r = el.getBoundingClientRect()
    const start = Math.max(0, ITEMS.indexOf(value))
    // колонка так, чтобы текущая цифра встала на кнопку; у края экрана — сдвигаем внутрь
    let top = r.top + r.height / 2 - H / 2 - start * H
    top = Math.max(8, Math.min(window.innerHeight - 8 - ITEMS.length * H, top))
    g.current.opened = true
    g.current.start = start
    haptic.tick()
    setDial({ left: r.left, top, w: r.width, sel: start, start })
  }

  const down = (e: React.PointerEvent) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* без захвата тоже работает */ }
    g.current.y0 = e.clientY
    g.current.opened = false
    clearTimeout(g.current.timer)
    g.current.timer = setTimeout(open, 220)
  }
  const move = (e: React.PointerEvent) => {
    const dy = e.clientY - g.current.y0
    if (!g.current.opened) { if (Math.abs(dy) > 8) { clearTimeout(g.current.timer); open() } return }
    const sel = Math.max(0, Math.min(ITEMS.length - 1, g.current.start + Math.round(dy / H)))
    setDial((d) => {
      if (!d || d.sel === sel) return d
      haptic.tick(); tickSound(); onChange(ITEMS[sel])
      return { ...d, sel }
    })
  }
  const up = () => {
    clearTimeout(g.current.timer)
    if (!g.current.opened) { haptic.tick(); onChange(RATES[(RATES.indexOf(value) + 1) % RATES.length] ?? 1) } // короткое нажатие
    g.current.opened = false
    setDial(null)
  }

  return (
    <>
      <button ref={btn} className="hz-rate" aria-label="Скорость озвучки: нажмите, чтобы сменить, или зажмите и ведите вверх-вниз"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { clearTimeout(g.current.timer); g.current.opened = false; setDial(null) }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(RATES[(RATES.indexOf(value) + 1) % RATES.length] ?? 1) } }}>
        {rateL(value)}
      </button>
      {dial && createPortal(
        <div className="hz-hold" style={{ left: dial.left, top: dial.top, width: dial.w, height: ITEMS.length * H, transformOrigin: `50% ${dial.start * H + H / 2}px` }}>
          {ITEMS.map((r, i) => <span key={r} className={i === dial.sel ? 'on' : ''} style={{ height: H }}>{rateL(r)}</span>)}
        </div>, document.body)}
    </>
  )
}
