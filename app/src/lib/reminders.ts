// Напоминания (локальные уведомления): работают в приложении из магазина, без сервера.
// Заранее ставим в расписание телефона несколько ближайших дней и обновляем расписание при каждом заходе в приложение
// и при выходе из него — так в тексте всегда актуальные числа.
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import { plural } from './plural'
import { dayNum } from './hifz'
import { isNative } from './telegram'
import { dayStr, useStore } from '../store/settings'
import type { RemindCfg, RemindKey } from '../types/settings'

export const REMIND_ENABLED = isNative

/** Названия и пояснения для экрана настроек */
export const REMIND_INFO: Record<RemindKey, { title: string; sub: string }> = {
  review: { title: 'Пора повторить', sub: 'Сколько хадисов и аятов ждут повторения' },
  morning: { title: 'Утренние азкары', sub: 'Каждый день в выбранное время' },
  evening: { title: 'Вечерние азкары', sub: 'Каждый день в выбранное время' },
  friday: { title: 'Пятница', sub: 'Сура «Аль-Кахф» и призывание благословения на Пророка ﷺ' },
  streak: { title: 'Серия занятий', sub: 'Вечером, если сегодня ещё не читали' },
}
export const REMIND_KEYS: RemindKey[] = ['review', 'morning', 'evening', 'friday', 'streak']

// номера уведомлений: у каждого вида свой диапазон, чтобы чужие не трогать
const ID = { review: 100, morning: 201, evening: 202, friday: 203, streak: 300 }
const OURS = (id: number) => id >= 100 && id < 400
const CHANNEL = 'reminders'
const DAYS_AHEAD = 14

const at = (t: string, day: number) => {
  const [h, m] = t.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() + day)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

/** Разрешено ли показывать уведомления; при необходимости спрашивает у человека */
export async function ensureRemindPermission(): Promise<boolean> {
  if (!REMIND_ENABLED) return false
  try {
    let p = await LocalNotifications.checkPermissions()
    if (p.display !== 'granted') p = await LocalNotifications.requestPermissions()
    return p.display === 'granted'
  } catch { return false }
}

/** Сколько отрывков хадисов и Корана ждёт повторения к концу указанного дня */
const dueBy = (day: number) => {
  const s = useStore.getState()
  return [...Object.values(s.hifz), ...Object.values(s.qhifz)].filter((c) => c.d <= day).length
}

/** Перестроить расписание: убрать наши прежние уведомления и поставить новые по настройкам */
export async function syncReminders() {
  if (!REMIND_ENABLED) return
  try {
    const { rem, streak, lastDay } = useStore.getState()
    const pending = await LocalNotifications.getPending()
    const old = pending.notifications.filter((n) => OURS(n.id))
    if (old.length) await LocalNotifications.cancel({ notifications: old.map((n) => ({ id: n.id })) })
    if (!REMIND_KEYS.some((k) => rem[k].on)) return
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
    await LocalNotifications.createChannel({ id: CHANNEL, name: 'Напоминания', importance: 3 }).catch(() => {})

    const list: LocalNotificationSchema[] = []
    const push = (id: number, title: string, body: string, to: string, schedule: LocalNotificationSchema['schedule']) =>
      list.push({ id, title, body, schedule, channelId: CHANNEL, extra: { to } })
    const now = Date.now()
    const cfg = (k: RemindKey): RemindCfg => rem[k]

    if (cfg('review').on) {
      for (let i = 0; i < DAYS_AHEAD; i++) {
        const d = at(cfg('review').t, i)
        if (d.getTime() <= now) continue
        const n = dueBy(dayNum(d.getTime()))
        if (n > 0) push(ID.review + i, 'Пора повторить', `На повтор: ${n} ${plural(n, 'отрывок', 'отрывка', 'отрывков')} из хадисов и Корана. Это займёт несколько минут.`, '/hifz', { at: d, allowWhileIdle: true })
      }
    }
    if (cfg('morning').on) {
      const [h, m] = cfg('morning').t.split(':').map(Number)
      push(ID.morning, 'Утренние азкары', 'Начните день с поминания Аллаха.', '/azkar', { on: { hour: h, minute: m }, allowWhileIdle: true })
    }
    if (cfg('evening').on) {
      const [h, m] = cfg('evening').t.split(':').map(Number)
      push(ID.evening, 'Вечерние азкары', 'Завершите день с поминанием Аллаха.', '/azkar', { on: { hour: h, minute: m }, allowWhileIdle: true })
    }
    if (cfg('friday').on) {
      const [h, m] = cfg('friday').t.split(':').map(Number)
      // weekday: 1 — воскресенье … 6 — пятница
      push(ID.friday, 'Сегодня пятница', 'Прочитайте суру «Аль-Кахф» и чаще призывайте благословение на Пророка ﷺ.', '/read/18', { on: { weekday: 6, hour: h, minute: m }, allowWhileIdle: true })
    }
    if (cfg('streak').on) {
      for (let i = 0; i < 7; i++) {
        const d = at(cfg('streak').t, i)
        if (d.getTime() <= now) continue
        if (i === 0 && lastDay === dayStr()) continue // сегодня уже читали — напоминать не нужно
        const known = i === 0 && streak > 0
        push(ID.streak + i, known ? `Серия: ${streak} ${plural(streak, 'день', 'дня', 'дней')}` : 'Не прерывайте серию',
          known ? 'Загляните на 5 минут, чтобы серия не прервалась.' : 'Сегодня ещё не читали. Загляните на 5 минут.', '/quran', { at: d, allowWhileIdle: true })
      }
    }
    if (list.length) await LocalNotifications.schedule({ notifications: list })
  } catch { /* уведомления не критичны */ }
}
