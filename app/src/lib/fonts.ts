// Шрифты страниц Мединского мусхафа (Комплекс короля Фахда, QPC):
//  V2 — обычные, V4 — с цветным таджвидом (COLRv1).
// Пока берём с CDN Quran.com; перед публикацией скачаем к себе (см. план).

const V2 = (p: number) => `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${p}.woff2`
const V4 = (p: number) => `https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${p}.woff2`

export const pageFontFamily = (p: number, tajweed: boolean) => `QPC${tajweed ? 'T' : ''}-p${p}`
export const pagePalette = (p: number) => `--tjdark-${p}`

/** COLRv1 (цветные шрифты) не поддерживается в Safari → на iOS таджвид в мусхафе пока недоступен */
export const colorFontsSupported = (() => {
  const ua = navigator.userAgent
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Android|CriOS|Edg/.test(ua)
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  return !(isSafari || isIOS)
})()

const loaded = new Map<string, Promise<void>>()
let paletteStyle: HTMLStyleElement | null = null

export function loadPageFont(p: number, tajweed: boolean): Promise<void> {
  const family = pageFontFamily(p, tajweed)
  if (!loaded.has(family)) {
    const face = new FontFace(family, `url(${tajweed ? V4(p) : V2(p)}) format("woff2")`, { display: 'block' })
    const promise = face.load().then((f) => {
      document.fonts.add(f)
      if (tajweed) {
        // у цветного шрифта есть тёмная палитра — подключаем её для тёмной темы
        paletteStyle ??= document.head.appendChild(document.createElement('style'))
        paletteStyle.textContent += `@font-palette-values ${pagePalette(p)} { font-family: "${family}"; base-palette: 1; }\n`
      }
    })
    promise.catch(() => loaded.delete(family))
    loaded.set(family, promise)
  }
  return loaded.get(family)!
}
