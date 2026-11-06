// Напоминания в Telegram: приложение сообщает серверу (функция quran-remind), что и когда присылать,
// а сообщения отправляет бот. Сюда уходят только настройки и две цифры (сколько ждёт повтора, серия) — не весь прогресс.
import { dayNum } from './hifz'
import { inTelegram, tgCanWrite, tgInitData } from './telegram'
import { useStore } from '../store/settings'

const ENDPOINT = 'https://ynqbnqkihojqlawhhiqg.supabase.co/functions/v1/quran-remind'
const DAYS = 14

/** Работают ли напоминания через бота (мы внутри Telegram) */
export const BOT_REMIND = inTelegram

/** Сколько отрывков будет ждать повтора к концу каждого из ближайших дней (с сегодняшнего) */
function dueForecast(base: number): number[] {
  const s = useStore.getState()
  const days = [...Object.values(s.hifz), ...Object.values(s.qhifz)].map((c) => c.d)
  return Array.from({ length: DAYS }, (_, i) => days.filter((d) => d <= base + i).length)
}

/** Отправить серверу текущие настройки напоминаний */
export async function syncBotReminders() {
  if (!BOT_REMIND) return
  try {
    const { rem, streak, lastDay } = useStore.getState()
    const base = dayNum()
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        initData: tgInitData(),
        remind: {
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          cfg: rem, write: tgCanWrite(), base, due: dueForecast(base), streak, lastDay,
        },
      }),
    })
  } catch { /* нет сети — отправим в следующий раз */ }
}

/** Открыли по кнопке из сообщения бота (адрес вида ...?go=/hifz) — перейти в нужный раздел */
export function openDeepLink() {
  try {
    const go = new URLSearchParams(location.search).get('go')
    if (!go || !go.startsWith('/')) return
    history.replaceState(null, '', location.pathname + location.hash) // убираем из адреса, чтобы при обновлении не прыгать снова
    location.hash = '#' + go
  } catch { /* не критично */ }
}
