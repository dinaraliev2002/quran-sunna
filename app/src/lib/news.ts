// «Что нового»: загрузка новостей и что человек уже видел.
// Новости лежат в public/updates.json и подгружаются с сайта каждый раз заново — поэтому
// сообщение можно добавить и без изменения кода. Новичкам (первый запуск) окно не показываем.
import type { News } from '../types/news'

declare const __NEWS_LATEST__: string // последняя новость на момент сборки (vite.config.ts)

const SEEN = 'news_seen_v1'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* приватный режим */ } }

export const loadNews = () => fetch('updates.json', { cache: 'no-store' }).then((r) => r.json()).then((d: { items: News[] }) => d.items ?? [])

/** Запомнить: всё до этой новости включительно прочитано */
export const markSeen = (id: string) => write(SEEN, id)

/** Что показать: до трёх непрочитанных новостей (пусто — нечего); stale — открыта старая версия приложения */
export function freshNews(items: News[]): { list: News[]; stale: boolean } {
  const none = { list: [], stale: false }
  if (!items.length) return none
  if (/[?&]news/.test(location.search)) return { list: items.slice(0, 1), stale: false } // просмотр окна: ?news
  const seen = read(SEEN)
  if (seen === null && !read('progress_v2')) { markSeen(items[0].id); return none } // новичок
  const idx = seen ? items.findIndex((n) => n.id === seen) : items.length
  const list = items.slice(0, idx < 0 ? 1 : idx).slice(0, 3)
  return { list, stale: list.length > 0 && items[0].id !== __NEWS_LATEST__ }
}
