import { useState } from 'react'
import { type QItem } from '../../../types/hifzQuran'
import { haptic } from '../../../lib/telegram'
import { usePlayer } from '../../../store/player'
import { useStore } from '../../../store/settings'
import { AyahWords } from '../../reader/views'
import { useWbw } from '../../../hooks/useWbw'

/** Аяты отрывка с переводом (по настройке — и пословным); hide — какие слова скрыты (нажатие — подсмотреть) */
export function Ayahs({ item, hide }: { item: QItem; hide?: (a: QItem['ayahs'][number], i: number) => boolean }) {
  const tajweed = useStore((s) => s.tajweed)
  const tr = useStore((s) => s.translation)
  const wbw = useStore((s) => s.qhWbw)
  const words = useWbw(item.s)
  const current = usePlayer((s) => s.current)
  const [shown, setShown] = useState<Set<string>>(new Set())
  // подсмотренное слово видно 3 секунды, потом снова закрывается
  const peek = (id: string) => {
    haptic.tick()
    setShown((s) => new Set(s).add(id))
    setTimeout(() => setShown((s) => { const n = new Set(s); n.delete(id); return n }), 3000)
  }
  return (
    <>
      {item.ayahs.map((a) => (
        <div key={a.n} className={'qh-ayah' + (current === `${item.s}:${a.n}` ? ' playing' : '')}>
          <AyahWords a={a} tajweed={tajweed} tr={wbw ? words?.[a.n - 1] ?? null : undefined}
            hide={hide ? (i) => hide(a, i) && !shown.has(`${a.n}.${i}`) : undefined} onPeek={(i) => peek(`${a.n}.${i}`)} />
          <div className="qh-tr"><b>{a.n}</b>{tr === 'aa' ? a.aa : a.ku}</div>
        </div>
      ))}
    </>
  )
}
