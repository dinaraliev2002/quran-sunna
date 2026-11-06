import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { TabBar } from '../components/ui'
import { ensureRemindPermission, REMIND_ENABLED, REMIND_INFO, REMIND_KEYS } from '../lib/reminders'
import { BOT_REMIND } from '../lib/remindBot'
import { haptic } from '../lib/telegram'
import { useStore } from '../store/settings'
import type { RemindKey } from '../types/settings'

/** Настройки → Напоминания: какие напоминания включить и во сколько */
export default function Reminders() {
  const nav = useNavigate()
  const rem = useStore((s) => s.rem)
  const set = useStore((s) => s.set)
  const [denied, setDenied] = useState(false)

  const patch = (k: RemindKey, v: Partial<(typeof rem)[RemindKey]>) => set({ rem: { ...rem, [k]: { ...rem[k], ...v } } })
  const toggle = async (k: RemindKey) => {
    haptic.tap()
    if (!rem[k].on) {
      const ok = await ensureRemindPermission()
      setDenied(!ok)
      if (!ok) return
    }
    patch(k, { on: !rem[k].on })
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Напоминания</b><span>{BOT_REMIND ? 'Придут сообщением от бота' : 'Без интернета и без сервера'}</span></div>
        <span style={{ width: 44 }} />
      </div>
      {!REMIND_ENABLED && <p className="hint" style={{ marginBottom: 14 }}>Напоминания работают в Telegram и в приложении из App Store и Google Play. В обычном браузере показать их нельзя.</p>}
      {denied && <p className="hint" style={{ marginBottom: 14 }}>{BOT_REMIND
        ? 'Telegram не разрешил боту писать вам. Нажмите «Разрешить», когда Telegram спросит, или откройте чат с ботом и нажмите «Запустить», затем включите напоминание ещё раз.'
        : 'Уведомления выключены для приложения. Разрешите их в настройках телефона и включите напоминание ещё раз.'}</p>}
      <p className="hint" style={{ marginBottom: 14 }}>Все напоминания выключены, пока вы их не включите. Время можно выбрать любое.</p>
      <div className="group">
        {REMIND_KEYS.map((k) => (
          <div key={k} className="rm-item">
            <button className="srow2" disabled={!REMIND_ENABLED} onClick={() => toggle(k)}>
              <div>{REMIND_INFO[k].title}<span>{REMIND_INFO[k].sub}</span></div>
              <span className={'switch' + (rem[k].on ? ' on' : '')} />
            </button>
            {rem[k].on && (
              <label className="rm-time">
                <span>{k === 'friday' ? 'В пятницу в' : 'Каждый день в'}</span>
                <input type="time" value={rem[k].t} onChange={(e) => e.target.value && patch(k, { t: e.target.value })} />
              </label>
            )}
          </div>
        ))}
      </div>
      <p className="dl-note small">«Пора повторить» приходит, только если есть что повторять. «Серия занятий» — только если сегодня вы ещё не читали Коран.</p>
      <TabBar />
    </div>
  )
}
