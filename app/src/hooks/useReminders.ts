import { useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { REMIND_NATIVE, syncReminders } from '../lib/reminders'
import { BOT_REMIND, openDeepLink, syncBotReminders } from '../lib/remindBot'
import { useStore } from '../store/settings'

/** Держит напоминания в актуальном виде (один раз на всё приложение):
 *  в приложении из магазина — расписание уведомлений телефона, в Telegram — настройки на сервере бота */
export function useReminders() {
  const hydrated = useStore((s) => s.hydrated)
  const rem = useStore((s) => s.rem)
  const hifz = useStore((s) => s.hifz)
  const qhifz = useStore((s) => s.qhifz)
  const streak = useStore((s) => s.streak)
  const lastDay = useStore((s) => s.lastDay)

  // что-то изменилось (настройки, повторы, серия) — обновляем расписание чуть позже, без суеты
  useEffect(() => {
    if (!hydrated || !(REMIND_NATIVE || BOT_REMIND)) return
    const t = setTimeout(REMIND_NATIVE ? syncReminders : syncBotReminders, 2000)
    return () => clearTimeout(t)
  }, [hydrated, rem, hifz, qhifz, streak, lastDay])

  // открыли по кнопке из сообщения бота — переходим в нужный раздел
  useEffect(() => { if (BOT_REMIND) openDeepLink() }, [])

  // вышли из приложения — обновляем ещё раз, чтобы в уведомлениях были свежие числа
  useEffect(() => {
    if (!REMIND_NATIVE) return
    const h = CapApp.addListener('appStateChange', (s) => { if (!s.isActive) syncReminders() })
    // нажали на уведомление — открываем нужный раздел
    const tap = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const to = (e.notification.extra as { to?: string } | undefined)?.to
      if (to) location.hash = '#' + to
    })
    return () => { h.then((x) => x.remove()); tap.then((x) => x.remove()) }
  }, [])
  useEffect(() => {
    if (!BOT_REMIND) return
    const onHide = () => { if (document.visibilityState === 'hidden') syncBotReminders() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])
}
