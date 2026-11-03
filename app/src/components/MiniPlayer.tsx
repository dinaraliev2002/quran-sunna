import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '../lib/telegram'
import { usePlayer } from '../store/player'
import { useStore } from '../store/settings'
import { Icon } from './Icon'
import { PlayerSettings } from './PlayerSettings'
import { useQuranMeta } from './ui'

const RATES = [0.75, 1, 1.25, 1.5]
const fmtRate = (r: number) => String(r).replace('.', ',') + '×'

/** Мини-плеер: виден везде, пока что-то звучит. Скорость и таймер сна — прямо в нём, остальное — в шестерёнке. */
export function MiniPlayer() {
  const p = usePlayer()
  const meta = useQuranMeta()
  const st = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const [gear, setGear] = useState(false)
  const [speed, setSpeed] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => {
    if (p.sleep?.mode !== 'time') return
    const t = setInterval(() => tick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [p.sleep?.mode])
  const hidden = p.status === 'idle' || !p.current || (!!p.memo && loc.pathname.startsWith('/read/'))
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
    st.set({ plRate: r })
    // скорость меняет способ воспроизведения — перезапускаем текущий аят
    setTimeout(() => usePlayer.getState().play(p.queue, p.index, p.memo), 0)
  }

  return (
    <>
      <div className={'miniplayer glass' + (inReader ? ' in-reader' : '')}>
        <div className="mp-top">
          <button className="mp-info" onClick={() => { haptic.tap(); nav(`/read/${s}?a=${a}`) }}>
            <b>{sr?.name ?? `Сура ${s}`}</b>
            <span>Аят {a} из {sr?.ayahs ?? ''}{sl ? ` · сон ${sl.mode === 'time' ? `${left} мин` : `${sl.left} ${sl.left === 1 ? 'сура' : 'суры'}`}` : ''}</span>
          </button>
          <button className="mp-btn mp-x" onClick={() => { haptic.tap(); p.stop() }} aria-label="Закрыть плеер"><Icon id="close" /></button>
        </div>
        <div className="mp-mid">
          <button className="mp-btn mp-side" disabled={p.index <= 0} onClick={() => { haptic.tap(); p.play(p.queue, p.index - 1, p.memo) }} aria-label="Предыдущий аят"><Icon id="back" /></button>
          <button className="mp-btn mp-main" onClick={() => { haptic.tap(); p.toggle() }} aria-label={playing ? 'Пауза' : 'Слушать'}><Icon id={playing ? 'pause' : 'play'} /></button>
          <button className="mp-btn mp-side" disabled={p.index >= p.queue.length - 1} onClick={() => { haptic.tap(); p.play(p.queue, p.index + 1, p.memo) }} aria-label="Следующий аят"><Icon id="back" className="icon mp-next" /></button>
        </div>
        {!p.memo && (
          <div className="mp-bot">
            <div className="mp-rate">
              <button className="mp-chip" onClick={() => setSpeed(!speed)} aria-label="Скорость">{fmtRate(st.plRate)}</button>
              {speed && (
                <>
                  {createPortal(<div className="mp-away" onClick={() => setSpeed(false)} />, document.body)}
                  <div className="mp-pop glass">
                    {RATES.map((r) => <button key={r} className={r === st.plRate ? 'on' : ''} onClick={() => setRate(r)}>{fmtRate(r)}</button>)}
                  </div>
                </>
              )}
            </div>
            <button className={'mp-btn mp-x mp-sleep' + (sl ? ' on' : '')} onClick={toggleSleep} aria-label="Таймер сна"><Icon id="moon" /></button>
            <button className="mp-btn mp-x" onClick={() => { haptic.tap(); setGear(true) }} aria-label="Настройки плеера"><Icon id="gear" /></button>
          </div>
        )}
      </div>
      {gear && <PlayerSettings onClose={() => setGear(false)} />}
    </>
  )
}
