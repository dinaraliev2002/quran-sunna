import { useEffect, useState } from 'react'
import { REMIND_KEYS } from '../lib/reminders'
import { BOT_REMIND } from '../lib/remindBot'
import { haptic, tgWriteAccess } from '../lib/telegram'
import { useStore } from '../store/settings'
import './RemindAsk.css'

/** Окошко посередине экрана в Telegram: «Включить напоминания?» Показывается один раз, когда человек освоился в приложении. */
export function RemindAsk() {
  const st = useStore()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState(false)
  const settled = st.obSeen || st.obDone // сначала пусть закончится знакомство с приложением
  const anyOn = REMIND_KEYS.some((k) => st.rem[k].on)

  useEffect(() => {
    if (!BOT_REMIND || !st.hydrated || st.remAsked || !settled) return
    const t = setTimeout(() => setReady(true), 4000) // не мешать загрузке, экскурсу и «Что нового»
    return () => clearTimeout(t)
  }, [st.hydrated, st.remAsked, settled])

  if (!BOT_REMIND || !ready || st.remAsked || anyOn) return null

  const later = () => { haptic.tap(); st.set({ remAsked: true }) }
  const enable = async () => {
    haptic.tap()
    setBusy(true)
    const ok = await tgWriteAccess()
    setBusy(false)
    if (!ok) { setRefused(true); return }
    haptic.success()
    st.set({ remAsked: true, rem: Object.fromEntries(REMIND_KEYS.map((k) => [k, { ...st.rem[k], on: true }])) as typeof st.rem })
  }

  return (
    <div className="ra-back" role="dialog" aria-modal="true" aria-label="Напоминания">
      <div className="ra-card">
        <div className="ra-ic" aria-hidden>🔔</div>
        {refused ? (
          <>
            <h3>Не получилось включить</h3>
            <p>Telegram не разрешил боту писать вам. Ничего страшного: позже включите напоминания в «Настройки → Напоминания» и нажмите «Разрешить», когда Telegram спросит.</p>
            <button className="bigbtn" onClick={later}>Понятно</button>
          </>
        ) : (
          <>
            <h3>Включить напоминания?</h3>
            <p>Бот пришлёт сообщение в Telegram: когда пора повторить выученное, про утренние и вечерние азкары, суру «Аль-Кахф» по пятницам и серию занятий.</p>
            <p className="ra-small">Если сейчас не хотите — включите позже: «Настройки → Напоминания». Там же выбирается время, а любое напоминание можно выключить.</p>
            <button className="bigbtn" disabled={busy} onClick={enable}>{busy ? 'Ждём ответа Telegram…' : 'Включить'}</button>
            <button className="bigbtn ghost" disabled={busy} onClick={later}>Не сейчас</button>
          </>
        )}
      </div>
    </div>
  )
}
