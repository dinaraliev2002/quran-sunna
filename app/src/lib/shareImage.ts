// «Поделиться картинкой»: карточка «Аят дня» / «Хадис дня» рисуется на canvas в том же виде, что и на главной.
// Шрифты страниц мусхафа подключены через FontFace — canvas берёт их напрямую, поэтому html-to-image не нужен.

export interface ShareCard {
  kind: 'ayah' | 'hadith'
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

export async function renderShareCard(c: ShareCard): Promise<Blob> {
  const bg = css('--bg', '#F7F2E7')
  const surface = css('--surface', '#FFFFFF')
  const text = css('--text', '#1d2a24')
  const text2 = css('--text-2', '#6b756f')
  const gold = css('--gold', '#D9A441')
  const goldInk = css('--gold-ink', '#9A7424')
  const accent = c.kind === 'ayah' ? goldInk : css('--emerald-bright', '#13704B')
  const sans = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const inner = W - PAD * 2

  const meas = document.createElement('canvas').getContext('2d')!
  if (c.arabic && c.arabicFont) await document.fonts.load(`60px '${c.arabicFont}'`, c.arabic).catch(() => {})
  await document.fonts.ready

  // раскладка
  const arSize = 64, arLH = 124
  const trSize = c.kind === 'ayah' ? 38 : 40, trLH = trSize * 1.55
  const arLines: string[] = []
  if (c.arabic && c.arabicFont) {
    meas.font = `${arSize}px '${c.arabicFont}'`
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
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // карточка
  const m = 40, r = 56
  ctx.beginPath(); ctx.roundRect(m, m, W - m * 2, H - m * 2, r)
  const grad = ctx.createRadialGradient(W / 2, m, 0, W / 2, m, W * 0.7)
  grad.addColorStop(0, 'rgba(217,164,65,.20)'); grad.addColorStop(0.6, 'rgba(217,164,65,0)')
  ctx.fillStyle = surface; ctx.fill(); ctx.fillStyle = grad; ctx.fill()
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
    ctx.fillStyle = text; ctx.font = `${arSize}px '${c.arabicFont}'`; ctx.direction = 'rtl'
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
export async function shareCardImage(c: ShareCard, caption: string) {
  const blob = await renderShareCard(c)
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
