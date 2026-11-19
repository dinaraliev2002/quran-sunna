import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'

/**
 * Настройки проверки голосом — общие для хадисов и Корана (так их не придётся искать в одном месте и не хватать в другом).
 * Показываются только те, что действуют: по-арабски — сверка огласовок, по-русски — модель распознавания и прощение неточностей.
 * lang — язык ответа: у Корана всегда арабский.
 */
export function VoiceSettings({ lang }: { lang: 'ru' | 'ar' }) {
  const st = useStore()
  const sw = (on: boolean, t: string, sub: string, toggle: () => void) => (
    <button className="qh-sw" onClick={() => { haptic.tick(); toggle() }}>
      <span className="t">{t}<small>{sub}</small></span>
      <span className={'switch' + (on ? ' on' : '')} />
    </button>
  )
  return (
    <>
      <div>
        <div className="qh-set-l">Распознавание речи<small>Облачное точнее и работает везде; системное — бесплатное, прямо на телефоне, но хуже понимает арабский</small></div>
        <div className="qh-chips">
          <button className={st.hzVoiceEngine === 'cloud' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceEngine: 'cloud' }) }}>Облачное</button>
          <button className={st.hzVoiceEngine === 'system' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceEngine: 'system' }) }}>Системное</button>
        </div>
      </div>
      {st.hzVoiceEngine === 'cloud' && lang === 'ru' && (
        <div>
          <div className="qh-set-l">Модель распознавания<small>Точная — меньше ошибок; быстрая — чуть быстрее и в 3 раза дешевле. Арабский распознаётся отдельной моделью, этот выбор его не касается</small></div>
          <div className="qh-chips">
            <button className={st.hzVoiceModel === 'full' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceModel: 'full' }) }}>Точная</button>
            <button className={st.hzVoiceModel === 'turbo' ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzVoiceModel: 'turbo' }) }}>Быстрая</button>
          </div>
        </div>
      )}
      {sw(st.hzVoiceAi, 'ИИ-помощник', lang === 'ar'
        ? 'Засчитывает спорные слова, которые не ошибка: другая запись хамзы, слитное и раздельное написание, неточное распознавание'
        : 'Засчитывает спорные слова, которые не ошибка: «посланнику Его» вместо «Его посланнику», неточное распознавание', () => st.set({ hzVoiceAi: !st.hzVoiceAi }))}
      {lang === 'ar' && sw(st.hzHarakat, 'Проверять огласовки', 'Другая гласная или удвоение буквы — ошибка. Последнюю букву слова (остановка) не считаем. Работает, когда распознавание пишет огласовки', () => st.set({ hzHarakat: !st.hzHarakat }))}
      {sw(st.hzVoiceSave, 'Сохранять мои записи', 'Для разработчика: запись голоса и результат сохраняются, чтобы проверить и улучшить распознавание. Только для теста, по умолчанию выключено', () => st.set({ hzVoiceSave: !st.hzVoiceSave }))}
      {lang === 'ru' && sw(st.hzVoiceLoose, 'Прощать неточное распознавание', 'Если приложение расслышало слово чуть иначе (окончание, одна буква) — не считать ошибкой. Замена слова синонимом штрафуется всегда', () => st.set({ hzVoiceLoose: !st.hzVoiceLoose }))}
    </>
  )
}
