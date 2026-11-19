import { Sheet, SheetHead } from '../../components/ui'
import { haptic } from '../../lib/telegram'
import { ARABIC_FONTS } from '../../lib/azkar'
import { useStore } from '../../store/settings'
import { DrillPicker } from './DrillPicker'
import { VoiceSettings } from './VoiceSettings'

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
          <div className="qh-set-l">Язык ответа<small>По-арабски проверяются слова, пропуски и огласовки (если включено ниже)</small></div>
          <div className="qh-chips">
            <button className={st.hzVoiceLang === 'ru' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceLang: 'ru' }) }}>По-русски</button>
            <button className={st.hzVoiceLang === 'ar' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceLang: 'ar' }) }}>По-арабски</button>
          </div>
        </div>
        <VoiceSettings lang={st.hzVoiceLang} />
        {sw(st.hzVoiceNarr, 'Проверять и передатчика', 'Слова «Я слышал, как Посланник Аллаха сказал…» тоже сверяются', () => st.set({ hzVoiceNarr: !st.hzVoiceNarr }))}
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
