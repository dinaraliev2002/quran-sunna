import { useMemo } from 'react'
import { WheelPick } from './WheelPick'

/** Выбор числа повторов: колесо 1…max */
export function RepeatPick({ value, onChange, max = 30 }: { value: number; onChange: (n: number) => void; max?: number }) {
  const items = useMemo(() => Array.from({ length: max }, (_, i) => ({ v: i + 1, l: String(i + 1) })), [max])
  return <WheelPick items={items} value={value} onChange={onChange} />
}
