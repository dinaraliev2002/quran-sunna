// Шрифты страниц Мединского мусхафа (Комплекс короля Фахда, QPC). У каждой из 604 страниц свой шрифт,
// каждое слово — готовый глиф. Используются во всех режимах чтения:
//  V2 — обычный текст, V4 — с цветным таджвидом (цвета печатного мусхафа с таджвидом).
// V4 бывает в двух форматах: COLRv1 (Chrome/Android) и OT-SVG (Safari: iPhone, iPad, Mac) — у OT-SVG
// отдельные файлы для светлой и тёмной темы.
// Пока берём с CDN Quran.com; перед релизом перенесём к себе.

const V2 = (p: number) => `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${p}.woff2`
const V4_COLR = (p: number) => `https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${p}.woff2`
const V4_SVG = (p: number, theme: Theme) => `https://verses.quran.foundation/fonts/quran/hafs/v4/ot-svg/${theme}/woff2/p${p}.woff2`

type Theme = 'light' | 'dark'

/** Движок Safari (все браузеры на iOS, Telegram на iPhone/Mac) — для него таджвид в формате OT-SVG */
const appleWebKit = (() => {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return true
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true // iPadOS
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Android|Edg|OPR/.test(ua)
})()

export function pageFontFamily(p: number, tajweed: boolean, theme: Theme) {
  if (!tajweed) return `QPC-p${p}`
  return appleWebKit ? `QPCT-${theme}-p${p}` : `QPCT-p${p}`
}

/** Тёмная палитра цветного шрифта COLRv1 (для OT-SVG есть отдельный тёмный файл) */
export const pagePalette = (p: number) => (appleWebKit ? 'normal' : `--tjdark-${p}`)

const faces = new Map<string, FontFace>()
let paletteStyle: HTMLStyleElement | null = null

function register(p: number, tajweed: boolean, theme: Theme): FontFace {
  const family = pageFontFamily(p, tajweed, theme)
  let face = faces.get(family)
  if (!face) {
    const url = !tajweed ? V2(p) : appleWebKit ? V4_SVG(p, theme) : V4_COLR(p)
    face = new FontFace(family, `url(${url}) format("woff2")`, { display: 'block' })
    // шрифт зарегистрирован, но скачается только когда текст с ним появится на экране
    document.fonts.add(face)
    faces.set(family, face)
    if (tajweed && !appleWebKit) {
      paletteStyle ??= document.head.appendChild(document.createElement('style'))
      paletteStyle.textContent += `@font-palette-values --tjdark-${p} { font-family: "${family}"; base-palette: 1; }\n`
    }
  }
  return face
}

/** Подготовить шрифт страницы (скачается при первом использовании) */
export function pageFont(p: number, tajweed: boolean, theme: Theme) {
  register(p, tajweed, theme)
  return pageFontFamily(p, tajweed, theme)
}

/** Дождаться загрузки шрифта страницы (нужно мусхафу, чтобы подогнать размер) */
export function loadPageFont(p: number, tajweed: boolean, theme: Theme): Promise<void> {
  const face = register(p, tajweed, theme)
  return face.load().then(() => undefined, () => { faces.delete(pageFontFamily(p, tajweed, theme)); document.fonts.delete(face) })
}
