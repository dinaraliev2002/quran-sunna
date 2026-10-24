import { useEffect, useState } from 'react'
import { haptic } from '../lib/telegram'
import { Sheet, SheetHead } from './ui'
import './WhatsNew.css'

// Окно «Что нового»: при открытии приложения показывает новости, которые человек ещё не видел.
// Новости лежат в public/updates.json и подгружаются с сайта каждый раз заново — поэтому
// сообщение можно добавить и без изменения кода. Новичкам (первый запуск) окно не показываем.

type News = { id: string; kind: 'update' | 'message'; date?: string; title: string; points?: string[]; text?: string }
declare const __NEWS_LATEST__: string // последняя новость на момент сборки (vite.config.ts)

const SEEN = 'news_seen_v1'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* приватный режим */ } }

export function WhatsNew() {
  const [list, setList] = useState<News[]>([])
  const [stale, setStale] = useState(false) // открыта старая версия приложения

  useEffect(() => {
    let alive = true
    const check = () =>
      fetch('updates.json', { cache: 'no-store' }).then((r) => r.json()).then((d: { items: News[] }) => {
        if (!alive || !d.items?.length) return
        const seen = read(SEEN)
        if (seen === null && !read('progress_v2')) { write(SEEN, d.items[0].id); return } // новичок
        const idx = seen ? d.items.findIndex((n) => n.id === seen) : d.items.length
        const fresh = d.items.slice(0, idx < 0 ? 1 : idx).slice(0, 3)
        if (fresh.length) { setList(fresh); setStale(d.items[0].id !== __NEWS_LATEST__) }
      }).catch(() => { /* нет сети — покажем в другой раз */ })
    const t = setTimeout(check, 1500) // не мешать загрузке и экскурсу
    const onVis = () => { if (!document.hidden) check() } // вернулись в приложение — вдруг вышло новое
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (!list.length) return null
  const close = () => { write(SEEN, list[0].id); setList([]) }
  const update = list.some((n) => n.kind === 'update')
  return (
    <Sheet onClose={close}>
      <SheetHead title={update ? 'Что нового' : 'Сообщение'} sub={list[0].date} onClose={close} />
      <div className="body wn">
        {list.map((n) => (
          <div key={n.id} className="wn-item">
            {list.length > 1 || n.title !== 'Обновление приложения' ? <h4>{n.title}{list.length > 1 && n.date ? <small> · {n.date}</small> : null}</h4> : null}
            {n.text && <p>{n.text}</p>}
            {n.points && <ul>{n.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
          </div>
        ))}
        {stale
          ? <button className="bigbtn" onClick={() => { haptic.tap(); write(SEEN, list[0].id); location.reload() }}>Обновить приложение</button>
          : <button className="bigbtn" onClick={() => { haptic.tap(); close() }}>Понятно</button>}
      </div>
    </Sheet>
  )
}
