import { useEffect, useRef, useState } from 'react'
import { renderShareCard, shareCardImage, SHARE_STYLES, type ShareCard } from '../lib/shareImage'
import { haptic } from '../lib/telegram'
import { Icon } from './Icon'
import { Sheet, SheetHead } from './ui'

/** Выбор фона листанием (25 видов) пока выключен: остаётся один вид «как в приложении». Включить: true */
const SHARE_BACKGROUNDS = false

const KEY = 'share_style_v1'
const readIdx = () => {
  if (!SHARE_BACKGROUNDS) return 0
  try { return Math.min(Math.max(Number(localStorage.getItem(KEY)) || 0, 0), SHARE_STYLES - 1) } catch { return 0 } }

/** Окно «Поделиться картинкой»: видно, как будет выглядеть картинка; стрелками (или свайпом) листаются фоны */
export function ShareSheet({ card, caption, onClose }: { card: ShareCard; caption: string; onClose: () => void }) {
  const [idx, setIdx] = useState(readIdx)
  const [url, setUrl] = useState<string | null>(null)
  const cache = useRef(new Map<number, string>())
  const swipe = useRef<number | null>(null)

  useEffect(() => {
    let live = true
    const render = async (i: number) => {
      if (cache.current.has(i)) return cache.current.get(i)!
      const u = URL.createObjectURL(await renderShareCard(card, i))
      cache.current.set(i, u)
      return u
    }
    render(idx).then((u) => {
      if (!live) return
      setUrl(u)
      // заранее рисуем соседние виды, чтобы листание было мгновенным
      render((idx + 1) % SHARE_STYLES).catch(() => {})
      render((idx - 1 + SHARE_STYLES) % SHARE_STYLES).catch(() => {})
    }).catch(() => {})
    if (SHARE_BACKGROUNDS) try { localStorage.setItem(KEY, String(idx)) } catch { /* ignore */ }
    return () => { live = false }
  }, [idx, card])
  useEffect(() => { const c = cache.current; return () => c.forEach((u) => URL.revokeObjectURL(u)) }, [])

  const go = (d: number) => { haptic.tick(); setIdx((i) => (i + d + SHARE_STYLES) % SHARE_STYLES) }

  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Картинка для отправки" sub={SHARE_BACKGROUNDS ? 'Листайте виды стрелками или свайпом' : 'Так она будет выглядеть'} onClose={onClose} />
      <div className="shr-wrap"
        onTouchStart={(e) => { if (SHARE_BACKGROUNDS) swipe.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (!SHARE_BACKGROUNDS) return
          const x0 = swipe.current; swipe.current = null
          if (x0 !== null && Math.abs(e.changedTouches[0].clientX - x0) > 50) go(e.changedTouches[0].clientX < x0 ? 1 : -1)
        }}>
        {url ? <img className="shr-img" src={url} alt="Предпросмотр" draggable={false} /> : <div className="loading">Рисую…</div>}
      </div>
      {SHARE_BACKGROUNDS && <div className="shr-nav">
        <button className="sq" onClick={() => go(-1)} aria-label="Предыдущий вид"><Icon id="back" /></button>
        <span>{idx === 0 ? 'Как в приложении' : `Вид ${idx + 1} из ${SHARE_STYLES}`}</span>
        <button className="sq" onClick={() => go(1)} aria-label="Следующий вид"><Icon id="right" /></button>
      </div>}
      <button className="bigbtn" onClick={() => { haptic.tap(); shareCardImage(card, caption, idx).catch(() => {}).finally(onClose) }}><Icon id="share" />Отправить</button>
    </Sheet>
  )
}
