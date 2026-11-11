import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE, type ReactNode } from 'react'
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
/** Экраны чтения азкара (внизу большой счётчик): плеер там сам сворачивается в кружок. Страницы-списки (с нижним меню) остаются с карточкой */
const READING = /^\/azkar\/ch\//

/**
 * Плеер: виден везде, пока что-то звучит. Два вида:
 *  • карточка — название, управление, скорость · сон · настройки;
 *  • кружок — одна кнопка «пуск/пауза» в углу. Нажатие — пуск/пауза, смахнуть вправо — закрыть (как видео в YouTube),
 *    значок-стрелка сверху — снова развернуть.
 * Карточка плавно превращается в кружок и обратно; на экранах чтения (READING) сворачивается сама.
 */
export function MiniPlayer() {
  const p = usePlayer()
  const meta = useQuranMeta()
  const st = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const [gear, setGear] = useState(false)
  const [speed, setSpeed] = useState(false)
  const [mini, setMini] = useState(false) // человек свернул плеер в кружок
  const [pinFull, setPinFull] = useState(false) // на экране чтения человек сам развернул плеер — не сворачиваем, пока не уйдёт с экрана
  const [enter, setEnter] = useState(false) // плеер только что появился — мягко выезжает снизу
  const [, tick] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const wasHidden = useRef(true)
  const prev = useRef<{ small: boolean; rect: DOMRect; el: Element } | null>(null)
  // над нижним меню — только на экранах, где оно есть; на остальных (главная) плеер прижат к низу
  const [hasTab, setHasTab] = useState(false)
  // в чтении плеер живёт внутри экрана чтения: тогда окна (меню, аят) закрывают его, а не наоборот
  const [host, setHost] = useState<Element | null>(null)
  const inRead = loc.pathname.startsWith('/read/')
  const small = mini || (READING.test(loc.pathname) && !pinFull)
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
    look()
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

  // Карточка ⇄ кружок: само окно плеера плавно меняет размер и положение (из старого места и размера — в новые),
  // а содержимое переплавляется (в CSS). Старое положение берём из прошлой отрисовки — так работает и когда плеер
  // сворачивается сам, при переходе на другой экран.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) { prev.current = null; return }
    const rect = el.getBoundingClientRect()
    const before = prev.current
    prev.current = { small, rect, el }
    if (!before || before.el !== el || before.small === small) return
    const geo = (r: DOMRect, radius: number) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', right: 'auto', bottom: 'auto', margin: '0px', maxWidth: 'none', borderRadius: radius + 'px' })
    el.style.overflow = 'hidden' // пока меняется размер, всё лишнее обрезается
    const a = el.animate([geo(before.rect, before.small ? 22 : 22), geo(rect, small ? 22 : 22)], { duration: 480, easing: SPRING })
    a.onfinish = a.oncancel = () => { el.style.overflow = '' }
  }) // без списка зависимостей: после каждой отрисовки запоминаем, где стоит плеер, — это «откуда» для следующего превращения

  // Плеер-карточка стоит внизу — то, что у экрана внизу (большая кнопка-счётчик в азкарах), поднимается над ним и плавно
  // опускается, когда плеер закрыли или свернули. Расстояние от низа окна до верха плеера кладём в --mp-clear
  useEffect(() => {
    const root = document.documentElement
    const el = rootRef.current
    if (hidden || !el || hasTab || small) { root.style.setProperty('--mp-clear', '0px'); return }
    const apply = () => { if (!closing.current) root.style.setProperty('--mp-clear', Math.max(0, innerHeight - el.getBoundingClientRect().top + 10) + 'px') }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    addEventListener('resize', apply)
    return () => { ro.disconnect(); removeEventListener('resize', apply); root.style.setProperty('--mp-clear', '0px') }
  }, [hidden, hasTab, small, host])

  // ----- кружок: нажатие — пуск/пауза, смахнуть вправо — закрыть -----
  const drag = useRef<{ x: number; y: number; t: number; moved: boolean; dx: number } | null>(null)
  const dotDown = (e: RPE) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false, dx: 0 } }
  const dotMove = (e: RPE) => {
    const d = drag.current, el = rootRef.current
    if (!d || !el) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) d.moved = true
    if (!d.moved) return
    d.dx = dx
    el.style.transition = 'none'
    el.style.transform = `translateX(${Math.max(-14, dx)}px)`
    el.style.opacity = String(Math.max(0.25, 1 - Math.max(0, dx) / 260))
  }
  const dotUp = (e: RPE) => {
    const d = drag.current, el = rootRef.current
    drag.current = null
    if (!d || !el) return
    if (!d.moved) { haptic.tap(); return p.toggle() } // обычное нажатие
    const speedPx = d.dx / Math.max(1, e.timeStamp - d.t) // пикселей в мс
    if (d.dx > 70 || speedPx > 0.5) {
      // смахнули вправо — уезжает за край экрана, затем плеер закрывается
      haptic.tap()
      el.style.transition = 'transform .24s cubic-bezier(.5, 0, .9, .5), opacity .24s ease-in'
      el.style.transform = `translateX(${innerWidth}px)`
      el.style.opacity = '0'
      setTimeout(() => p.stop(), 240)
    } else {
      el.style.transition = `transform .3s ${SPRING}, opacity .2s ease`
      el.style.transform = ''
      el.style.opacity = ''
    }
  }
  const dotCancel = () => {
    drag.current = null
    const el = rootRef.current
    if (el) { el.style.transition = `transform .3s ${SPRING}, opacity .2s ease`; el.style.transform = ''; el.style.opacity = '' }
  }

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
  const prevS = surahBtns && <button className="mp-btn mp-side mp-surah" disabled={s <= 1} onClick={() => goSurah(s - 1)} aria-label="Предыдущая сура"><Icon id="skip" className="icon mp-next" /></button>
  const nextS = surahBtns && <button className="mp-btn mp-side mp-surah" disabled={s >= total} onClick={() => goSurah(s + 1)} aria-label="Следующая сура"><Icon id="skip" /></button>
  const prevA = <button className="mp-btn mp-side" disabled={p.index <= 0} onClick={() => { haptic.tap(); p.play(p.queue, p.index - 1, p.memo) }} aria-label="Предыдущий аят"><Icon id="back" /></button>
  const nextA = <button className="mp-btn mp-side" disabled={p.index >= p.queue.length - 1} onClick={() => { haptic.tap(); p.play(p.queue, p.index + 1, p.memo) }} aria-label="Следующий аят"><Icon id="back" className="icon mp-next" /></button>
  const main = <button className="mp-btn mp-main" onClick={() => { haptic.tap(); p.toggle() }} aria-label={playing ? 'Пауза' : 'Слушать'}><Icon id={playing ? 'pause' : 'play'} /></button>

  // Закрытие крестиком — как выключение старого телевизора: экран схлопывается в яркую линию, затем в точку
  const closePlayer = () => {
    haptic.tap()
    const el = rootRef.current
    if (!el || closing.current) return p.stop()
    closing.current = true
    document.documentElement.style.setProperty('--mp-clear', '0px') // то, что стояло над плеером, плавно опускается
    const an = el.animate([
      { transform: 'scale(1, 1)', filter: 'brightness(1)', opacity: 1 },
      { transform: 'scale(1, .03)', filter: 'brightness(2.4)', opacity: 1, offset: 0.55 },
      { transform: 'scale(.02, .03)', filter: 'brightness(4)', opacity: 1, offset: 0.88 },
      { transform: 'scale(0, 0)', filter: 'brightness(4)', opacity: 0 },
    ], { duration: 420, easing: 'cubic-bezier(.55, .1, .75, .5)', fill: 'forwards' })
    an.onfinish = () => { closing.current = false; p.stop() }
  }
  const expand = () => { haptic.tap(); setMini(false); setPinFull(true) }

  const place = (node: ReactNode) => (inRead && host ? createPortal(node, host) : node)

  const cls = 'miniplayer glass' + (small ? ' mp-circle' : '') + (small && playing ? ' mp-on' : '') + (inReader ? ' in-reader' : hasTab ? ' has-tab' : '') + (enter ? ' mp-enter' : '')
  return place(
    <>
      <div ref={rootRef} className={cls}>
        {/* карточка (в кружке она гаснет) */}
        <div className="mp-card" aria-hidden={small}>
          <div className="mp-top">
            <button className="mp-info" tabIndex={small ? -1 : 0} onClick={() => { haptic.tap(); nav(`/read/${s}?a=${a}`) }}>
              <b>{sr?.name ?? `Сура ${s}`}</b>
              <span>Аят {a} из {sr?.ayahs ?? ''}{sl ? ` · сон ${sl.mode === 'time' ? `${left} мин` : `${sl.left} ${sl.left === 1 ? 'сура' : 'суры'}`}` : ''}</span>
            </button>
            <button className="mp-btn mp-x" tabIndex={small ? -1 : 0} onClick={() => { haptic.tap(); setMini(true) }} aria-label="Свернуть в кружок"><Icon id="down" /></button>
            <button className="mp-btn mp-x" tabIndex={small ? -1 : 0} onClick={closePlayer} aria-label="Закрыть плеер"><Icon id="close" /></button>
          </div>
          <div className="mp-mid">
            {prevS}{prevA}{main}{nextA}{nextS}
          </div>
          {!p.memo && (
            <div className="mp-bot">
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
        {/* кружок (в карточке он скрыт) */}
        <div className="mp-dot" aria-hidden={!small}>
          <button className="mp-dot-btn" tabIndex={small ? 0 : -1} onPointerDown={dotDown} onPointerMove={dotMove} onPointerUp={dotUp} onPointerCancel={dotCancel}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.toggle() } }} aria-label={playing ? 'Пауза. Смахните вправо, чтобы закрыть' : 'Слушать. Смахните вправо, чтобы закрыть'}>
            <Icon id={playing ? 'pause' : 'play'} />
          </button>
          <button className="mp-dot-up" tabIndex={small ? 0 : -1} onClick={expand} aria-label="Развернуть плеер"><Icon id="up" /></button>
        </div>
      </div>
      {gear && <PlayerSettings onClose={() => setGear(false)} />}
    </>
  )
}
