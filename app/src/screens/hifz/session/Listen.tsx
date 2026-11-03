import { Icon } from '../../../components/Icon'
import { type QItem } from '../../../types/hifzQuran'
import { haptic } from '../../../lib/telegram'
import { usePlayer } from '../../../store/player'
import { useStore } from '../../../store/settings'
import { RATES } from './steps'

/** Прослушивание отрывка: чтец повторяет каждый аят N раз */
export function Listen({ item }: { item: QItem }) {
  const rep = useStore((s) => s.qhRepeat)
  const chain = useStore((s) => s.qhChain)
  const rate = useStore((s) => s.qhRate)
  const set = useStore((s) => s.set)
  const status = usePlayer((s) => s.status)
  const playing = status === 'playing' || status === 'loading'
  const error = usePlayer((s) => s.error)
  const play = () => {
    haptic.tap()
    const p = usePlayer.getState()
    if (playing) return p.stop()
    const keys = item.ayahs.map((a) => `${item.s}:${a.n}`)
    // цепочкой: 1 → 1–2 → 1–3 …; каждый аят — сколько раз выбрано
    const queue = chain ? keys.flatMap((_, k) => keys.slice(0, k + 1)) : keys
    p.play(queue, 0, { repeatEach: rep, repeatRange: 1, pause: 0, hideText: false })
  }
  return (
    <div className="hz-card">
      <button className="bigbtn" onClick={play}><Icon id={playing ? 'pause' : 'play'} />{playing ? 'Остановить' : 'Слушать отрывок'}</button>
      <div className="qh-rep">
        <span>Каждый аят</span>
        {[1, 3, 5].map((n) => <button key={n} className={rep === n ? 'on' : ''} onClick={() => { haptic.tick(); set({ qhRepeat: n }) }}>{n}×</button>)}
      </div>
      <div className="qh-rep">
        <span>Скорость</span>
        {RATES.map((r) => <button key={r} className={rate === r ? 'on' : ''} onClick={() => { haptic.tick(); set({ qhRate: r }) }}>{String(r).replace('.', ',')}</button>)}
      </div>
      {error && <p className="hz-tip">{error}</p>}
    </div>
  )
}
