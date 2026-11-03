import { Icon } from '../../components/Icon'
import { usePlayer } from '../../store/player'

/** Полоска заучивания над панелью чтения: отрывок, повтор, круг; нажатие — настройки заучивания */
export function MemoBar({ onOpen }: { onOpen: () => void }) {
  const player = usePlayer()
  const memo = player.memo
  if (!memo) return null
  const playing = player.status === 'playing' || player.status === 'loading'
  return (
    <div className="memobar glass">
      <div className="ic"><Icon id="repeat" /></div>
      <div className="t" role="button" onClick={onOpen}>
        <b>Заучивание · {player.queue[0]}–{player.queue[player.queue.length - 1]?.split(':')[1]}</b>
        <span>Аят {player.current?.split(':')[1]} · повтор {memo.each} из {memo.repeatEach} · круг {memo.round}{memo.repeatRange ? ` из ${memo.repeatRange}` : ''}</span>
        <div className="bar"><i style={{ width: `${((player.index + 1) / player.queue.length) * 100}%` }} /></div>
      </div>
      <button onClick={player.toggle} aria-label="Пауза"><Icon id={playing ? 'pause' : 'play'} /></button>
      <button onClick={player.stop} aria-label="Стоп"><Icon id="close" /></button>
    </div>
  )
}
