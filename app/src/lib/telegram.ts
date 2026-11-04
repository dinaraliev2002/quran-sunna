// Тонкая обёртка над Telegram WebApp API (скрипт telegram-web-app.js подключён в index.html).
// В обычном браузере (без Telegram) всё работает через заглушки и localStorage.

import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { Share } from '@capacitor/share'
import { SplashScreen } from '@capacitor/splash-screen'

/** Запущено как установленное приложение (App Store / Google Play), а не в браузере или Telegram */
export const isNative = Capacitor.isNativePlatform()
const isIos = Capacitor.getPlatform() === 'ios'
const isAndroid = Capacitor.getPlatform() === 'android'
const impact = (style: ImpactStyle) => isNative && Haptics.impact({ style }).catch(() => {})
// Android: свой модуль с системным откликом касания (мягче, чем вибромотор плагина Haptics)
const Feedback = registerPlugin<{ perform: (o: { kind: string }) => Promise<void> }>('Feedback')

/** Где вибрация разрешена: пользователь выключает её в настройках по разделам (store/settings подключает правило) */
export type HapticArea = 'azkar' | 'hadith' | 'quran'
let hapticAllowed: (area?: HapticArea) => boolean = () => true
export const setHapticPolicy = (fn: (area?: HapticArea) => boolean) => { hapticAllowed = fn }

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
  if (isNative) SplashScreen.hide().catch(() => {})
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
  if (isNative) {
    // значки в строке состояния: светлые на тёмной теме, тёмные на светлой
    const dark = document.documentElement.dataset.theme !== 'light'
    SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  }
  if (!inTelegram) return
  if (at('6.1')) {
    wa!.setHeaderColor?.(bg)
    wa!.setBackgroundColor?.(bg)
  }
  if (at('7.10')) wa!.setBottomBarColor?.(bg)
}

export const telegramScheme = (): 'light' | 'dark' | null => (inTelegram ? wa!.colorScheme : null)

export const tgUser = (): TgUser | undefined => (inTelegram ? wa!.initDataUnsafe.user : undefined)

const feel = (kind: 'tap' | 'tick' | 'page' | 'success') => Feedback.perform({ kind }).catch(() => {})

export const haptic = {
  tap: (area?: HapticArea) => {
    if (isNative && !hapticAllowed(area)) return
    if (isAndroid) return feel('tap')
    return isNative ? impact(ImpactStyle.Light) : inTelegram && at('6.1') && wa!.HapticFeedback.impactOccurred('light')
  },
  /** листание карточек, страниц, аятов: самый лёгкий отклик */
  tick: (area?: HapticArea) => {
    if (isNative && !hapticAllowed(area)) return
    if (isAndroid) return feel('tick')
    if (!isNative) return inTelegram && at('6.1') && wa!.HapticFeedback.selectionChanged()
    Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd()).catch(() => {})
  },
  /** перешли на другую страницу Корана — чуть заметнее, чем обычное листание */
  page: (area?: HapticArea) => {
    if (isNative && !hapticAllowed(area)) return
    if (isAndroid) return feel('page')
    return isNative ? impact(ImpactStyle.Medium) : inTelegram && at('6.1') && wa!.HapticFeedback.impactOccurred('medium')
  },
  success: () => {
    if (isNative && !hapticAllowed()) return
    if (isAndroid) return feel('success')
    return isNative ? Haptics.notification({ type: NotificationType.Success }).catch(() => {}) : inTelegram && at('6.1') && wa!.HapticFeedback.notificationOccurred('success')
  },
}

export const APP_LINK ='https://t.me/quran_sunna_app_bot?startapp'

/** Поделиться текстом: в Telegram — выбор чата, в браузере — системное меню или буфер обмена */
export function shareText(text: string) {
  if (isNative) {
    Share.share({ text: `${text}\n\n${APP_LINK}` }).catch(() => {})
  } else if (inTelegram && at('6.1') && wa!.openTelegramLink) {
    wa!.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent(text)}`)
  } else if (navigator.share) {
    navigator.share({ text: `${text}\n\n${APP_LINK}` }).catch(() => {})
  } else {
    navigator.clipboard?.writeText(`${text}\n\n${APP_LINK}`)
  }
}

/** Открыть бота приложения с командой (feedback — написать автору, support — поддержать проект) */
export function openBot(start: 'feedback' | 'support') {
  const url = `https://t.me/quran_sunna_app_bot?start=${start}`
  if (isNative) Browser.open({ url }).catch(() => {})
  else if (inTelegram && at('6.1') && wa!.openTelegramLink) wa!.openTelegramLink(url)
  else window.open(url, '_blank')
}

const TRIBUTE_URL = 'https://t.me/tribute/app?startapp=dSRl'
/** Открыть страницу поддержки проекта (Tribute) */
export function openSupport() {
  // в магазинах платёжные ссылки не открываем: поддержка — через бота (там же можно написать автору)
  if (isNative) openBot('support')
  else if (inTelegram && at('6.1') && wa!.openTelegramLink) wa!.openTelegramLink(TRIBUTE_URL)
  else window.open(TRIBUTE_URL, '_blank')
}

/** Сообщить боту, что человек открыл приложение (раз в сутки) — для статистики /stats */
export function registerVisit() {
  if (!inTelegram) return
  try {
    const day = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem('visit_sent') === day) return
    fetch('https://ynqbnqkihojqlawhhiqg.supabase.co/functions/v1/quran-bot', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: wa!.initData }),
    }).then((r) => { if (r.ok) localStorage.setItem('visit_sent', day) }).catch(() => {})
  } catch { /* не критично */ }
}

const isTablet = Math.min(screen.width, screen.height) >= 600

/** Телефон из магазина: портрет везде, кроме разделов для чтения (там можно повернуть). Планшет: любой поворот. */
export function allowRotation(free: boolean) {
  if (!isNative) return
  if (free || isTablet) ScreenOrientation.unlock().catch(() => {})
  else ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => {})
}

function toast(text: string) {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = 'position:fixed;left:50%;bottom:calc(var(--safe-bottom,0px) + 110px);transform:translateX(-50%);max-width:86vw;padding:10px 16px;border-radius:16px;background:rgba(30,30,30,.92);color:#fff;font:600 14px var(--font-ui,system-ui);z-index:1000;text-align:center'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1800)
}

// Android: если системные панели (строка состояния и кнопки навигации) лежат ВНЕ окна приложения, отступы под них не нужны.
// Иначе нижнее меню и плеер поднимаются выше, чем должны. На телефонах, где окно идёт под панелями, ничего не меняем.
function fixAndroidInsets() {
  const root = document.documentElement.style
  const apply = () => {
    const outside = screen.height - window.innerHeight > 8
    for (const side of ['top', 'bottom']) {
      if (outside) root.setProperty(`--tg-safe-area-inset-${side}`, '0px')
      else root.removeProperty(`--tg-safe-area-inset-${side}`)
    }
  }
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', () => setTimeout(apply, 300))
}
if (isNative && Capacitor.getPlatform() === 'android') fixAndroidInsets()

// Приложение из магазина: кнопка «Назад» на Android и свайп от левого края на iPhone — как в системных приложениях
let nativeBack: (() => void) | null = null
if (isNative) {
  let lastBack = 0
  /** Назад по истории приложения; true — шаг сделан, false — мы на главной */
  const stepBack = () => {
    const st = history.state as { idx?: number } | null
    if (st && typeof st.idx === 'number' && st.idx > 0) { history.back(); return true }
    if (!/^#?\/?$/.test(location.hash)) { location.hash = '#/'; return true }
    return false
  }
  CapApp.addListener('backButton', () => {
    if (nativeBack) return nativeBack()
    if (stepBack()) return // у экрана нет своей кнопки «Назад»: идём назад по истории, а с главной выходим со второго нажатия
    const now = Date.now()
    if (now - lastBack < 2000) { CapApp.exitApp().catch(() => {}); return }
    lastBack = now
    toast('Нажмите «Назад» ещё раз, чтобы выйти')
  })
  if (isIos) {
    let sx = 0, sy = 0, edge = false
    document.addEventListener('touchstart', (e) => {
      const t = e.touches[0]
      sx = t.clientX; sy = t.clientY
      edge = sx < 24
    }, { passive: true })
    document.addEventListener('touchend', (e) => {
      if (!edge) return
      edge = false
      const t = e.changedTouches[0]
      if (t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 60) { if (nativeBack) nativeBack(); else stepBack() }
    }, { passive: true })
  }
}

export function backButton(visible: boolean, onClick: () => void) {
  if (isNative) {
    nativeBack = visible ? onClick : null
    return () => { if (nativeBack === onClick) nativeBack = null }
  }
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
