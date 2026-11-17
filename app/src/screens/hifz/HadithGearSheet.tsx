import { Sheet, SheetHead } from '../../components/ui'
import { haptic } from '../../lib/telegram'
import { ARABIC_FONTS } from '../../lib/azkar'
import { useStore } from '../../store/settings'
import { DrillPicker } from './DrillPicker'

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
        <div>
          <div className="qh-set-l">Распознавание речи<small>Облачное (Groq) обычно точнее и работает везде; системное — бесплатное, прямо на телефоне</small></div>
          <div className="qh-chips">
            <button className={st.hzVoiceEngine === 'cloud' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceEngine: 'cloud' }) }}>Облачное</button>
            <button className={st.hzVoiceEngine === 'system' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceEngine: 'system' }) }}>Системное</button>
          </div>
        </div>
        {st.hzVoiceEngine === 'cloud' && (
          <div>
            <div className="qh-set-l">Модель распознавания<small>Точная — меньше ошибок; быстрая — чуть быстрее и в 3 раза дешевле</small></div>
            <div className="qh-chips">
              <button className={st.hzVoiceModel === 'full' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceModel: 'full' }) }}>Точная</button>
              <button className={st.hzVoiceModel === 'turbo' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceModel: 'turbo' }) }}>Быстрая</button>
            </div>
          </div>
        )}
        <div>
          <div className="qh-set-l">Язык ответа<small>По-арабски проверяются слова, пропуски и (если включено ниже) огласовки</small></div>
          <div className="qh-chips">
            <button className={st.hzVoiceLang === 'ru' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceLang: 'ru' }) }}>По-русски</button>
            <button className={st.hzVoiceLang === 'ar' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceLang: 'ar' }) }}>По-арабски</button>
          </div>
        </div>
        {sw(st.hzVoiceAi, 'ИИ-помощник', 'Засчитывает спорные слова, которые не ошибка: «посланнику Его» вместо «Его посланнику», неточное распознавание', () => st.set({ hzVoiceAi: !st.hzVoiceAi }))}
        {sw(st.hzHarakat, 'Проверять огласовки', 'Только по-арабски: другая гласная или удвоение буквы — ошибка. Последнюю букву слова (остановка) и первую не считаем', () => st.set({ hzHarakat: !st.hzHarakat }))}
        {sw(st.hzVoiceNarr, 'Проверять и передатчика', 'Слова «Я слышал, как Посланник Аллаха сказал…» тоже сверяются', () => st.set({ hzVoiceNarr: !st.hzVoiceNarr }))}
        {sw(st.hzVoiceLoose, 'Прощать неточное распознавание', 'Если приложение расслышало слово чуть иначе (окончание, одна буква) — не считать ошибкой. Замена слова синонимом штрафуется всегда', () => st.set({ hzVoiceLoose: !st.hzVoiceLoose }))}
        {sw(st.hzDrills, 'Упражнения при заучивании', 'Включите и выберите, какие проходить', () => st.set({ hzDrills: !st.hzDrills }))}
        {st.hzDrills && <DrillPicker />}
        {sw(st.hzAr, 'Арабский текст', 'Показывать арабский при чтении хадиса', () => st.set({ hzAr: !st.hzAr }))}
        {st.hzAr && (
          <>
            <div>
              <div className="qh-set-l">Шрифт арабского текста<small>Общий с хадисами и азкарами</small></div>
              <div className="az-fonts">
                {(Object.keys(ARABIC_FONTS) as (keyof typeof ARABIC_FONTS)[]).map((k) => (
                  <button key={k} className={(st.azFont ?? 'sch') === k ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ azFont: k }) }}>
                    <span style={{ fontFamily: ARABIC_FONTS[k].css }}>قَالَ النَّبِيُّ ﷺ</span>
                    <b>{ARABIC_FONTS[k].name}</b>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="qh-set-l">Размер арабского текста</div>
              <div className="stepper"><small>{st.hdArSize}</small><button onClick={() => st.set({ hdArSize: Math.max(16, st.hdArSize - 2) })}>−</button><button onClick={() => st.set({ hdArSize: Math.min(40, st.hdArSize + 2) })}>+</button></div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
