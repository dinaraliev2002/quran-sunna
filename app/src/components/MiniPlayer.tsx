import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '../lib/telegram'
import { listenSurah } from '../lib/listen'
import { refreshRate, usePlayer } from '../store/player'
import { useStore } from '../store/settings'
import { Icon } from './Icon'
import { PlayerSettings } from './PlayerSettings'
import { useQuranMeta } from '../hooks/useQuranMeta'

const RATES = [0.75, 1, 1.25, 1.5]
const fmtRate = (r: number) => String(r).replace('.', ',') + '×'
const SPRING = 'cubic-bezier(.22, 1, .36, 1)'
/** Открыто конкретное дуа (карточки азкара, внизу большой счётчик): только здесь плеер сам превращается в кружок */
const DUA = /^\/azkar\/ch\//

/** Положения кнопок до смены вида — отсюда они плавно «переезжают» на новые места (приём FLIP) */
interface Snap { root: DOMRect; items: Record<string, DOMRect> }
type View = 'full' | 'bar' | 'dot'

/**
 * Плеер: виден везде, пока что-то звучит. Три вида:
 *  • большой — название, управление, скорость · сон · настройки;
 *  • узкий — одна строка: развернуть, сура/аят назад-вперёд, пуск, закрыть (человек сворачивает его сам);
 *  • кружок — только в открытом дуа: пуск/пауза одним нажатием, смахнуть вправо — закрыть, стрелка сверху — развернуть.
 * Между видами плеер плавно меняет размер: при большой ⇄ узкий кнопки «переезжают» и совмещаются, при кружке окно сжимается в угол.
 */
export function MiniPlayer() {
  const p = usePlayer()
  const meta = useQuranMeta()
  const st = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const [gear, setGear] = useState(false)
  const [speed, setSpeed] = useState(false)
  const [mini, setMini] = useState(false) // человек свернул плеер в узкую строку
  const [pinFull, setPinFull] = useState(false) // в дуа человек сам развернул плеер из кружка — не сворачиваем, пока не уйдёт с экрана
  const [enter, setEnter] = useState(false) // плеер только что появился — мягко выезжает снизу
  const [, tick] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLButtonElement>(null)
  const snap = useRef<Snap | null>(null)
  const closing = useRef(false)
  const wasHidden = useRef(true)
  const prev = useRef<{ view: View; rect: DOMRect; el: Element } | null>(null)
  // над нижним меню — только на экранах, где оно есть; на остальных (главная) плеер прижат к низу
  const [hasTab, setHasTab] = useState(false)
  // в чтении плеер живёт внутри экрана чтения: тогда окна (меню, аят) закрывают его, а не наоборот
  const [host, setHost] = useState<Element | null>(null)
  const inRead = loc.pathname.startsWith('/read/')
  const view: View = DUA.test(loc.pathname) && !pinFull ? 'dot' : mini ? 'bar' : 'full'
  useEffect(() => { setPinFull(false) }, [loc.pathname])
  useEffect(() => {
    setHost(null)
    if (!inRead) return
    // экран чтения может пересоздать свой корневой элемент (после загрузки) — держим ссылку свежей
    const sync = () => setHost((cur) => { const el = document.querySelector('.reader'); return el && el !== cur ? el : cur })
    sync()
    const t = setInterval(sync, 200)
    return () => clearInterval(t)
  }, [inRead])
  useEffect(() => {
    // смотрим только на входящий экран: у уходящего (он ещё доли секунды на месте) нижнее меню может быть другим
    const look = () => setHasTab(!!document.querySelector('.pt-in .tabbar, .app > .tabbar, body > .tabbar'))
    const ts = [0, 60, 300, 900].map((ms) => setTimeout(look, ms))
    return () => ts.forEach(clearTimeout)
  }, [loc.pathname])
  useEffect(() => {
    if (p.sleep?.mode !== 'time') return
    const t = setInterval(() => tick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [p.sleep?.mode])
  const hidden = p.status === 'idle' || !p.current || (!!p.memo && loc.pathname.startsWith('/read/'))

  // плеер появился (был скрыт, стал виден) — выезжает снизу
  useEffect(() => {
    if (hidden) { wasHidden.current = true; return }
    if (!wasHidden.current) return
    wasHidden.current = false
    setEnter(true)
    const t = setTimeout(() => setEnter(false), 600)
    return () => clearTimeout(t)
  }, [hidden])

  // Смена вида: само окно плавно меняет размер и место (из прежнего положения — в новое), а при большой ⇄ узкий ещё и
  // кнопки переезжают на новые места. Прежнее положение берём из прошлой отрисовки — так работает и когда вид меняется
  // сам (открыли дуа), а не по нажатию.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) { prev.current = null; return }
    const rect = el.getBoundingClientRect()
    const before = prev.current
    prev.current = { view, rect, el }
    const flip = snap.current
    snap.current = null
    if (!before || before.el !== el || before.view === view) return
    if (flip && before.view !== 'dot' && view !== 'dot') {
      el.querySelectorAll<HTMLElement>('[data-f]').forEach((n) => {
        const o = flip.items[n.dataset.f!]
        if (!o) return
        const r = n.getBoundingClientRect()
        // координаты — от верха самого плеера (его размер и место двигаем отдельно, ниже)
        const dx = (o.left - flip.root.left) - (r.left - rect.left)
        const dy = (o.top - flip.root.top) - (r.top - rect.top)
        const sc = r.width ? o.width / r.width : 1
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sc - 1) < 0.01) return
        n.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${sc})`, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: 480, easing: SPRING })
      })
    }
    const geo = (r: DOMRect) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', right: 'auto', bottom: 'auto', margin: '0px', maxWidth: 'none' })
    el.style.overflow = 'hidden' // пока меняется размер, всё лишнее обрезается
    const a = el.animate([geo(before.rect), geo(rect)], { duration: 480, easing: SPRING })
    a.onfinish = a.oncancel = () => { el.style.overflow = '' }
  })

  // Большой/узкий плеер стоит внизу — то, что у экрана внизу (большая кнопка-счётчик), поднимается над ним и плавно
  // опускается, когда плеер закрыли или свернули в кружок. Расстояние от низа окна до верха плеера кладём в --mp-clear
  useEffect(() => {
    const root = document.documentElement
    const el = rootRef.current
    if (hidden || !el || hasTab || view === 'dot') { root.style.setProperty('--mp-clear', '0px'); return }
    const apply = () => { if (!closing.current) root.style.setProperty('--mp-clear', Math.max(0, innerHeight - el.getBoundingClientRect().top + 10) + 'px') }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    addEventListener('resize', apply)
    return () => { ro.disconnect(); removeEventListener('resize', apply); root.style.setProperty('--mp-clear', '0px') }
  }, [hidden, hasTab, view, host])

  // ----- кружок: нажатие — пуск/пауза, смахнуть вправо — закрыть -----
  // На телефоне — родные касания (touch): на iPhone они самые надёжные. Мышь и перо — через pointer-события.
  useEffect(() => {
    const btn = dotRef.current, el = rootRef.current
    if (!btn || !el || hidden || view !== 'dot') return
    let g: { x: number; y: number; t: number; moved: boolean; dx: number } | null = null
    const begin = (x: number, y: number) => { g = { x, y, t: performance.now(), moved: false, dx: 0 } }
    const move = (x: number, y: number, ev: Event) => {
      if (!g) return
      const dx = x - g.x, dy = y - g.y
      if (!g.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) g.moved = true
      if (!g.moved) return
      if (ev.cancelable) ev.preventDefault()
      g.dx = dx
      el.style.transition = 'none'
      el.style.transform = `translateX(${Math.max(-14, dx)}px)`
      el.style.opacity = String(Math.max(0.25, 1 - Math.max(0, dx) / 260))
    }
    const back = () => { el.style.transition = `transform .3s ${SPRING}, opacity .2s ease`; el.style.transform = ''; el.style.opacity = '' }
    const end = () => {
      const d = g
      g = null
      if (!d) return
      if (!d.moved) { haptic.tap(); return usePlayer.getState().toggle() } // обычное нажатие
      const v = d.dx / Math.max(1, performance.now() - d.t) // пикселей в мс
      if (d.dx > 60 || (d.dx > 30 && v > 0.4)) { // длинное смахивание, или короткое, но резкое
        // смахнули вправо — уезжает за край экрана, затем плеер закрывается
        haptic.tap()
        el.style.transition = 'transform .24s cubic-bezier(.5, 0, .9, .5), opacity .24s ease-in'
        el.style.transform = `translateX(${innerWidth}px)`
        el.style.opacity = '0'
        setTimeout(() => usePlayer.getState().stop(), 240)
      } else back()
    }
    const cancel = () => { if (g) { g = null; back() } }
    const ts = (e: TouchEvent) => { const t = e.touches[0]; begin(t.clientX, t.clientY) }
    const tm = (e: TouchEvent) => { const t = e.touches[0]; move(t.clientX, t.clientY, e) }
    const te = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); end() } // preventDefault — чтобы после касания не пришёл лишний «клик»
    const pd = (e: PointerEvent) => { if (e.pointerType === 'touch') return; btn.setPointerCapture(e.pointerId); begin(e.clientX, e.clientY) }
    const pm = (e: PointerEvent) => { if (e.pointerType !== 'touch') move(e.clientX, e.clientY, e) }
    const pu = (e: PointerEvent) => { if (e.pointerType !== 'touch') end() }
    btn.addEventListener('touchstart', ts, { passive: true })
    btn.addEventListener('touchmove', tm, { passive: false })
    btn.addEventListener('touchend', te, { passive: false })
    btn.addEventListener('touchcancel', cancel)
    btn.addEventListener('pointerdown', pd)
    btn.addEventListener('pointermove', pm)
    btn.addEventListener('pointerup', pu)
    btn.addEventListener('pointercancel', cancel)
    return () => {
      btn.removeEventListener('touchstart', ts); btn.removeEventListener('touchmove', tm); btn.removeEventListener('touchend', te); btn.removeEventListener('touchcancel', cancel)
      btn.removeEventListener('pointerdown', pd); btn.removeEventListener('pointermove', pm); btn.removeEventListener('pointerup', pu); btn.removeEventListener('pointercancel', cancel)
    }
  }, [hidden, view])

  if (hidden) return gear ? <PlayerSettings onClose={() => setGear(false)} /> : null
  const [s, a] = p.current!.split(':').map(Number)
  const sr = meta?.surahs[s - 1]
  const playing = p.status === 'playing' || p.status === 'loading'
  const inReader = loc.pathname.startsWith('/read/')
  const sl = p.sleep
  const left = sl?.mode === 'time' ? Math.max(1, Math.ceil((sl.until - Date.now()) / 60000)) : 0
  const small = view !== 'full' // в узком плеере и кружке скорость, сон и настройки спрятаны

  const toggleSleep = () => {
    haptic.tap()
    if (sl) return p.setSleep(null)
    p.setSleep(st.plSleepMode === 'time' ? { mode: 'time', until: Date.now() + st.plSleepMin * 60000 } : { mode: 'suras', left: st.plSleepSuras })
  }
  const setRate = (r: number) => {
    haptic.tick()
    setSpeed(false)
    st.set({ plRate: r }) // настройки плеера подхватываются сразу (lib/listen.ts), затем применяем к звучащей записи
    refreshRate()
  }

  const goSurah = (n: number) => { haptic.tap(); if (meta) listenSurah(meta.surahs, n, 1) }
  const total = meta?.surahs.length ?? 114
  const surahBtns = !p.memo
  const prevS = surahBtns && <button data-f="prevS" className="mp-btn mp-side mp-surah" disabled={s <= 1} onClick={() => goSurah(s - 1)} aria-label="Предыдущая сура"><Icon id="skip" className="icon mp-next" /></button>
  const nextS = surahBtns && <button data-f="nextS" className="mp-btn mp-side mp-surah" disabled={s >= total} onClick={() => goSurah(s + 1)} aria-label="Следующая сура"><Icon id="skip" /></button>
  const prevA = <button data-f="prevA" className="mp-btn mp-side" disabled={p.index <= 0} onClick={() => { haptic.tap(); p.play(p.queue, p.index - 1, p.memo) }} aria-label="Предыдущий аят"><Icon id="back" /></button>
  const nextA = <button data-f="nextA" className="mp-btn mp-side" disabled={p.index >= p.queue.length - 1} onClick={() => { haptic.tap(); p.play(p.queue, p.index + 1, p.memo) }} aria-label="Следующий аят"><Icon id="back" className="icon mp-next" /></button>
  const main = <button data-f="main" className="mp-btn mp-main" onClick={() => { haptic.tap(); p.toggle() }} aria-label={playing ? 'Пауза' : 'Слушать'}><Icon id={playing ? 'pause' : 'play'} /></button>

  // Закрытие крестиком — как выключение настоящего телевизора с электронно-лучевой трубкой:
  //  1) картинка на миг вспыхивает белым и схлопывается по высоте в яркую линию;
  //  2) линия стягивается по ширине в светящуюся точку;
  //  3) точка вспыхивает и гаснет. Всё вместе ~0,3 секунды.
  const closePlayer = () => {
    haptic.tap()
    const el = rootRef.current
    if (!el || closing.current) return p.stop()
    closing.current = true
    document.documentElement.style.setProperty('--mp-clear', '0px') // то, что стояло над плеером, плавно опускается
    el.classList.add('mp-crt') // содержимое сразу гаснет, остаётся светящийся «экран»
    el.style.backdropFilter = 'none'
    el.style.setProperty('-webkit-backdrop-filter', 'none')
    el.style.overflow = 'hidden'
    const glow = '0 0 14px 3px rgba(255,255,255,.95), 0 0 46px 10px rgba(190,225,255,.55)'
    const an = el.animate([
      // в самом начале цвет, тень и скругление не заданы — берутся текущие, поэтому «вспышка» нарастает плавно из обычного вида
      { offset: 0, transform: 'scale(1, 1)', opacity: 1, easing: 'cubic-bezier(.7, 0, .9, .4)' },
      { offset: 0.38, transform: 'scale(1, .012)', backgroundColor: '#ffffff', boxShadow: glow, borderRadius: '3px', opacity: 1, easing: 'cubic-bezier(.6, 0, .85, .5)' },
      { offset: 0.8, transform: 'scale(.014, .012)', backgroundColor: '#ffffff', boxShadow: glow, borderRadius: '3px', opacity: 1, easing: 'ease-out' },
      { offset: 1, transform: 'scale(0, 0)', backgroundColor: '#ffffff', boxShadow: '0 0 30px 12px rgba(255,255,255,.9)', borderRadius: '3px', opacity: 0 },
    ], { duration: 300, fill: 'forwards' })
    an.onfinish = () => { closing.current = false; p.stop() }
  }
  const fold = () => {
    haptic.tap()
    const el = rootRef.current
    if (el) {
      const items: Record<string, DOMRect> = {}
      el.querySelectorAll<HTMLElement>('[data-f]').forEach((n) => { items[n.dataset.f!] = n.getBoundingClientRect() })
      snap.current = { root: el.getBoundingClientRect(), items }
    }
    setMini((v) => !v)
  }
  const expand = () => { haptic.tap(); setPinFull(true) } // из кружка — обратно в тот вид, который был (большой или узкий)

  const place = (node: ReactNode) => (inRead && host ? createPortal(node, host) : node)

  const cls = 'miniplayer glass' + (view === 'bar' ? ' mp-bar' : '') + (view === 'dot' ? ' mp-circle' : '') + (view === 'dot' && playing ? ' mp-on' : '') + (inReader ? ' in-reader' : hasTab ? ' has-tab' : '') + (enter ? ' mp-enter' : '')
  return place(
    <>
      <div ref={rootRef} className={cls}>
        {/* большой и узкий вид — одни и те же элементы: положение меняет CSS, а кнопки плавно переезжают (FLIP выше) */}
        <div className="mp-card" aria-hidden={view === 'dot'}>
          <div className="mp-top">
            <button className="mp-info" tabIndex={small ? -1 : 0} onClick={() => { haptic.tap(); nav(`/read/${s}?a=${a}`) }}>
              <b>{sr?.name ?? `Сура ${s}`}</b>
              <span>Аят {a} из {sr?.ayahs ?? ''}{sl ? ` · сон ${sl.mode === 'time' ? `${left} мин` : `${sl.left} ${sl.left === 1 ? 'сура' : 'суры'}`}` : ''}</span>
            </button>
            <button data-f="fold" className="mp-btn mp-x mp-fold" tabIndex={view === 'dot' ? -1 : 0} onClick={fold} aria-label={mini ? 'Развернуть плеер' : 'Свернуть плеер'}><Icon id={mini ? 'up' : 'down'} /></button>
            <button data-f="close" className="mp-btn mp-x mp-close" tabIndex={view === 'dot' ? -1 : 0} onClick={closePlayer} aria-label="Закрыть плеер"><Icon id="close" /></button>
          </div>
          <div className="mp-mid">
            {prevS}{prevA}{main}{nextA}{nextS}
          </div>
          {!p.memo && (
            <div className="mp-bot" aria-hidden={small}>
              <div className="mp-rate">
                <button className="mp-chip" tabIndex={small ? -1 : 0} onClick={() => setSpeed(!speed)} aria-label="Скорость">{fmtRate(st.plRate)}</button>
                {speed && !small && (
                  <>
                    {createPortal(<div className="mp-away" onClick={() => setSpeed(false)} />, document.body)}
                    <div className="mp-pop glass">
                      {RATES.map((r) => <button key={r} className={r === st.plRate ? 'on' : ''} onClick={() => setRate(r)}>{fmtRate(r)}</button>)}
                    </div>
                  </>
                )}
              </div>
              <button className={'mp-btn mp-x mp-sleep' + (sl ? ' on' : '')} tabIndex={small ? -1 : 0} onClick={toggleSleep} aria-label="Таймер сна"><Icon id="moon" /></button>
              <button className="mp-btn mp-x" tabIndex={small ? -1 : 0} onClick={() => { haptic.tap(); setGear(true) }} aria-label="Настройки плеера"><Icon id="gear" /></button>
            </div>
          )}
        </div>
        {/* кружок (в остальных видах скрыт) */}
        <div className="mp-dot" aria-hidden={view !== 'dot'}>
          <button ref={dotRef} className="mp-dot-btn" tabIndex={view === 'dot' ? 0 : -1}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.toggle() } }}
            aria-label={playing ? 'Пауза. Смахните вправо, чтобы закрыть' : 'Слушать. Смахните вправо, чтобы закрыть'}>
            <Icon id={playing ? 'pause' : 'play'} />
          </button>
          <button className="mp-dot-up" tabIndex={view === 'dot' ? 0 : -1} onClick={expand} aria-label="Развернуть плеер"><Icon id="up" /></button>
        </div>
      </div>
      {gear && <PlayerSettings onClose={() => setGear(false)} />}
    </>
  )
}
