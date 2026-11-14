import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'

/** Упражнения урока хадисов, которые можно включать по одному */
export const DRILL_OPTIONS: { id: string; t: string; sub: string }[] = [
  { id: 'gap3', t: 'Пропуски: каждое третье слово', sub: 'Скрыто каждое третье слово' },
  { id: 'gap2', t: 'Пропуски: половина слов', sub: 'Скрыто каждое второе слово' },
  { id: 'gap1', t: 'Пропуски: все слова', sub: 'Скрыт весь текст, нужно вспомнить самому' },
  { id: 'build', t: 'Сборка из кусочков', sub: 'Расставить части хадиса по порядку' },
]

/** Список упражнений с выключателями; показывается под переключателем «Упражнения при заучивании» */
export function DrillPicker() {
  const set = useStore((s) => s.hzDrillSet)
  const st = useStore.getState()
  const toggle = (id: string) => {
    haptic.tick()
    st.set({ hzDrillSet: set.includes(id) ? set.filter((x) => x !== id) : DRILL_OPTIONS.map((o) => o.id).filter((x) => x === id || set.includes(x)) })
  }
  return (
    <div className="hz-drill-pick">
      {DRILL_OPTIONS.map((o) => (
        <button key={o.id} className="qh-sw" onClick={() => toggle(o.id)}>
          <span className="t">{o.t}<small>{o.sub}</small></span>
          <span className={'switch' + (set.includes(o.id) ? ' on' : '')} />
        </button>
      ))}
    </div>
  )
}
