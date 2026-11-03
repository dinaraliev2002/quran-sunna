import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import { plural } from '../../../lib/plural'
import { orderedSets } from '../../../lib/hifzQuran'
import { haptic } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'

/** Настроить наборы: убрать ненужные подборки из ряда, вернуть, поменять порядок */
export function TuneSets({ onClose, onMy }: { onClose: () => void; onMy: () => void }) {
  const st = useStore()
  const all = orderedSets(st.qhOrder, st.qhHide, true)
  const toggle = (id: string) => {
    haptic.tick()
    const hidden = st.qhHide.includes(id)
    const hide = hidden ? st.qhHide.filter((x) => x !== id) : [...st.qhHide, id]
    // убрали ту, что сейчас выбрана, — переключаемся на первую оставшуюся
    const next = !hidden && st.qhSet === id ? orderedSets(st.qhOrder, hide)[0]?.id ?? 'my' : st.qhSet
    st.set({ qhHide: hide, qhSet: next, ...(next !== st.qhSet ? { qhPos: null } : {}) })
  }
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= all.length) return
    haptic.tick()
    const ids = all.map((q) => q.id);
    [ids[i], ids[j]] = [ids[j], ids[i]]
    st.set({ qhOrder: ids })
  }
  const changed = st.qhHide.length > 0 || st.qhOrder.length > 0
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Наборы" sub="Что показывать в «Что учить»" onClose={onClose} />
      <div className="body">
        <button className="qh-my" style={{ width: '100%', textAlign: 'left' }} onClick={onMy}>
          <div className="t"><b>Мой набор</b><span>{st.qhMy.length ? `${st.qhMy.length} ${plural(st.qhMy.length, 'запись', 'записи', 'записей')} · открыть и изменить` : 'Пока пусто · собрать свой набор'}</span></div>
          <Icon id="right" />
        </button>
        {all.map((q, i) => {
          const off = st.qhHide.includes(q.id)
          return (
            <div key={q.id} className="qh-my" style={off ? { opacity: .55 } : undefined}>
              <div className="t"><b>{q.name}</b><span>{q.sub}</span></div>
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Выше"><Icon id="up" /></button>
              <button onClick={() => move(i, 1)} disabled={i === all.length - 1} aria-label="Ниже"><Icon id="up" className="icon flip" /></button>
              <button className="qh-tg" onClick={() => toggle(q.id)} aria-label={off ? 'Показать' : 'Убрать'}><span className={'switch' + (off ? '' : ' on')} /></button>
            </div>
          )
        })}
        {changed && <div className="hz-sheet-btns"><button className="hz-again" onClick={() => { haptic.tick(); st.set({ qhHide: [], qhOrder: [] }) }}>Вернуть как было</button></div>}
      </div>
    </Sheet>
  )
}
