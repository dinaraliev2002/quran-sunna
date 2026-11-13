import { useMemo } from 'react'
import { RATES, rateL } from './steps'
import { WheelPick } from './WheelPick'

/** Выбор скорости чтеца: колесо 0,5× … 1,5× */
export function RatePick({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  const items = useMemo(() => RATES.map((r) => ({ v: r, l: rateL(r) })), [])
  return <WheelPick items={items} value={value} onChange={onChange} w={58} />
}
