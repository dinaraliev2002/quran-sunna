import { useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { REMIND_ENABLED, syncReminders } from '../lib/reminders'
import { useStore } from '../store/settings'

/** Держит расписание напоминаний в актуальном виде (один раз на всё приложение; только в приложении из магазина) */
export function useReminders() {
  const hydrated = useStore((s) => s.hydrated)
  const rem = useStore((s) => s.rem)
  const hifz = useStore((s) => s.hifz)
  const qhifz = useStore((s) => s.qhifz)
  const streak = useStore((s) => s.streak)
  const lastDay = useStore((s) => s.lastDay)

  // что-то изменилось (настройки, повторы, серия) — обновляем расписание чуть позже, без суеты
  useEffect(() => {
    if (!REMIND_ENABLED || !hydrated) return
    const t = setTimeout(syncReminders, 2000)
    return () => clearTimeout(t)
  }, [hydrated, rem, hifz, qhifz, streak, lastDay])

  // вышли из приложения — обновляем ещё раз, чтобы в уведомлениях были свежие числа
  useEffect(() => {
    if (!REMIND_ENABLED) return
    const h = CapApp.addListener('appStateChange', (s) => { if (!s.isActive) syncReminders() })
    // нажали на уведомление — открываем нужный раздел
    const tap = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const to = (e.notification.extra as { to?: string } | undefined)?.to
      if (to) location.hash = '#' + to
    })
    return () => { h.then((x) => x.remove()); tap.then((x) => x.remove()) }
  }, [])
}
