// «Поделиться картинкой»: карточка «Аят дня» / «Хадис дня» рисуется на canvas в том же виде, что и на главной.
// Шрифты страниц мусхафа подключены через FontFace — canvas берёт их напрямую, поэтому html-to-image не нужен.

import { loadPageFont, pageFontFamily } from './fonts'

export interface ShareCard {
  kind: 'ayah' | 'hadith'
  /** Страница мусхафа: на цветных фонах арабский рисуется обычным (одноцветным) шрифтом этой страницы */
  page?: number
  /** Арабский текст аята глифами страницы мусхафа (только для аята) */
  arabic?: string
  arabicFont?: string
  /** вводная фраза хадиса (от кого передано) */
  intro?: string
  text: string
  ref: string
}

const W = 1080
const PAD = 96

// ---------- Фоны ----------
// Рисуются в коде (градиент + узор), поэтому ничего не весят и не нужно ничего подгружать.
// Вид 0 — как на главной (цвета темы); дальше палитры × узоры.
interface Palette { c1: string; c2: string; light: boolean; gold: string }
const PALETTES: Palette[] = [
  { c1: '#0F5A3D', c2: '#06261A', light: false, gold: '#E7BD62' }, // изумруд
  { c1: '#1B3A66', c2: '#0A1530', light: false, gold: '#E7BD62' }, // ночное небо
  { c1: '#4A2A6B', c2: '#190E2B', light: false, gold: '#EBC878' }, // фиолетовый
  { c1: '#7A4A1E', c2: '#2B1708', light: false, gold: '#F0CB7A' }, // пустыня
  { c1: '#0E5F63', c2: '#052A2D', light: false, gold: '#E7BD62' }, // бирюза
  { c1: '#6E1F2C', c2: '#2A0A10', light: false, gold: '#EBC878' }, // гранат
  { c1: '#F7EBD0', c2: '#E5D2A6', light: true, gold: '#8A6420' }, // песок
  { c1: '#E3F1EA', c2: '#BFE0D0', light: true, gold: '#7A5E1A' }, // светлая мята
]
const PATTERNS = ['stars', 'rays', 'lattice', 'dots', 'arches'] as const
/** Сколько видов можно листать (включая «как на главной») */
export const SHARE_STYLES = 1 + PALETTES.length * 3

function paletteOf(styleIdx: number) { return PALETTES[(styleIdx - 1) % PALETTES.length] }
function patternOf(styleIdx: number) {
  const i = styleIdx - 1
  return PATTERNS[(Math.floor(i / PALETTES.length) + (i % PALETTES.length)) % PATTERNS.length]
}

function star8(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const s = r / Math.SQRT2
  for (let k = 0; k < 2; k++) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((k * Math.PI) / 4)
    ctx.strokeRect(-s, -s, s * 2, s * 2)
    ctx.restore()
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, styleIdx: number, pal: Palette) {
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h)
  g.addColorStop(0, pal.c1); g.addColorStop(1, pal.c2)
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  const ink = pal.light ? 'rgba(90,70,20,.13)' : 'rgba(255,225,150,.14)'
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'
  switch (patternOf(styleIdx)) {
    case 'stars':
      for (let y = 0, row = 0; y < h + 80; y += 120, row++)
        for (let x = row % 2 ? 80 : 0; x < w + 80; x += 160) star8(ctx, x, y, 52)
      break
    case 'rays': {
      const n = 32
      for (let i = 0; i < n; i += 2) {
        ctx.beginPath(); ctx.moveTo(w / 2, h * 0.3)
        ctx.arc(w / 2, h * 0.3, Math.max(w, h) * 1.4, (i * 2 * Math.PI) / n, ((i + 1) * 2 * Math.PI) / n)
        ctx.closePath(); ctx.fill()
      }
      break
    }
    case 'lattice':
      for (let d = -h; d < w; d += 120) {
        ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(d, h); ctx.lineTo(d + h, 0); ctx.stroke()
      }
      break
    case 'dots':
      for (let y = 30; y < h; y += 70) for (let x = 30; x < w; x += 70) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill() }
      break
    case 'arches':
      for (let r = 140; r < h + w; r += 130) { ctx.beginPath(); ctx.arc(w / 2, h, r, 0, Math.PI * 2); ctx.stroke() }
      break
  }
}

function css(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = []
  let cur = ''
  for (const w of text.split(/\s+/)) {
    const t = cur ? `${cur} ${w}` : w
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

function corner(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + dy * 56)
  ctx.lineTo(x, y + dy * 14)
  ctx.quadraticCurveTo(x, y, x + dx * 14, y)
  ctx.lineTo(x + dx * 56, y)
  ctx.stroke()
}

/** styleIdx: 0 — цвета темы, как на главной; 1… — фон из списка (см. SHARE_STYLES) */
export async function renderShareCard(c: ShareCard, styleIdx = 0): Promise<Blob> {
  const pal = styleIdx > 0 ? paletteOf(styleIdx) : null
  const bg = css('--bg', '#F7F2E7')
  const surface = css('--surface', '#FFFFFF')
  const text = pal ? (pal.light ? '#1F2A24' : '#F7F3E8') : css('--text', '#1d2a24')
  const text2 = pal ? (pal.light ? '#56605A' : 'rgba(247,243,232,.72)') : css('--text-2', '#6b756f')
  const gold = pal ? pal.gold : css('--gold', '#D9A441')
  const goldInk = css('--gold-ink', '#9A7424')
  const accent = pal ? pal.gold : c.kind === 'ayah' ? goldInk : css('--emerald-bright', '#13704B')
  const sans = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const inner = W - PAD * 2
  // цветной таджвид рассчитан на фон темы приложения; на своих фонах цвет букв берём из палитры
  let af = c.arabicFont
  if (pal && c.page) {
    await loadPageFont(c.page, false, 'dark').catch(() => {})
    af = pageFontFamily(c.page, false, 'dark')
  }

  const meas = document.createElement('canvas').getContext('2d')!
  if (c.arabic && af) await document.fonts.load(`60px '${af}'`, c.arabic).catch(() => {})
  await document.fonts.ready

  // раскладка
  const arSize = 64, arLH = 124
  const trSize = c.kind === 'ayah' ? 38 : 40, trLH = trSize * 1.55
  const arLines: string[] = []
  if (c.arabic && af) {
    meas.font = `${arSize}px '${af}'`
    meas.direction = 'rtl'
    arLines.push(...wrap(meas, c.arabic, inner))
  }
  meas.direction = 'ltr'
  meas.font = `${c.kind === 'ayah' ? 600 : 700} ${trSize}px ${sans}`
  const trLines = wrap(meas, c.text, inner)
  meas.font = `600 ${32}px ${sans}`
  const inLines = c.intro ? wrap(meas, c.intro, inner) : []

  const H = Math.round(
    150 + 40 + (inLines.length ? inLines.length * 48 + 24 : 0) + arLines.length * arLH + (arLines.length ? 24 : 0) +
      trLines.length * trLH + 56 + 44 + 120,
  )

  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  if (pal) drawBackground(ctx, W, H, styleIdx, pal)
  else { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H) }

  // карточка
  const m = 40, r = 56
  ctx.beginPath(); ctx.roundRect(m, m, W - m * 2, H - m * 2, r)
  const grad = ctx.createRadialGradient(W / 2, m, 0, W / 2, m, W * 0.7)
  grad.addColorStop(0, 'rgba(217,164,65,.20)'); grad.addColorStop(0.6, 'rgba(217,164,65,0)')
  ctx.fillStyle = pal ? (pal.light ? 'rgba(255,255,255,.62)' : 'rgba(0,0,0,.34)') : surface; ctx.fill()
  if (!pal) { ctx.fillStyle = grad; ctx.fill() }
  ctx.strokeStyle = 'rgba(217,164,65,.45)'; ctx.lineWidth = 2; ctx.stroke()

  ctx.strokeStyle = gold; ctx.lineWidth = 5; ctx.lineCap = 'round'
  const o = m + 28
  corner(ctx, o, o, 1, 1); corner(ctx, W - o, o, -1, 1); corner(ctx, o, H - o, 1, -1); corner(ctx, W - o, H - o, -1, -1)

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  let y = 150
  ctx.fillStyle = accent
  ctx.font = `800 28px ${sans}`
  ;(ctx as unknown as { letterSpacing: string }).letterSpacing = '5px'
  ctx.fillText(c.kind === 'ayah' ? '۞  АЯТ ДНЯ  ۞' : '۞  ХАДИС ДНЯ  ۞', W / 2, y)
  ;(ctx as unknown as { letterSpacing: string }).letterSpacing = '0px'
  y += 40

  if (inLines.length) {
    ctx.fillStyle = text2; ctx.font = `600 32px ${sans}`
    y += 24
    for (const l of inLines) { y += 48; ctx.fillText(l, W / 2, y - 12) }
  }
  if (arLines.length) {
    ctx.fillStyle = text; ctx.font = `${arSize}px '${af}'`; ctx.direction = 'rtl'
    y += 24
    for (const l of arLines) { y += arLH; ctx.fillText(l, W / 2, y - 36) }
    ctx.direction = 'ltr'
  }
  ctx.fillStyle = text; ctx.font = `${c.kind === 'ayah' ? 600 : 700} ${trSize}px ${sans}`
  y += 20
  for (const l of trLines) { y += trLH; ctx.fillText(l, W / 2, y - 12) }

  y += 56
  ctx.fillStyle = accent; ctx.font = `800 30px ${sans}`
  ctx.fillText(c.ref, W / 2, y)

  ctx.fillStyle = text2; ctx.globalAlpha = 0.6; ctx.font = `700 24px ${sans}`
  ;(ctx as unknown as { letterSpacing: string }).letterSpacing = '4px'
  ctx.fillText('КОРАН И СУННА', W / 2, H - 78)
  ctx.globalAlpha = 1

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'))
}

/** Отправить картинку: системное меню «Поделиться» (с файлом), иначе скачать */
export async function shareCardImage(c: ShareCard, caption: string, styleIdx = 0) {
  const blob = await renderShareCard(c, styleIdx)
  const file = new File([blob], c.kind === 'ayah' ? 'ayah-dnya.png' : 'hadis-dnya.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: caption }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = file.name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
