import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import { plural } from '../../../lib/plural'
import { type Surah } from '../../../types/quran'
import { parseMyEntry } from '../../../lib/hifzQuran'
import { haptic } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'

/** «Мой набор»: список сур и аятов — порядок, удаление, добавление */
export function MySetSheet({ surahs, onClose, onAdd }: { surahs: Surah[]; onClose: () => void; onAdd: () => void }) {
  const my = useStore((s) => s.qhMy)
  const set = useStore((s) => s.set)
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= my.length) return
    haptic.tick()
    const l = [...my];
    [l[i], l[j]] = [l[j], l[i]]
    set({ qhMy: l })
  }
  const label = (e: string) => {
    const r = parseMyEntry(e)
    if (!r) return { t: e, sub: '' }
    const sr = surahs[r.s - 1]
    if (!r.a) return { t: sr.name, sub: `Сура целиком · ${sr.ayahs} ${plural(sr.ayahs, 'аят', 'аята', 'аятов')}` }
    return { t: sr.name, sub: r.a === r.b ? `Аят ${r.a}` : `Аяты ${r.a}–${r.b}` }
  }
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Мой набор" sub="Учится по порядку сверху вниз" onClose={onClose} />
      <div className="body">
        {my.length === 0 && <p className="hz-how">Пока пусто. Добавьте суру кнопкой ниже, а отдельные аяты — в чтении: зажмите кнопку «Учить» в окне аята.</p>}
        {my.map((e, i) => {
          const l = label(e)
          return (
            <div key={e} className="qh-my">
              <div className="t"><b>{l.t}</b><span>{l.sub}</span></div>
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Выше"><Icon id="up" /></button>
              <button onClick={() => move(i, 1)} disabled={i === my.length - 1} aria-label="Ниже"><Icon id="up" className="icon flip" /></button>
              <button onClick={() => { haptic.tick(); set({ qhMy: my.filter((x) => x !== e) }) }} aria-label="Убрать"><Icon id="close" /></button>
            </div>
          )
        })}
        <div className="hz-sheet-btns"><button className="bigbtn" onClick={onAdd}><Icon id="plus" />Добавить суру</button></div>
      </div>
    </Sheet>
  )
}
