// Шрифты страниц Мединского мусхафа (Комплекс короля Фахда, QPC). У каждой из 604 страниц свой шрифт,
// каждое слово — готовый глиф. Используются во всех режимах чтения:
//  V2 — обычный текст, V4 — с цветным таджвидом (цвета печатного мусхафа с таджвидом).
// V4 бывает в двух форматах: COLRv1 (Chrome/Android) и OT-SVG (Safari: iPhone, iPad, Mac) — у OT-SVG
// отдельные файлы для светлой и тёмной темы.
// Скачанный шрифт сохраняется на телефоне (IndexedDB) — второй раз страница открывается мгновенно и без сети.
// Пока берём с CDN Quran.com; перед релизом перенесём к себе.

import { create } from 'zustand'
import { cachedBuffer } from './net'

type Theme = 'light' | 'dark'

/** Движок Safari (все браузеры на iOS, Telegram на iPhone/Mac) — для него таджвид в формате OT-SVG */
export const appleWebKit = (() => {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return true
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true // iPadOS
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Android|Edg|OPR/.test(ua)
})()

/** Вариант шрифтов для текущих настроек: v2 · v4c (COLRv1) · v4s-light / v4s-dark (OT-SVG) */
export const fontVariant = (tajweed: boolean, theme: Theme) => (!tajweed ? 'v2' : appleWebKit ? `v4s-${theme}` : 'v4c')

export function fontUrl(p: number, variant: string) {
  if (variant === 'v2') return `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${p}.woff2`
  if (variant === 'v4c') return `https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${p}.woff2`
  return `https://verses.quran.foundation/fonts/quran/hafs/v4/ot-svg/${variant.slice(4)}/woff2/p${p}.woff2`
}
export const fontKey = (p: number, variant: string) => `font:${variant}:p${p}`

export function pageFontFamily(p: number, tajweed: boolean, theme: Theme) {
  const v = fontVariant(tajweed, theme)
  return v === 'v2' ? `QPC-p${p}` : v === 'v4c' ? `QPCT-p${p}` : `QPCT-${theme}-p${p}`
}

/** Тёмная палитра цветного шрифта COLRv1 (для OT-SVG есть отдельный тёмный файл) */
export const pagePalette = (p: number) => (appleWebKit ? 'normal' : `--tjdark-${p}`)

// какие шрифты уже готовы — чтобы не показывать «квадратики» до загрузки
export const useFonts = create<{ ready: Record<string, true> }>(() => ({ ready: {} }))
export const useFontReady = (family: string) => useFonts((s) => !!s.ready[family])

const pending = new Map<string, Promise<void>>()
let paletteStyle: HTMLStyleElement | null = null

/** Загрузить шрифт страницы (с телефона или из сети) и подключить */
export function loadPageFont(p: number, tajweed: boolean, theme: Theme): Promise<void> {
  const family = pageFontFamily(p, tajweed, theme)
  if (useFonts.getState().ready[family]) return Promise.resolve()
  if (!pending.has(family)) {
    const variant = fontVariant(tajweed, theme)
    const promise = cachedBuffer(fontKey(p, variant), fontUrl(p, variant))
      .then((buf) => new FontFace(family, buf).load())
      .then((face) => {
        document.fonts.add(face)
        if (variant === 'v4c') {
          paletteStyle ??= document.head.appendChild(document.createElement('style'))
          paletteStyle.textContent += `@font-palette-values --tjdark-${p} { font-family: "${family}"; base-palette: 1; }\n`
        }
        useFonts.setState((s) => ({ ready: { ...s.ready, [family]: true } }))
      })
      .finally(() => pending.delete(family))
    pending.set(family, promise)
  }
  return pending.get(family)!
}

/** Имя шрифта страницы; загрузка запускается в фоне */
export function pageFont(p: number, tajweed: boolean, theme: Theme) {
  loadPageFont(p, tajweed, theme).catch(() => {})
  return pageFontFamily(p, tajweed, theme)
}
