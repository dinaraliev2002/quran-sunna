// Тонкая обёртка над Telegram WebApp API (скрипт telegram-web-app.js подключён в index.html).
// В обычном браузере (без Telegram) всё работает через заглушки и localStorage.

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'

interface TgUser { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string }

interface TgWebApp {
  initData: string
  initDataUnsafe: { user?: TgUser }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  ready(): void
  expand(): void
  isFullscreen?: boolean
  requestFullscreen?(): void
  isVersionAtLeast(v: string): boolean
  disableVerticalSwipes?(): void
  setHeaderColor?(c: string): void
  setBackgroundColor?(c: string): void
  setBottomBarColor?(c: string): void
  openTelegramLink?(url: string): void
  onEvent(e: string, cb: () => void): void
  offEvent(e: string, cb: () => void): void
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
  HapticFeedback: { impactOccurred(s: HapticStyle): void; selectionChanged(): void; notificationOccurred(t: 'success' | 'warning' | 'error'): void }
  CloudStorage: {
    setItem(k: string, v: string, cb?: (err: unknown, ok?: boolean) => void): void
    getItem(k: string, cb: (err: unknown, v?: string) => void): void
  }
}

declare global {
  interface Window { Telegram?: { WebApp?: TgWebApp } }
}

const wa = window.Telegram?.WebApp
/** Открыто ли приложение внутри Telegram (а не просто в браузере) */
export const inTelegram = !!wa && !!wa.initData
const at = (v: string) => inTelegram && wa!.isVersionAtLeast(v)

export function initTelegram(onTheme: (scheme: 'light' | 'dark') => void) {
  if (!inTelegram) return
  wa!.ready()
  wa!.expand()
  // Полный экран на телефоне — как бы ни открыли приложение: из списка чатов, кнопкой в диалоге или по ссылке.
  // (Кнопка в чате открывает Mini App «наполовину»; на компьютере полный экран не включаем — он занял бы весь монитор.)
  if (at('8.0') && /^(ios|android)/.test(wa!.platform) && !wa!.isFullscreen) wa!.requestFullscreen?.()
  // иначе свайп вниз по колесу/странице может закрыть приложение
  if (at('7.7')) wa!.disableVerticalSwipes?.()
  onTheme(wa!.colorScheme)
  wa!.onEvent('themeChanged', () => onTheme(wa!.colorScheme))
}

export function paintChrome(bg: string) {
  if (!inTelegram) return
  if (at('6.1')) {
    wa!.setHeaderColor?.(bg)
    wa!.setBackgroundColor?.(bg)
  }
  if (at('7.10')) wa!.setBottomBarColor?.(bg)
}

export const telegramScheme = (): 'light' | 'dark' | null => (inTelegram ? wa!.colorScheme : null)

export const tgUser = (): TgUser | undefined => (inTelegram ? wa!.initDataUnsafe.user : undefined)

export const haptic = {
  tap: () => inTelegram && at('6.1') && wa!.HapticFeedback.impactOccurred('light'),
  tick: () => inTelegram && at('6.1') && wa!.HapticFeedback.selectionChanged(),
  /** перешли на другую страницу Корана — ощутимее, чем обычное листание */
  page: () => inTelegram && at('6.1') && wa!.HapticFeedback.impactOccurred('medium'),
  success: () => inTelegram && at('6.1') && wa!.HapticFeedback.notificationOccurred('success'),
}

const APP_LINK = 'https://t.me/quran_sunna_app_bot?startapp'

/** Поделиться текстом: в Telegram — выбор чата, в браузере — системное меню или буфер обмена */
export function shareText(text: string) {
  if (inTelegram && at('6.1') && wa!.openTelegramLink) {
    wa!.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent(text)}`)
  } else if (navigator.share) {
    navigator.share({ text: `${text}\n\n${APP_LINK}` }).catch(() => {})
  } else {
    navigator.clipboard?.writeText(`${text}\n\n${APP_LINK}`)
  }
}

export function backButton(visible: boolean, onClick: () => void) {
  if (!inTelegram || !at('6.1')) return () => {}
  if (visible) {
    wa!.BackButton.show()
    wa!.BackButton.onClick(onClick)
  } else wa!.BackButton.hide()
  return () => wa!.BackButton.offClick(onClick)
}

// ---------- Хранилище: CloudStorage Telegram (синхронизируется между устройствами) + localStorage ----------

const hasCloud = () => inTelegram && at('6.9')

export function cloudGet(key: string): Promise<string | null> {
  let local: string | null = null
  try { local = localStorage.getItem(key) } catch { /* приватный режим */ }
  if (!hasCloud()) return Promise.resolve(local)
  return new Promise((resolve) => {
    wa!.CloudStorage.getItem(key, (err, v) => resolve(!err && v ? v : local))
  })
}

/** Обе копии: на телефоне и в облаке Telegram (чтобы выбрать более свежую) */
export function cloudGetBoth(key: string): Promise<{ local: string | null; cloud: string | null }> {
  let local: string | null = null
  try { local = localStorage.getItem(key) } catch { /* приватный режим */ }
  if (!hasCloud()) return Promise.resolve({ local, cloud: null })
  return new Promise((resolve) => {
    wa!.CloudStorage.getItem(key, (err, v) => resolve({ local, cloud: !err && v ? v : null }))
  })
}

/** Записать только на телефон (мгновенно) */
export function localSet(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function cloudSet(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
  // лимит CloudStorage — 4096 символов на значение
  if (hasCloud() && value.length <= 4096) wa!.CloudStorage.setItem(key, value)
}
