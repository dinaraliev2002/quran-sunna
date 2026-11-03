import { Sheet, SheetHead } from '../../../components/ui'
import { plural } from '../../../lib/plural'
import { type Surah } from '../../../types/quran'
import { dayNum } from '../../../lib/hifz'
import { haptic } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'
import { useTarget } from '../../../hooks/useQuranHifz'
import { amount } from './text'

export function GoalSheet({ surahs, onClose }: { surahs: Surah[]; onClose: () => void }) {
  const g = useStore((s) => s.qhGoal)
  const set = useStore((s) => s.set)
  const tg = useTarget(surahs)
  const left = tg.total - tg.done
  const rem = tg.rem
  const choose = (weeks: number) => { haptic.tick(); set({ qhGoal: { t: tg.t, by: dayNum() + weeks * 7 } }); onClose() }
  const label = (w: number) => (w < 4 ? `${w} ${plural(w, 'неделя', 'недели', 'недель')}` : w === 52 ? 'Год' : w === 26 ? 'Полгода' : `${w / 4} ${plural(w / 4, 'месяц', 'месяца', 'месяцев')}`)
  const opts = rem ? [1, 2, 4, 8, 12, 26, 52].map((w) => ({ w, text: amount(rem.words / (w * 7), Math.ceil(left / (w * 7))) })).filter((o, k, all) => !k || o.text !== all[k - 1].text) : []
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Цель" sub={rem ? `${tg.set.name} · осталось ${amount(rem.words, rem.ayahs)}` : tg.set.name} onClose={onClose} />
      <div className="hz-sheet-btns">
        <p className="hz-how" style={{ margin: 0 }}>За какой срок выучить? Приложение посчитает, сколько нужно в день (объём в страницах примерный). Цель — то, что сейчас выбрано в «Что учить».</p>
        {!rem && <div className="loading">Считаем…</div>}
        {opts.map((o) => <button key={o.w} className="hz-again" onClick={() => choose(o.w)}>{label(o.w)} · {o.text} в день</button>)}
        {g && <button className="hz-warn-go" onClick={() => { set({ qhGoal: null }); onClose() }}>Убрать цель</button>}
      </div>
    </Sheet>
  )
}
