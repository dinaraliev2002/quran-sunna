import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import { haptic } from '../../../lib/telegram'
import { myEntry } from '../../../lib/hifzQuran'
import { useStore } from '../../../store/settings'
import type { Surah } from '../../../types/quran'

/** Долгое нажатие «Учить»: учить сейчас или добавить в «Мой набор» */
export function LearnMenu({ surah, ayah, onClose }: { surah: Surah; ayah: number; onClose: () => void }) {
  const nav = useNavigate()
  const my = useStore((s) => s.qhMy)
  const set = useStore((s) => s.set)
  const [done, setDone] = useState('')
  const add = (e: string, text: string) => {
    haptic.success()
    if (!my.includes(e)) set({ qhMy: [...my, e] })
    setDone(text)
  }
  const opt = (icon: string, t: string, sub: string, on: () => void) => (
    <button className="list-item" onClick={on}>
      <div className="ib"><Icon id={icon} /></div>
      <div className="t"><b>{t}</b><span>{sub}</span></div>
    </button>
  )
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={`${surah.name}, аят ${ayah}`} sub="Заучивание Корана" onClose={onClose} />
      {done ? (
        <div className="hz-sheet-btns">
          <p className="hz-how" style={{ margin: 0 }}>{done}</p>
          <button className="bigbtn" onClick={() => { set({ qhSet: 'my', qhPos: null }); nav('/hifz/quran') }}><Icon id="brain" />Открыть заучивание</button>
          <button className="hz-again" onClick={onClose}>Готово</button>
        </div>
      ) : (
        <div className="body">
          {opt('brain', 'Учить сейчас', 'С этого аята, по плану на день', () => { onClose(); nav(`/hifz/quran/learn?s=${surah.id}&a=${ayah}`) })}
          {opt('plus', 'Добавить аят в «Мой набор»', `${surah.name}, аят ${ayah}`, () => add(myEntry(surah.id, ayah), 'Аят добавлен в «Мой набор».'))}
          {ayah < surah.ayahs && opt('plus', 'С этого аята до конца суры', `${surah.name}, ${ayah}–${surah.ayahs}`, () => add(myEntry(surah.id, ayah, surah.ayahs), 'Аяты добавлены в «Мой набор».'))}
          {opt('plus', 'Всю суру в «Мой набор»', `${surah.name} · ${surah.ayahs} аятов`, () => add(myEntry(surah.id), 'Сура добавлена в «Мой набор».'))}
        </div>
      )}
    </Sheet>
  )
}
