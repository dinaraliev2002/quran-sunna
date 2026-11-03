import { Icon } from '../../../components/Icon'
import { plural } from '../../../lib/plural'
import { type Surah } from '../../../types/quran'
import { dayNum } from '../../../lib/hifz'
import { haptic } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'
import { useTarget } from '../../../hooks/useQuranHifz'
import { amount } from './text'

/** Цель: выучить подборку или суру к дате → сколько аятов в день */
export function Goal({ surahs, onEdit }: { surahs: Surah[]; onEdit: () => void }) {
  const g = useStore((s) => s.qhGoal)
  const plan = useStore((s) => s.qhPerDay)
  const set = useStore((s) => s.set)
  const tg = useTarget(surahs)
  if (!g) return (
    <button className="qh-cur" style={{ marginTop: 8 }} onClick={onEdit}>
      <span className="si" style={{ background: '#3E7CB1', width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', color: '#fff' }}><Icon id="compass" /></span>
      <div className="t"><b>Поставить цель</b><span>Например, выучить «{tg.set.name}» к определённой дате</span></div>
      <Icon id="right" />
    </button>
  )
  const days = Math.max(1, g.by - dayNum())
  const left = tg.total - tg.done
  const need = Math.ceil(left / days)
  const rem = tg.rem
  return (
    <div className="qh-cur qh-goal" style={{ marginTop: 8, display: 'block' }} onClick={onEdit}>
      <b>Цель: {tg.set.name}</b>
      <div className="bar"><i style={{ width: `${tg.total ? (tg.done / tg.total) * 100 : 0}%` }} /></div>
      {left === 0 ? <p>Цель достигнута — машаАллах!</p> : !rem ? <p>Считаем…</p> : (
        <>
          <p>Осталось {amount(rem.words, rem.ayahs)}</p>
          <p>{g.by < dayNum() ? 'Срок прошёл' : `${days} ${plural(days, 'день', 'дня', 'дней')} · нужно ${amount(rem.words / days, need)} в день`}</p>
        </>
      )}
      {left > 0 && g.by >= dayNum() && need !== plan && (
        <button className="hz-again" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); haptic.tap(); set({ qhPerDay: Math.min(30, need) }) }}>Поставить {Math.min(30, need)} {plural(Math.min(30, need), 'аят', 'аята', 'аятов')} в день</button>
      )}
    </div>
  )
}
