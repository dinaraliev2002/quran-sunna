import { useState, type ReactNode } from 'react'
import { Icon } from '../../../components/Icon'
import { type QItem } from '../../../types/hifzQuran'
import { haptic } from '../../../lib/telegram'
import { usePlayer } from '../../../store/player'
import { useStore } from '../../../store/settings'
import { AyahWords } from '../../reader/views'
import { PlayDot } from './PlayDot'

/** По памяти: виден перевод, арабский размыт; нажатие на аят — открыть и послушать; «Проверить себя» — открыть всё */
export function Tell({ item, review, children }: { item: QItem; review?: boolean; children: ReactNode }) {
  const tajweed = useStore((s) => s.tajweed)
  const tr = useStore((s) => s.translation)
  const checkAudio = useStore((s) => s.qhCheckAudio)
  const current = usePlayer((s) => s.current)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const all = open.size === item.ayahs.length
  const reveal = (n: number) => {
    haptic.tick()
    setOpen((s) => new Set(s).add(n))
    usePlayer.getState().play([`${item.s}:${n}`], 0, null, { exact: true }) // проверка: только этот аят
  }
  /** «Проверить себя»: открыть все аяты и (если включено в настройках) сразу прослушать их по порядку */
  const checkAll = () => {
    haptic.tap()
    setOpen(new Set(item.ayahs.map((a) => a.n)))
    if (checkAudio) usePlayer.getState().play(item.ayahs.map((a) => `${item.s}:${a.n}`), 0, null, { exact: true })
  }
  return (
    <>
      <div className="hz-card">
        <p className="hz-tip" style={{ marginTop: 0 }}>Прочитайте отрывок по памяти{review ? '' : ' — вслух или про себя'}. Подсказка — перевод. Нажмите на аят, чтобы проверить себя и послушать.</p>
        {item.ayahs.map((a) => (
          <div key={a.n} className={'qh-ayah' + (current === `${item.s}:${a.n}` ? ' playing' : '')}>
            <div className="qh-tr"><b>{a.n}</b>{tr === 'aa' ? a.aa : a.ku}</div>
            {open.has(a.n)
              ? <AyahWords a={a} tajweed={tajweed} after={<PlayDot k={`${item.s}:${a.n}`} />} />
              : <div className="qh-hid" onClick={() => reveal(a.n)}><div className="qh-blur"><AyahWords a={a} tajweed={tajweed} /></div><span className="qh-reveal-l">Нажмите, чтобы открыть</span></div>}
          </div>
        ))}
      </div>
      {all ? children : (
        <div className="hz-act">
          <button className="bigbtn" onClick={checkAll}><Icon id="open" />Проверить себя</button>
        </div>
      )}
    </>
  )
}
