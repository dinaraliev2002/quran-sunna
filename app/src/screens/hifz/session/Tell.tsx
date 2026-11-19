import { useMemo, useState, type ReactNode } from 'react'
import { Icon } from '../../../components/Icon'
import { type QItem } from '../../../types/hifzQuran'
import { haptic } from '../../../lib/telegram'
import type { VerifyItem } from '../../../lib/voiceApi'
import { usePlayer } from '../../../store/player'
import { useStore } from '../../../store/settings'
import { AyahWords } from '../../reader/views'
import { PlayDot } from './PlayDot'
import { useVoiceCheck, VoiceCheck, VoiceErrors, VoiceScore } from '../VoiceCheck'
import { quranMarks, quranRef } from './quranVoice'

/** По памяти: виден перевод, арабский размыт; нажатие на аят — открыть и послушать; «Проверить себя» — открыть всё */
export function Tell({ item, review, children }: { item: QItem; review?: boolean; children: ReactNode }) {
  const tajweed = useStore((s) => s.tajweed)
  const tr = useStore((s) => s.translation)
  const checkAudio = useStore((s) => s.qhCheckAudio)
  const current = usePlayer((s) => s.current)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [spoken, setSpoken] = useState('') // что сказали вслух (проверка голосом)
  const [verify, setVerify] = useState<VerifyItem[] | null>(null) // замечания Gemini по гласным и буквам (если пришли)
  const ref = useMemo(() => quranRef(item).text, [item])
  const { r: res, checking } = useVoiceCheck(ref, 'ar', spoken, verify, `Коран ${item.s}:${item.ayahs[0]?.n}–${item.ayahs[item.ayahs.length - 1]?.n}`)
  const mark = useMemo(() => quranMarks(item, res?.relevant ? res.words : undefined), [item, res])
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
        {item.ayahs.map((a, ai) => (
          <div key={a.n} className={'qh-ayah' + (current === `${item.s}:${a.n}` ? ' playing' : '')}>
            <div className="qh-tr"><b>{a.n}</b>{tr === 'aa' ? a.aa : a.ku}</div>
            {open.has(a.n)
              ? <AyahWords a={a} tajweed={tajweed} after={<PlayDot k={`${item.s}:${a.n}`} />} mark={mark ? (i) => mark(ai, i) : undefined} />
              : <div className="qh-hid" onClick={() => reveal(a.n)}><div className="qh-blur"><AyahWords a={a} tajweed={tajweed} /></div><span className="qh-reveal-l">Нажмите, чтобы открыть</span></div>}
          </div>
        ))}
      </div>
      <VoiceCheck quran onText={(t, v) => { setSpoken(t); setVerify(v ?? null) }} hidden={all} />
      {all && res && (
        <div className="hz-card">
          <VoiceScore r={res} checking={checking} />
          <VoiceErrors r={res} spoken={spoken} />
        </div>
      )}
      {all ? children : (
        <div className="hz-act">
          <button className="bigbtn" onClick={checkAll}><Icon id="open" />Проверить себя</button>
        </div>
      )}
    </>
  )
}
