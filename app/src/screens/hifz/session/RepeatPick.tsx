import { useState } from 'react'
import { haptic } from '../../../lib/telegram'

const PRESETS = [1, 3, 5]

/** Выбор числа повторов: 1×, 3×, 5× или своё число (кнопки − и +) */
export function RepeatPick({ value, onChange, max = 30 }: { value: number; onChange: (n: number) => void; max?: number }) {
  const [custom, setCustom] = useState(!PRESETS.includes(value))
  const pick = (n: number) => { haptic.tick(); onChange(Math.max(1, Math.min(max, n))) }
  return (
    <div className="qh-pick">
      <div className="qh-chips">
        {PRESETS.map((n) => <button key={n} className={!custom && value === n ? 'on' : ''} onClick={() => { setCustom(false); pick(n) }}>{n}×</button>)}
        <button className={custom ? 'on' : ''} onClick={() => { haptic.tick(); setCustom(true) }}>Своё</button>
      </div>
      {custom && (
        <div className="qh-step">
          <button onClick={() => pick(value - 1)} disabled={value <= 1} aria-label="Меньше">−</button>
          <b>{value}×</b>
          <button onClick={() => pick(value + 1)} disabled={value >= max} aria-label="Больше">+</button>
        </div>
      )}
    </div>
  )
}
