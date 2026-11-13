import { Sheet, SheetHead } from '../../components/ui'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'

const PASS = [80, 85, 90, 95, 100]

/** Шестерёнка урока хадисов: проверка голосом, упражнения, арабский текст */
export function HadithGearSheet({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const sw = (on: boolean, t: string, sub: string, toggle: () => void) => (
    <button className="qh-sw" onClick={() => { haptic.tick(); toggle() }}>
      <span className="t">{t}<small>{sub}</small></span>
      <span className={'switch' + (on ? ' on' : '')} />
    </button>
  )
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Настройки заучивания" onClose={onClose} />
      <div className="body qh-set">
        <div>
          <div className="qh-set-l">Сколько процентов считать выученным<small>Проверка голосом: так точно нужно сказать хадис</small></div>
          <div className="qh-chips">
            {PASS.map((p) => <button key={p} className={st.hzVoicePass === p ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoicePass: p }) }}>{p}%</button>)}
          </div>
        </div>
        {sw(st.hzVoiceNarr, 'Проверять и передатчика', 'Слова «Я слышал, как Посланник Аллаха сказал…» тоже сверяются', () => st.set({ hzVoiceNarr: !st.hzVoiceNarr }))}
        {sw(st.hzVoiceLoose, 'Прощать неточное распознавание', 'Если приложение расслышало слово чуть иначе (окончание, одна буква) — не считать ошибкой. Замена слова синонимом штрафуется всегда', () => st.set({ hzVoiceLoose: !st.hzVoiceLoose }))}
        {sw(st.hzDrills, 'Упражнения при заучивании', 'Пропуски слов, первые буквы, сборка из кусочков', () => st.set({ hzDrills: !st.hzDrills }))}
        {sw(st.hzAr, 'Арабский текст', 'Показывать арабский при чтении хадиса', () => st.set({ hzAr: !st.hzAr }))}
      </div>
    </Sheet>
  )
}
