import { TICK_SOUNDS, tickSound } from '../../../lib/tickSound'
import { VIBES, vibe } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'

/** Тестовая версия и разработка: пробные звуки и вибрации колеса — нажали, услышали/почувствовали, выбрали */
export const SHOW_TEST_FEEL = import.meta.env.DEV || location.pathname.includes('/test/')

export function TestFeel() {
  const st = useStore()
  return (
    <div className="qh-feel" style={{ marginTop: 14 }}>
      <div className="qh-set-l">Пробные вибрации (тест)<small>Нажмите — почувствуете и выберете. Выбранная будет на колесе</small></div>
      <div className="qh-chips">
        {VIBES.map((name, i) => (
          <button key={i} className={st.wheelVibe === i + 1 ? 'on' : ''} onClick={() => { vibe(i + 1); st.set({ wheelVibe: i + 1 }) }}>{i + 1}. {name}</button>
        ))}
      </div>
      <div className="qh-set-l" style={{ marginTop: 12 }}>Пробные звуки (тест)<small>Так же: нажмите — услышите и выберете</small></div>
      <div className="qh-chips">
        {TICK_SOUNDS.map((x, i) => (
          <button key={i} className={st.wheelSound === i + 1 ? 'on' : ''} onClick={() => { tickSound(i + 1); st.set({ wheelSound: i + 1 }) }}>{i + 1}. {x.name}</button>
        ))}
      </div>
    </div>
  )
}
