import { Icon } from '../../../components/Icon'
import { type QItem } from '../../../types/hifzQuran'
import { type Ayah } from '../../../types/quran'
import { haptic } from '../../../lib/telegram'
import { usePlayer } from '../../../store/player'
import { useStore } from '../../../store/settings'
import { RATES } from './steps'
import { RepeatPick } from './RepeatPick'

/** Прослушивание отрывка: каждый аят — N раз, весь отрывок — M кругов; цепочкой — с аята-связкой из прошлого отрывка */
export function Listen({ item, lead }: { item: QItem; lead: Ayah | null }) {
  const rep = useStore((s) => s.qhRepeat)
  const all = useStore((s) => s.qhRepeatAll)
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
    // цепочкой: перед новым отрывком звучит последний аят прошлого — он связывает выученное с новым
    const link = chain && lead ? [`${item.s}:${lead.n}`] : []
    p.play([...link, ...keys], 0, { repeatEach: rep, repeatRange: all, pause: 0, hideText: false, lead: link.length })
  }
  return (
    <div className="hz-card">
      <button className="bigbtn" onClick={play}><Icon id={playing ? 'pause' : 'play'} />{playing ? 'Остановить' : 'Слушать отрывок'}</button>
      <div className="qh-rep qh-rep-col">
        <span>Каждый аят</span>
        <RepeatPick value={rep} onChange={(n) => set({ qhRepeat: n })} />
      </div>
      <div className="qh-rep qh-rep-col">
        <span>Весь отрывок{item.a !== item.b ? ` (${item.b - item.a + 1} ${item.b - item.a + 1 < 5 ? 'аята' : 'аятов'})` : ''}</span>
        <RepeatPick value={all} onChange={(n) => set({ qhRepeatAll: n })} />
      </div>
      <div className="qh-rep">
        <span>Скорость</span>
        {RATES.map((r) => <button key={r} className={rate === r ? 'on' : ''} onClick={() => { haptic.tick(); set({ qhRate: r }) }}>{String(r).replace('.', ',')}</button>)}
      </div>
      {chain && (
        <p className="hz-tip">{lead ? `Цепочка: перед отрывком звучит аят ${lead.n} из прошлого — он связывает выученное с новым.` : 'Цепочка: это начало — прошлого отрывка перед ним нет, связка не нужна.'}</p>
      )}
      {error && <p className="hz-tip">{error}</p>}
    </div>
  )
}
