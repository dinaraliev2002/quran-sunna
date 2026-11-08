import { useState } from 'react'
import { useStore } from '../store/settings'
import { Icon } from './Icon'
import { ReciterList } from './ReciterList'
import { RECITERS } from '../store/player'
import { Sheet, SheetHead } from './ui'

function Pills<T extends string | number>({ items, value, set }: { items: [T, string][]; value: T; set: (v: T) => void }) {
  return <div className="pills">{items.map(([v, l]) => <button key={l} className={v === value ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>
}

/** Настройки плеера: то, что действует на любое прослушивание (не заучивание с повторами) */
export function PlayerSettings({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const [rec, setRec] = useState(false)
  if (rec) {
    return (
      <Sheet onClose={() => setRec(false)} tall>
        <SheetHead title="Чтец и качество" sub="Следующее прослушивание — с выбранным чтецом" onClose={() => setRec(false)} />
        <div className="body"><ReciterList onDone={() => setRec(false)} /></div>
      </Sheet>
    )
  }
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Настройки плеера" sub="Для обычного прослушивания" onClose={onClose} />
      <div className="body">
        <button className="srow2" onClick={() => setRec(true)}><div>Чтец<span>{(RECITERS[st.reciter] ?? RECITERS.alafasy).name}</span></div><Icon id="right" className="icon" /></button>

        <div className="fld"><label>Когда сура закончилась</label>
          <Pills<'stop' | 'next' | 'repeat'> items={[['stop', 'Остановиться'], ['next', 'Следующая сура'], ['repeat', 'Повторить']]} value={st.plNext} set={(v) => st.set({ plNext: v })} />
        </div>

        <div className="fld"><label>Пауза между аятами</label>
          <Pills items={[[0, 'нет'], [1000, '1 с'], [2000, '2 с'], [3000, '3 с'], [-1, '= длине аята']]} value={st.plGap} set={(v) => st.set({ plGap: v })} />
          <small className="hint">«Нет» — аяты звучат подряд без щелей. Пауза нужна, чтобы повторять вслух за чтецом.</small>
        </div>

        <div className="fld"><label>Таймер сна: считать</label>
          <Pills<'time' | 'suras'> items={[['time', 'по времени'], ['suras', 'по сурам']]} value={st.plSleepMode} set={(v) => st.set({ plSleepMode: v })} />
          {st.plSleepMode === 'time'
            ? <Pills items={[[15, '15 мин'], [30, '30 мин'], [45, '45 мин'], [60, '60 мин'], [90, '90 мин']]} value={st.plSleepMin} set={(v) => st.set({ plSleepMin: v })} />
            : <Pills items={[[1, '1 сура'], [2, '2 суры'], [3, '3 суры'], [5, '5 сур']]} value={st.plSleepSuras} set={(v) => st.set({ plSleepSuras: v })} />}
          <small className="hint">Включается и выключается значком луны в самом плеере.</small>
        </div>

        <button className="srow2" onClick={() => st.set({ plFollow: !st.plFollow })}><div>Листать за звуком<span>В мусхафе и «Странице» экран сам переходит на страницу с играющим аятом</span></div><span className={'switch' + (st.plFollow ? ' on' : '')} /></button>
        <button className="srow2" onClick={() => st.set({ plResume: !st.plResume })}><div>Продолжать с места остановки<span>Суру, которую остановили посередине, в следующий раз начнёт с того же аята</span></div><span className={'switch' + (st.plResume ? ' on' : '')} /></button>
      </div>
    </Sheet>
  )
}
