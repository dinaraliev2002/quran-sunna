import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '../lib/telegram'
import { RECITERS, usePlayer } from '../store/player'
import { useStore } from '../store/settings'
import { Icon } from './Icon'
import { useQuranMeta } from './ui'

/** Мини-плеер: виден везде, пока идёт обычное прослушивание. Крестик — остановить и закрыть. */
export function MiniPlayer() {
  const p = usePlayer()
  const meta = useQuranMeta()
  const reciter = useStore((s) => s.reciter)
  const nav = useNavigate()
  const loc = useLocation()
  if (p.status === 'idle' || p.memo || !p.current) return null
  const [s, a] = p.current.split(':').map(Number)
  const name = meta?.surahs[s - 1]?.name ?? `Сура ${s}`
  const playing = p.status === 'playing' || p.status === 'loading'
  const inReader = loc.pathname.startsWith('/read/')
  return (
    <div className={'miniplayer glass' + (inReader ? ' in-reader' : '')}>
      <button className="mp-info" onClick={() => { haptic.tap(); nav(`/read/${s}?a=${a}`) }}>
        <b>{name}</b>
        <span>Аят {a} из {meta?.surahs[s - 1]?.ayahs ?? ''} · {(RECITERS[reciter] ?? RECITERS.alafasy).name}</span>
      </button>
      <button className="mp-btn" onClick={() => { haptic.tap(); p.toggle() }} aria-label={playing ? 'Пауза' : 'Слушать'}><Icon id={playing ? 'pause' : 'play'} /></button>
      <button className="mp-btn mp-x" onClick={() => { haptic.tap(); p.stop() }} aria-label="Закрыть плеер"><Icon id="close" /></button>
    </div>
  )
}
