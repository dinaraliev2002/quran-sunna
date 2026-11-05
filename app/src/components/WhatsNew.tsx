import { useEffect, useState } from 'react'
import { haptic, isNative } from '../lib/telegram'
import { Icon } from './Icon'
import { Sheet, SheetHead } from './ui'
import { freshNews, loadNews, markSeen } from '../lib/news'
import type { News } from '../types/news'
import './WhatsNew.css'

// Окно «Что нового»: при открытии приложения показывает новости, которые человек ещё не видел (см. lib/news.ts).
// Те же записи показывает «История обновлений» в настройках.

/** Одна запись: карточки с значком, пояснением, подсказкой «где найти» и картинкой */
export function NewsEntry({ n, onZoom }: { n: News; onZoom: (src: string) => void }) {
  return (
    <div className="wn-item">
      {n.kind === 'message' && <h4>{n.title}</h4>}
      {n.text && <p>{n.text}</p>}
      {n.points && <ul>{n.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
      {n.cards?.filter((c) => !c.only || (c.only === 'native') === isNative).map((c, i) => (
        <div key={i} className="wn-card">
          <div className="wn-h">
            <span className="wn-ic" style={{ color: c.color ?? 'var(--gold-ink)' }}><Icon id={c.icon} /></span>
            <b>{c.title}</b>
          </div>
          <p>{c.text}</p>
          {c.tip && <div className="wn-tip">{c.tip}</div>}
          {(c.imgs ?? (c.img ? [c.img] : [])).length > 0 && (
            <div className="wn-shots">
              {(c.imgs ?? [c.img!]).map((src) => (
                <button key={src} className="wn-shot" onClick={() => { haptic.tap(); onZoom(src) }} aria-label="Увеличить картинку">
                  <img src={src} alt="" loading="lazy" onError={(e) => { e.currentTarget.parentElement!.style.display = 'none' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {n.fixes && n.fixes.length > 0 && <div className="wn-fix">{n.fixes.join(' · ')}</div>}
    </div>
  )
}

/** Картинка на весь экран; тап — закрыть */
function Zoom({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="wn-zoom" onClick={onClose} role="dialog" aria-label="Картинка">
      <img src={src} alt="" />
      <button className="wn-zoom-x" aria-label="Закрыть"><Icon id="close" /></button>
    </div>
  )
}

export function WhatsNew() {
  const [list, setList] = useState<News[]>([])
  const [stale, setStale] = useState(false) // открыта старая версия приложения
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const check = () =>
      loadNews().then((items) => {
        if (!alive) return
        const fresh = freshNews(items)
        if (fresh.list.length) { setList(fresh.list); setStale(fresh.stale) }
      }).catch(() => { /* нет сети — покажем в другой раз */ })
    const t = setTimeout(check, 1500) // не мешать загрузке и экскурсу
    const onVis = () => { if (!document.hidden) check() } // вернулись в приложение — вдруг вышло новое
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (!list.length) return null
  const close = () => { markSeen(list[0].id); setList([]) }
  const head = list[0]
  const title = head.kind === 'message' ? 'Сообщение' : head.version ? `Новое в ${head.version}` : 'Что нового'
  return (
    <>
    <Sheet onClose={close} tall>
      <SheetHead title={title} sub={head.date} onClose={close} />
      <div className="body wn">
        {list.map((n, i) => (
          <div key={n.id}>
            {i > 0 && <div className="wn-ver">{n.kind === 'update' && n.version ? `Версия ${n.version}` : n.title}<small> · {n.date}</small></div>}
            <NewsEntry n={n} onZoom={setZoom} />
          </div>
        ))}
        {stale
          ? <button className="bigbtn" onClick={() => { haptic.tap(); markSeen(list[0].id); location.reload() }}>Обновить приложение</button>
          : <button className="bigbtn" onClick={() => { haptic.tap(); close() }}>Понятно</button>}
      </div>
    </Sheet>
      {zoom && <Zoom src={zoom} onClose={() => setZoom(null)} />}
    </>
  )
}

/** История обновлений (настройки): все версии, новые сверху */
export function NewsHistory({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<News[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)
  useEffect(() => { loadNews().then(setItems).catch(() => setFailed(true)) }, [])
  return (
    <>
    <Sheet onClose={onClose} tall>
      <SheetHead title="Что нового" sub="История обновлений" onClose={onClose} />
      <div className="body wn">
        {!items && !failed && <div className="loading">Загрузка…</div>}
        {failed && <div className="empty">Не удалось загрузить. Проверьте интернет</div>}
        {items?.map((n) => (
          <div key={n.id}>
            <div className="wn-ver">{n.kind === 'update' && n.version ? `Версия ${n.version}` : n.title}<small> · {n.date}</small></div>
            <NewsEntry n={n} onZoom={setZoom} />
          </div>
        ))}
      </div>
    </Sheet>
      {zoom && <Zoom src={zoom} onClose={() => setZoom(null)} />}
    </>
  )
}
