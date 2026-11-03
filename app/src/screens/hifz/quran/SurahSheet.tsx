import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import { type Surah } from '../../../types/quran'
import { surahProgress } from '../../../lib/hifzQuran'
import { useStore } from '../../../store/settings'
import { rowText } from './text'

/** Сура из списка: прогресс и действия */
export function SurahSheet({ sr, onClose }: { sr: Surah; onClose: () => void }) {
  const nav = useNavigate()
  const cards = useStore((s) => s.qhifz)
  const set = useStore((s) => s.set)
  const reset = useStore((s) => s.qhReset)
  const pr = surahProgress(cards, sr.id)
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={`Сура ${sr.name}`} sub={rowText(pr, sr.ayahs)} onClose={onClose} />
      <div className="hz-sheet-btns">
        {pr.started < sr.ayahs && <button className="bigbtn" onClick={() => { set({ qhPos: { s: sr.id, a: 1 } }); nav('/hifz/quran/learn') }}><Icon id="plus" />{pr.started ? 'Учить дальше' : 'Учить эту суру'}</button>}
        {pr.started > 0 && <button className={pr.started < sr.ayahs ? 'hz-again' : 'bigbtn'} onClick={() => nav(`/hifz/quran/review?s=${sr.id}`)}><Icon id="repeat" />Повторить сейчас</button>}
        <button className="hz-again" onClick={() => nav(`/read/${sr.id}`)}><Icon id="book" />Открыть в читалке</button>
        {pr.started > 0 && (confirm
          ? <button className="hz-warn-go danger" onClick={() => { reset(sr.id); setConfirm(false) }}>Точно? Прогресс по суре удалится</button>
          : <button className="hz-warn-go" onClick={() => setConfirm(true)}>Начать заново</button>)}
      </div>
    </Sheet>
  )
}
