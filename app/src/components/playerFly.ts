// Полёт плеера в кружок и обратно (components/MiniPlayer.tsx).
// Свернуть: кнопки узкого/большого плеера во время полёта сходятся и прячутся в центральную кнопку «пуск», а сама она
// вместе с окном уезжает в угол и становится кружком. Развернуть — то же в обратную сторону: кружок едет на место кнопки
// «пуск», и из неё по бокам выходят остальные кнопки.
// Как сделано: на время полёта настоящий плеер спрятан, а летит его копия («призрак») — окно-подложка, которое
// сжимается/растёт, и внутри неподвижная раскладка развёрнутого вида, где каждая кнопка двигается сама.
// Всё считается скриптом в одном кадре — окно и кнопки не расходятся.

/** Кривая плавности cubic-bezier(x1, y1, x2, y2): по доле времени (0…1) возвращает долю пути */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const X = (t: number) => ((ax * t + bx) * t + cx) * t
  const Y = (t: number) => ((ay * t + by) * t + cy) * t
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-4) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d }
    return Y(Math.min(1, Math.max(0, t)))
  }
}
export const ease = bezier(0.22, 1, 0.36, 1)
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const clamp = (v: number) => Math.min(1, Math.max(0, v))
const fast = bezier(0.4, 0, 0.2, 1) // плавный разгон и торможение
const soft = bezier(0.6, 0, 0.3, 1) // разгон дольше — вместе с fast даёт мягкую дугу к углу
const inOut = bezier(0.5, 0, 0.3, 1)
const spring = bezier(0.34, 1.4, 0.64, 1) // с лёгким «перелётом» — кнопка выпрыгивает и чуть пружинит

interface Item { n: HTMLElement; cx: number; cy: number; h: number; text: boolean; i: number }

/**
 * Запустить полёт. el — настоящий плеер (уже в новом виде и спрятан), from/to — его место до и после,
 * spreadCls — классы развёрнутого вида (узкий или большой), toDot — сворачиваем в кружок.
 * Возвращает функцию «прервать» (если вид сменится снова посреди полёта).
 */
export function flyDot(el: HTMLElement, from: DOMRect, to: DOMRect, spreadCls: string, toDot: boolean, onDone: () => void): () => void {
  const S = toDot ? from : to // место развёрнутого вида
  const D = toDot ? to : from // место кружка

  // окно-подложка
  const win = document.createElement('div')
  const ws = win.style
  ws.cssText = 'position:fixed;z-index:21;overflow:hidden;pointer-events:none;border-radius:22px;background:var(--glass);box-shadow:0 10px 28px rgba(0,0,0,.18);will-change:left,top,width,height;contain:layout paint'
  // внутри — копия развёрнутого плеера, стоит на экране неподвижно (двигаются только кнопки)
  const inner = el.cloneNode(true) as HTMLElement
  inner.className = spreadCls.split(' ').filter((c) => !['mp-circle', 'mp-on', 'mp-dock-card', 'mp-enter', 'mp-reveal', 'mp-crt'].includes(c)).join(' ')
  inner.removeAttribute('style')
  inner.style.cssText = `position:absolute;left:0;top:0;right:auto;bottom:auto;margin:0;max-width:none;width:${S.width}px;height:${S.height}px;background:transparent;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;transition:none;animation:none;transform:none;visibility:visible;opacity:1`
  inner.querySelectorAll<HTMLElement>('*').forEach((n) => { n.style.transition = 'none'; n.style.transform = ''; n.style.removeProperty('width') })
  inner.querySelector<HTMLElement>('.mp-dot')?.remove()
  win.appendChild(inner)
  const place = (r: { left: number; top: number; width: number; height: number }) => {
    ws.left = r.left + 'px'; ws.top = r.top + 'px'; ws.width = r.width + 'px'; ws.height = r.height + 'px'
    inner.style.left = S.left - r.left + 'px'; inner.style.top = S.top - r.top + 'px'
  }
  place(S)
  document.body.appendChild(win)

  // замер кнопок в развёрнутом виде (копия стоит ровно на месте S)
  const main = inner.querySelector<HTMLElement>('[data-f=main]')
  const mr = main?.getBoundingClientRect()
  const M = mr ? { cx: mr.left + mr.width / 2, cy: mr.top + mr.height / 2, w: mr.width } : { cx: S.left + S.width / 2, cy: S.top + S.height / 2, w: 44 }
  const Dc = { cx: D.left + D.width / 2, cy: D.top + D.height / 2 }
  if (main) { main.style.position = 'relative'; main.style.zIndex = '3' } // остальные кнопки уходят ПОД неё
  const items: Item[] = []
  inner.querySelectorAll<HTMLElement>('[data-f]').forEach((n) => {
    if (n === main) return
    const b = n.getBoundingClientRect()
    if (!b.width) return
    items.push({ n, cx: b.left + b.width / 2, cy: b.top + b.height / 2, h: b.width / 2, text: false, i: 0 })
  })
  for (const sel of ['.mp-info', '.mp-bot']) {
    const n = inner.querySelector<HTMLElement>(sel)
    if (!n || getComputedStyle(n).position === 'absolute') continue // в узком виде надпись и нижний ряд спрятаны
    const b = n.getBoundingClientRect()
    items.push({ n, cx: b.left + b.width / 2, cy: b.top + b.height / 2, h: 0, text: true, i: 0 })
  }
  // порядок: от ближних к центральной кнопке
  const btns = items.filter((it) => !it.text).sort((a, b) => Math.hypot(a.cx - M.cx, a.cy - M.cy) - Math.hypot(b.cx - M.cx, b.cy - M.cy))
  btns.forEach((it, i) => { it.i = i })
  const nb = btns.length

  const frame = (t: number) => {
    // окно и центральная кнопка: по горизонтали и вертикали — разные кривые, путь к углу идёт мягкой дугой
    const px = toDot ? fast(t) : soft(t), py = toDot ? soft(t) : fast(t)
    place({ left: lerp(from.left, to.left, px), top: lerp(from.top, to.top, py), width: lerp(from.width, to.width, px), height: lerp(from.height, to.height, py) })
    // где сейчас «пуск» (в развёрнутом виде он в M, в кружке — в Dc)
    const sx = toDot ? px : 1 - px, sy = toDot ? py : 1 - py // 0 — на своём месте, 1 — в кружке
    const mx = lerp(M.cx, Dc.cx, sx), my = lerp(M.cy, Dc.cy, sy)
    if (main) {
      const sm = toDot ? ease(t) : 1 - ease(t)
      main.style.transform = `translate(${mx - M.cx}px, ${my - M.cy}px) scale(${lerp(1, D.width / M.w, sm)})`
    }
    for (const it of items) {
      // c — насколько кнопка ушла в «пуск»: 0 — на своём месте, 1 — спряталась в нём
      let c: number
      if (it.text) c = toDot ? clamp(t / 0.3) : 1 - ease(clamp((t - 0.45) / 0.45))
      // сходятся быстрее, чем сжимается окно, — иначе край окна «срезал» бы отставшие кнопки; дальние трогаются чуть раньше
      else if (toDot) c = inOut(clamp((t - 0.03 * (nb - 1 - it.i)) / 0.48))
      else c = 1 - spring(clamp((t - 0.14 - 0.06 * it.i) / 0.5)) // выходят по очереди, сначала ближние
      // кнопка не должна выходить за край окна (его срезало бы): если окно ещё не доросло — держим её ближе к «пуску»
      if (!it.text) {
        const wl = parseFloat(ws.left), wt = parseFloat(ws.top), wr = wl + parseFloat(ws.width), wb = wt + parseFloat(ws.height)
        const need = (p: number, m: number, lo: number, hi: number) => p < lo && m > p ? (lo - p) / (m - p) : p > hi && m < p ? (p - hi) / (p - m) : 0
        c = Math.max(c, Math.min(1, need(it.cx, mx, wl + it.h, wr - it.h)), Math.min(1, need(it.cy, my, wt + it.h, wb - it.h)))
      }
      const dx = (mx - it.cx) * c, dy = (my - it.cy) * c
      it.n.style.transform = it.text ? `translate(${dx * 0.4}px, ${dy * 0.4}px) scale(${lerp(1, 0.85, Math.max(0, c))})` : `translate(${dx}px, ${dy}px) scale(${lerp(1, 0.25, c)})`
      it.n.style.opacity = String(it.text ? 1 - clamp(c) : 1 - clamp((c - 0.55) / 0.45))
    }
  }

  const DUR = toDot ? 540 : 620
  let raf = 0, over = false
  const finish = () => {
    if (over) return
    over = true
    cancelAnimationFrame(raf)
    clearTimeout(safety)
    win.remove()
    onDone()
  }
  frame(0)
  const t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / DUR)
    frame(k)
    if (k >= 1) return finish()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  const safety = setTimeout(finish, DUR + 200) // страховка: если кадры не идут (вкладка в фоне), плеер всё равно встанет на место
  ;(win as unknown as { __frame: (t: number) => void }).__frame = frame // для проверки по кадрам
  return finish
}
