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
import { ease, flyDot, lerp } from './playerFly'

const RATES = [0.75, 1, 1.25, 1.5]
const fmtRate = (r: number) => String(r).replace('.', ',') + '×'
const SPRING = 'cubic-bezier(.22, 1, .36, 1)'
/** Экраны, где внизу есть своя главная кнопка (карточки азкара — большой счётчик, карточка хадиса — зелёный переключатель):
 *  только здесь плеер бывает кружком (рядом с этой кнопкой) или большим — узкого вида там нет */
const DUA = /^\/azkar\/ch\//
const HADITH_CARD = /^\/hadith\/c\/[^/]+\/[^/]+$/ // карточка хадиса — тот же адрес, что у списка хадисов книги, но с ?i=…
const NAME_CARD = /^\/names\/\d+$/ // карточка имени Аллаха — внизу такой же зелёный переключатель

/** Экраны с нижним меню: над ним плеер стоит выше. Адрес известен сразу, поэтому плеер летит в нужное место без «доводки».
 *  Появился новый экран с нижним меню (<TabBar />) — добавить его адрес сюда */
const TAB_ROUTE = /^\/(quran|azkar|azkar\/cat\/[^/]+|downloads|hadith|hadith\/c\/[^/]+(\/g\/[^/]+|\/[^/]+)?|hadith\/t\/[^/]+|names|reminders|settings|notifications)$/

/** Положения кнопок до смены вида — отсюда они плавно «переезжают» на новые места (приём FLIP) */
interface Snap { root: DOMRect; items: Record<string, DOMRect> }
type View = 'full' | 'bar' | 'dot'

/**
 * Плеер: виден везде, пока что-то звучит. Три вида:
 *  • большой — название, управление, скорость · сон · настройки;
 *  • узкий — одна строка: развернуть, сура/аят назад-вперёд, пуск, закрыть (человек сворачивает его сам);
 *  • кружок — только в открытом дуа и карточках хадиса и имени Аллаха: пуск/пауза одним нажатием, смахнуть вправо — закрыть, стрелка сверху — развернуть.
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
  const prev = useRef<{ view: View; rect: DOMRect; el: Element; cls: string } | null>(null)
  const fly = useRef<(() => void) | null>(null) // идёт полёт в кружок/из кружка — «прервать»
  // в чтении плеер живёт внутри экрана чтения: тогда окна (меню, аят) закрывают его, а не наоборот
  const [host, setHost] = useState<Element | null>(null)
  const inRead = loc.pathname.startsWith('/read/')
  // над нижним меню — только на экранах, где оно есть; на остальных (главная) плеер прижат к низу
  // В карточке хадиса нижнего меню нет (его место занимает зелёный переключатель)
  const inCard = (HADITH_CARD.test(loc.pathname) && new URLSearchParams(loc.search).has('i')) || NAME_CARD.test(loc.pathname)
  const hasTab = TAB_ROUTE.test(loc.pathname) && !inCard
  // В открытом дуа и в карточке хадиса плеер бывает только большим или кружком; на остальных экранах — большим или узким
  const inDua = DUA.test(loc.pathname) || inCard
  const view: View = inDua ? (pinFull ? 'full' : 'dot') : mini ? 'bar' : 'full'
  useEffect(() => { setPinFull(false) }, [loc.pathname, inCard])
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
    const before = prev.current
    const changing = !!before && before.el === el && before.view !== view
    // Вид меняется — замеряем КОНЕЧНОЕ место плеера. У плеера есть плавное движение по высоте (когда внизу появляется/пропадает
    // меню): в этот момент оно только началось, и замер дал бы старую высоту — кружок летел бы вбок, а потом «доезжал» вниз.
    // Поэтому на время замера плавность выключаем: плеер сразу встаёт на новое место (его всё равно ведёт анимация ниже)
    if (changing) el.style.transition = 'none'
    if (changing) { fly.current?.(); fly.current = null } // прошлый полёт ещё шёл — сразу завершаем
    // в кружок или из кружка летит копия плеера, а сам он прячется до конца полёта; содержимое меняется сразу, без плавности
    if (changing && (view === 'dot' || before.view === 'dot')) {
      el.style.opacity = '0' // не visibility: у кружка в стилях своё «виден», он бы остался на экране
      el.querySelectorAll<HTMLElement>('.mp-card, .mp-dot').forEach((n) => { n.style.transition = 'none' })
    }
    const rect = el.getBoundingClientRect()
    if (changing) el.style.transition = ''
    prev.current = { view, rect, el, cls: el.className }
    const flip = snap.current
    snap.current = null
    if (!before || before.el !== el || before.view === view) return
    // Большой ⇄ узкий: окно плеера и кнопки двигаем ВМЕСТЕ, в одном и том же кадре (скриптом). Раньше окно ехало одним способом
    // (left/top/height), а кнопки другим (transform в видеокарте), и на телефоне они расходились на кадр-другой: кнопки «приседали».
    if (flip && before.view !== 'dot' && view !== 'dot') {
      const items: { n: HTMLElement; dx: number; dy: number; sc: number }[] = []
      el.querySelectorAll<HTMLElement>('[data-f]').forEach((n) => {
        const o = flip.items[n.dataset.f!]
        if (!o) return
        const r = n.getBoundingClientRect()
        // координаты — от верха самого плеера: окно и кнопки едут одновременно, поэтому на экране кнопка идёт по прямой из старого места в новое
        items.push({ n, dx: (o.left - flip.root.left) - (r.left - rect.left), dy: (o.top - flip.root.top) - (r.top - rect.top), sc: r.width ? o.width / r.width : 1 })
      })
      const from = before.rect, to = rect
      const set = (k: number) => {
        const css = el.style
        css.setProperty('left', lerp(from.left, to.left, k) + 'px')
        css.setProperty('top', lerp(from.top, to.top, k) + 'px')
        css.setProperty('width', lerp(from.width, to.width, k) + 'px')
        css.setProperty('height', lerp(from.height, to.height, k) + 'px')
        css.setProperty('right', 'auto'); css.setProperty('bottom', 'auto'); css.setProperty('margin', '0'); css.setProperty('max-width', 'none'); css.setProperty('overflow', 'hidden')
        for (const it of items) {
          it.n.style.transformOrigin = '0 0'
          it.n.style.transform = `translate(${it.dx * (1 - k)}px, ${it.dy * (1 - k)}px) scale(${1 + (it.sc - 1) * (1 - k)})`
        }
      }
      const done = () => {
        for (const prop of ['left', 'top', 'width', 'height', 'right', 'bottom', 'margin', 'max-width', 'overflow']) el.style.removeProperty(prop)
        for (const it of items) { it.n.style.transform = ''; it.n.style.transformOrigin = '' }
      }
      const DUR = 480, t0 = performance.now()
      set(0)
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / DUR)
        if (!el.isConnected) return
        if (k >= 1) return done()
        set(ease(k))
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      setTimeout(done, DUR + 120) // страховка: если кадры не идут (вкладка в фоне), плеер всё равно встанет на место
      return
    }
    // Кружок ⇄ узкий/большой: кнопки во время полёта сходятся в «пуск» (или выходят из него) — components/playerFly.ts
    const toDot = view === 'dot'
    fly.current = flyDot(el, before.rect, rect, toDot ? before.cls : el.className, toDot, () => {
      fly.current = null
      el.style.opacity = ''
      if (toDot) el.querySelector<HTMLElement>('.mp-dot-up')?.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.34, 1.4, .64, 1)' })
      // плавность содержимого возвращаем в следующем кадре, когда новый вид уже нарисован
      requestAnimationFrame(() => el.querySelectorAll<HTMLElement>('.mp-card, .mp-dot').forEach((n) => { n.style.transition = '' }))
    })
  })

  // Большой/узкий плеер стоит внизу — то, что у экрана внизу (большая кнопка-счётчик), поднимается над ним и плавно
  // опускается, когда плеер закрыли или свернули в кружок. Расстояние от низа окна до верха плеера кладём в --mp-clear
  useEffect(() => {
    const root = document.documentElement
    const el = rootRef.current
    const reset = () => { root.style.setProperty('--mp-clear', '0px'); root.style.setProperty('--mp-pad', '0px') }
    if (hidden || !el || view === 'dot') { reset(); return }
    // --mp-clear — для того, что стоит внизу экрана на месте плеера (счётчик); --mp-pad — нижний отступ прокручиваемых экранов,
    // чтобы последние пункты списка можно было поднять над плеером (иначе плеер их закрывает)
    const apply = () => {
      if (closing.current) return
      const d = Math.max(0, innerHeight - el.getBoundingClientRect().top)
      root.style.setProperty('--mp-clear', (hasTab ? 0 : d + 10) + 'px')
      root.style.setProperty('--mp-pad', d + 14 + 'px')
    }
    apply()
    const ro = new ResizeObserver(apply) // размер плеера меняется — пересчитываем
    ro.observe(el)
    addEventListener('resize', apply)
    // Плеер мог ещё плавно ехать (поднимается над нижним меню, меняет вид): положение без смены размера ResizeObserver не замечает,
    // а первый замер дал бы старую высоту. Поэтому пересчитываем, когда движение закончилось, и ещё несколько раз для верности
    el.addEventListener('transitionend', apply)
    el.addEventListener('animationend', apply)
    const timers = [120, 300, 520, 800].map((ms) => setTimeout(apply, ms))
    return () => { ro.disconnect(); removeEventListener('resize', apply); el.removeEventListener('transitionend', apply); el.removeEventListener('animationend', apply); timers.forEach(clearTimeout); reset() }
  }, [hidden, hasTab, view, host, loc.pathname])

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
      // Кружок у самого правого края: палец упирается в край экрана уже через 20–40 пикселей. Поэтому движение
      // кружка усиливаем — он уезжает заметно дальше пальца, и видно, что его «смахивают»
      const room = Math.max(24, innerWidth - g.x - 6) // сколько пальцу есть куда двигаться вправо
      const k = Math.min(1, Math.max(0, dx) / room) // доля пройденного пути (0…1)
      el.style.transition = 'none'
      el.style.transform = `translateX(${dx < 0 ? Math.max(-14, dx) : Math.round(k * (innerWidth - g.x + 20))}px)`
      el.style.opacity = String(Math.max(0.2, 1 - k * 0.8))
    }
    const back = () => { el.style.transition = `transform .3s ${SPRING}, opacity .2s ease`; el.style.transform = ''; el.style.opacity = '' }
    const end = () => {
      const d = g
      g = null
      if (!d) return
      if (!d.moved) { haptic.tap(); return usePlayer.getState().toggle() } // обычное нажатие
      const v = d.dx / Math.max(1, performance.now() - d.t) // пикселей в мс
      const room = Math.max(24, innerWidth - d.x - 6)
      // закрываем, если палец прошёл больше трети доступного пути до края, или быстрый «щелчок» хотя бы на 12 пикселей
      if (d.dx > room * 0.35 || (d.dx > 12 && v > 0.35)) {
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
    document.documentElement.style.setProperty('--mp-pad', '0px')
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
    if (inDua) setPinFull(false) // в дуа «свернуть» — только в кружок
    else setMini((v) => !v)
  }
  const expand = () => { haptic.tap(); setPinFull(true) } // из кружка — сразу в большой плеер

  const place = (node: ReactNode) => (inRead && host ? createPortal(node, host) : node)

  const cls = 'miniplayer glass' + (view === 'bar' ? ' mp-bar' : '') + (view === 'dot' ? ' mp-circle' : '') + (view === 'dot' && inCard ? ' mp-dock-card' : '') + (view === 'dot' && playing ? ' mp-on' : '') + (inReader ? ' in-reader' : hasTab ? ' has-tab' : '') + (enter ? ' mp-enter' : '')
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
            <button data-f="fold" className="mp-btn mp-x mp-fold" tabIndex={view === 'dot' ? -1 : 0} onClick={fold} aria-label={inDua ? 'Свернуть в кружок' : mini ? 'Развернуть плеер' : 'Свернуть плеер'}><Icon id={mini && !inDua ? 'up' : 'down'} /></button>
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
