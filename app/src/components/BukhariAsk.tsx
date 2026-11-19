import { useEffect, useState } from 'react'
import { haptic } from '../lib/telegram'
import { useStore } from '../store/settings'
import './RemindAsk.css'

/** Окошко посередине экрана для тех, кто уже прошёл опросник: «Чей перевод Бухари читать?». Показывается один раз. */
export function BukhariAsk() {
  const st = useStore()
  const [ready, setReady] = useState(false)
  const settled = st.obSeen || st.obDone // сначала пусть закончится знакомство с приложением
  useEffect(() => {
    if (!st.hydrated || st.hdAsked || !settled) return
    const t = setTimeout(() => setReady(true), 3000) // не мешать загрузке, экскурсу и «Что нового»
    return () => clearTimeout(t)
  }, [st.hydrated, st.hdAsked, settled])
  if (!ready || st.hdAsked) return null
  const pick = (v: 'main' | 'sharkasi') => { haptic.tap(); st.set({ hdBukhari: v, hdAsked: true }) }
  return (
    <div className="ra-back" role="dialog" aria-modal="true" aria-label="Перевод хадисов">
      <div className="ra-card">
        <div className="ra-ic" aria-hidden>📖</div>
        <h3>Новый перевод «Сахиха» аль-Бухари</h3>
        <p>Теперь «Сахих» аль-Бухари можно читать и в переводе Абу Ислама аш-Шаркаси («Достоверный сборник»).</p>
        <p className="ra-small">Оставить прежний перевод или перейти на новый? Выбор можно поменять в любой момент: «Настройки → Переводы и источники».</p>
        <button className="bigbtn" onClick={() => pick('sharkasi')}>Читать в переводе аш-Шаркаси</button>
        <button className="bigbtn ghost" onClick={() => pick('main')}>Оставить прежний</button>
      </div>
    </div>
  )
}
