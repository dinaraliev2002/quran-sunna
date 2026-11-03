import { Icon } from '../../../components/Icon'
import { haptic } from '../../../lib/telegram'
import { usePlayer } from '../../../store/player'

/** Круглая кнопка у номера аята: слушать этот аят / пауза */
export function PlayDot({ k }: { k: string }) {
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const mine = current === k
  const on = mine && (status === 'playing' || status === 'loading')
  return (
    <button className={'qh-dot' + (on ? ' on' : '')} aria-label={on ? 'Пауза' : 'Слушать аят'}
      onClick={() => { haptic.tap(); const p = usePlayer.getState(); if (mine && p.status !== 'idle') p.toggle(); else p.play([k]) }}>
      <Icon id={on ? 'pause' : 'play'} />
    </button>
  )
}
