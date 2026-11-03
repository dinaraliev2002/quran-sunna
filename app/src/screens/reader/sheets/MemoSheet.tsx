import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import type { Surah } from '../../../types/quran'
import type { MemoOptions, PauseMode } from '../../../types/player'

export function MemoSheet({ surah, startAyah, reciterName, onClose, onStart, initial }: {
  surah: Surah; startAyah: number; reciterName: string; onClose: () => void
  onStart: (from: number, to: number, opts: MemoOptions) => void
  /** окно открыто с плеера: показать текущие настройки */
  initial?: { from: number; to: number; opts: MemoOptions }
}) {
  const [from, setFrom] = useState(initial?.from ?? startAyah)
  const [to, setTo] = useState(initial?.to ?? Math.min(surah.ayahs, startAyah + 4))
  const [each, setEach] = useState(initial?.opts.repeatEach ?? 3)
  const [range, setRange] = useState(initial?.opts.repeatRange ?? 2)
  const [pause, setPause] = useState<PauseMode>(initial?.opts.pause ?? 0)
  const [hide, setHide] = useState(initial?.opts.hideText ?? false)
  const clamp = (v: number) => Math.max(1, Math.min(surah.ayahs, v))

  const Pills = <T,>({ items, value, set }: { items: [T, string][]; value: T; set: (v: T) => void }) => (
    <div className="pills">{items.map(([v, l]) => <button key={l} className={v === value ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>
  )

  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Заучивание" sub={`${surah.name} · ${reciterName}`} onClose={onClose} />
      <div className="body">
        <div className="fld"><label>Отрывок</label>
          <div className="range">
            <div className="stepper"><small>с аята</small><button onClick={() => { const v = clamp(from - 1); setFrom(v) }}>−</button><b>{from}</b><button onClick={() => { const v = clamp(from + 1); setFrom(v); if (v > to) setTo(v) }}>+</button></div>
            <div className="stepper"><small>по аят</small><button onClick={() => { const v = clamp(to - 1); setTo(v); if (v < from) setFrom(v) }}>−</button><b>{to}</b><button onClick={() => setTo(clamp(to + 1))}>+</button></div>
          </div>
        </div>
        <div className="fld"><label>Повтор каждого аята</label><Pills items={[[1, '1×'], [3, '3×'], [5, '5×'], [7, '7×'], [10, '10×']]} value={each} set={setEach} /></div>
        <div className="fld"><label>Повтор всего отрывка</label><Pills items={[[1, '1×'], [2, '2×'], [3, '3×'], [0, '∞']]} value={range} set={setRange} /></div>
        <div className="fld"><label>Пауза между повторами</label><Pills<PauseMode> items={[[0, 'нет'], [2000, '2 с'], [5000, '5 с'], ['len', '= длине аята']]} value={pause} set={setPause} /></div>
        <button className="srow2" onClick={() => setHide(!hide)}><div>Скрывать текст аята<span>Аят пропадает с экрана, пока звучит: повторяйте по памяти и проверяйте себя на слух</span></div><span className={'switch' + (hide ? ' on' : '')} /></button>
        <button className="bigbtn" onClick={() => onStart(from, to, { repeatEach: each, repeatRange: range, pause, hideText: hide })}><Icon id="play" />{initial ? 'Применить и продолжить' : 'Начать заучивание'}</button>
      </div>
    </Sheet>
  )
}
