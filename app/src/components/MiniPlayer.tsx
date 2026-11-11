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
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches
/** Положения кнопок до смены вида плеера — отсюда они плавно «переезжают» на новые места (приём FLIP) */
interface Snap { root: DOMRect; items: Record<string, DOMRect> }

/** Мини-плеер: виден везде, пока что-то звучит. Скорость и таймер сна — прямо в нём, остальное — в шестерёнке. */
export function MiniPlayer() {
  const p = usePlayer()
  const meta = useQuranMeta()
  const st = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const [gear, setGear] = useState(false)
  const [speed, setSpeed] = useState(false)
  const [mini, setMini] = useState(false)
  const [enter, setEnter] = useState(false) // плеер только что появился — мягко выезжает снизу
  const [, tick] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const snap = useRef<Snap | null>(null)
  const closing = useRef(false)
  const wasHidden = useRef(true)
  // над нижним меню — только на экранах, где оно есть; на остальных (главная) плеер прижат к низу
  const [hasTab, setHasTab] = useState(false)
  // в чтении плеер живёт внутри экрана чтения: тогда окна (меню, аят) закрывают его, а не наоборот
  const [host, setHost] = useState<Element | null>(null)
  const inRead = loc.pathname.startsWith('/read/')
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
    const look = () => setHasTab(!!document.querySelector('.tabbar'))
    look()
    const ts = [60, 300, 900].map((ms) => setTimeout(look, ms))
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

  // Свернули/развернули плеер: кнопки не пересоздаются, а плавно переезжают на новые места, окно меняет высоту,
  // надписи и нижний ряд проявляются/гаснут (в CSS)
  useLayoutEffect(() => {
    const before = snap.current
    snap.current = null
    const el = rootRef.current
    if (!before || !el || calm()) return
    const after = el.getBoundingClientRect()
    el.querySelectorAll<HTMLElement>('[data-f]').forEach((n) => {
      const o = before.items[n.dataset.f!]
      if (!o) return
      const r = n.getBoundingClientRect()
      // координаты — от верха самого плеера (его верх и высоту двигаем отдельно)
      const dx = (o.left - before.root.left) - (r.left - after.left)
      const dy = (o.top - before.root.top) - (r.top - after.top)
      const sc = r.width ? o.width / r.width : 1
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sc - 1) < 0.01) return
      n.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${sc})`, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: 480, easing: SPRING })
    })
    if (Math.abs(before.root.height - after.height) > 1) {
      el.style.overflow = 'hidden' // пока меняется высота, всё лишнее обрезается
      const a = el.animate([{ height: before.root.height + 'px' }, { height: after.height + 'px' }], { duration: 480, easing: SPRING })
      a.onfinish = a.oncancel = () => { el.style.overflow = '' }
    }
  }, [mini])

  // Плеер стоит внизу — то, что у экрана внизу (большая кнопка-счётчик в азкарах), поднимается над ним и плавно опускается,
  // когда плеер закрыли. Расстояние от низа окна до верха плеера кладём в --mp-clear (пересчитывается, пока плеер меняет размер)
  useEffect(() => {
    const root = document.documentElement
    const el = rootRef.current
    if (hidden || !el || hasTab) { root.style.setProperty('--mp-clear', '0px'); return }
    const apply = () => { if (!closing.current) root.style.setProperty('--mp-clear', Math.max(0, innerHeight - el.getBoundingClientRect().top + 10) + 'px') }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    addEventListener('resize', apply)
    return () => { ro.disconnect(); removeEventListener('resize', apply); root.style.setProperty('--mp-clear', '0px') }
  }, [hidden, hasTab, mini, host])
  if (hidden) return gear ? <PlayerSettings onClose={() => setGear(false)} /> : null
  const [s, a] = p.current!.split(':').map(Number)
  const sr = meta?.surahs[s - 1]
  const playing = p.status === 'playing' || p.status === 'loading'
  const inReader = loc.pathname.startsWith('/read/')
  const sl = p.sleep
  const left = sl?.mode === 'time' ? Math.max(1, Math.ceil((sl.until - Date.now()) / 60000)) : 0

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
  // Закрытие — как выключение старого телевизора: экран схлопывается в яркую линию, затем в точку
  const closePlayer = () => {
    haptic.tap()
    const el = rootRef.current
    if (!el || calm() || closing.current) return p.stop()
    closing.current = true
    document.documentElement.style.setProperty('--mp-clear', '0px') // то, что стояло над плеером, плавно опускается
    const a = el.animate([
      { transform: 'scale(1, 1)', filter: 'brightness(1)', opacity: 1 },
      { transform: 'scale(1, .03)', filter: 'brightness(2.4)', opacity: 1, offset: 0.55 },
      { transform: 'scale(.02, .03)', filter: 'brightness(4)', opacity: 1, offset: 0.88 },
      { transform: 'scale(0, 0)', filter: 'brightness(4)', opacity: 0 },
    ], { duration: 420, easing: 'cubic-bezier(.55, .1, .75, .5)', fill: 'forwards' })
    a.onfinish = () => { closing.current = false; p.stop() }
  }
  const closeBtn = <button data-f="close" className="mp-btn mp-x mp-close" onClick={closePlayer} aria-label="Закрыть плеер"><Icon id="close" /></button>
  // запоминаем, где стояли кнопки, затем меняем вид — useLayoutEffect выше довезёт их на новые места
  const fold = (v: boolean) => {
    haptic.tap()
    const el = rootRef.current
    if (el) {
      const items: Record<string, DOMRect> = {}
      el.querySelectorAll<HTMLElement>('[data-f]').forEach((n) => { items[n.dataset.f!] = n.getBoundingClientRect() })
      snap.current = { root: el.getBoundingClientRect(), items }
    }
    setMini(v)
  }

  const place = (node: ReactNode) => (inRead && host ? createPortal(node, host) : node)

  const cls = 'miniplayer glass' + (mini ? ' mp-small' : '') + (inReader ? ' in-reader' : hasTab ? ' has-tab' : '') + (enter ? ' mp-enter' : '')
  // Один и тот же набор элементов и в большом, и в свёрнутом виде — положение меняет CSS, а FLIP (выше) плавно перевозит кнопки
  return place(
    <>
      <div ref={rootRef} className={cls}>
        <div className="mp-top">
          <button className="mp-info" tabIndex={mini ? -1 : 0} onClick={() => { haptic.tap(); nav(`/read/${s}?a=${a}`) }}>
            <b>{sr?.name ?? `Сура ${s}`}</b>
            <span>Аят {a} из {sr?.ayahs ?? ''}{sl ? ` · сон ${sl.mode === 'time' ? `${left} мин` : `${sl.left} ${sl.left === 1 ? 'сура' : 'суры'}`}` : ''}</span>
          </button>
          <button data-f="fold" className="mp-btn mp-x mp-fold" onClick={() => fold(!mini)} aria-label={mini ? 'Развернуть плеер' : 'Свернуть плеер'}><Icon id={mini ? 'up' : 'down'} /></button>
          {closeBtn}
        </div>
        <div className="mp-mid">
          {prevS}{prevA}{main}{nextA}{nextS}
        </div>
        {!p.memo && (
          <div className="mp-bot" aria-hidden={mini}>
            <div className="mp-rate">
              <button className="mp-chip" tabIndex={mini ? -1 : 0} onClick={() => setSpeed(!speed)} aria-label="Скорость">{fmtRate(st.plRate)}</button>
              {speed && !mini && (
                <>
                  {createPortal(<div className="mp-away" onClick={() => setSpeed(false)} />, document.body)}
                  <div className="mp-pop glass">
                    {RATES.map((r) => <button key={r} className={r === st.plRate ? 'on' : ''} onClick={() => setRate(r)}>{fmtRate(r)}</button>)}
                  </div>
                </>
              )}
            </div>
            <button className={'mp-btn mp-x mp-sleep' + (sl ? ' on' : '')} tabIndex={mini ? -1 : 0} onClick={toggleSleep} aria-label="Таймер сна"><Icon id="moon" /></button>
            <button className="mp-btn mp-x" tabIndex={mini ? -1 : 0} onClick={() => { haptic.tap(); setGear(true) }} aria-label="Настройки плеера"><Icon id="gear" /></button>
          </div>
        )}
      </div>
      {gear && <PlayerSettings onClose={() => setGear(false)} />}
    </>
  )
}
