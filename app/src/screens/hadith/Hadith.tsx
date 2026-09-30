import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural, TabBar } from '../../components/ui'
import { snippet } from '../../lib/azkar'
import { loadBook, loadHadithIndex, loadTopics, TOPIC_ICON, topicTitle, type HIndex, type TopicsData } from '../../lib/hadith'
import { useStore } from '../../store/settings'
import { splitTitle } from './HadithText'

type Tab = 'books' | 'topics' | 'fav'
const memory = { tab: 'books' as Tab, top: 0 }

export default function Hadith() {
  const nav = useNavigate()
  const [idx, setIdx] = useState<HIndex | null>(null)
  const [topics, setTopics] = useState<TopicsData | null>(null)
  const [tab, setTabState] = useState<Tab>(memory.tab)
  const [q, setQ] = useState<string | null>(null)
  const hfav = useStore((s) => s.hfav)
  const last = useStore((s) => s.hadithLast)
  const screen = useRef<HTMLDivElement>(null)
  const setTab = (t: Tab) => { memory.tab = t; memory.top = 0; setTabState(t); if (screen.current) screen.current.scrollTop = 0 }

  useEffect(() => { loadHadithIndex().then(setIdx); loadTopics().then(setTopics) }, [])
  useLayoutEffect(() => { if (idx && screen.current && memory.top) screen.current.scrollTop = memory.top }, [idx])

  const query = (q ?? '').trim().toLowerCase()
  const found = useMemo(() => {
    if (!query || query.length < 2 || !topics || !idx) return null
    const books = idx.collections.flatMap((c) => c.books.filter((b) => b.title.toLowerCase().includes(query)).map((b) => ({ c, b })))
    const hadiths = Object.entries(topics.hadiths).filter(([, [, t]]) => t.toLowerCase().includes(query)).slice(0, 150)
    return { books, hadiths }
  }, [query, topics, idx])

  const lastCol = last && idx?.collections.find((c) => c.id === last.c)
  const lastBook = lastCol?.books.find((b) => b.n === last!.n)
  const roots = topics?.topics.filter((t) => !t.parent) ?? []

  return (
    <div className="screen az hd" ref={screen} onScroll={(e) => { memory.top = e.currentTarget.scrollTop }}>
      <div className="sticky-title">
        {q === null ? <h1>Хадисы</h1> : (
          <div className="search" style={{ flex: 1, margin: '0 12px 0 0' }}>
            <Icon id="search" />
            <input autoFocus placeholder="Поиск по хадисам и главам" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <button className="icon-btn" onClick={() => setQ(q === null ? '' : null)} aria-label="Поиск">
          <Icon id={q === null ? 'search' : 'close'} />
        </button>
      </div>

      {found ? (
        <>
          <p className="az-sub">Найдено: {found.books.length + found.hadiths.length}</p>
          {found.books.map(({ c, b }) => (
            <button key={c.id + b.n} className="az-row" onClick={() => nav(`/hadith/c/${c.id}/${b.n}`)}>
              <div className="t"><span className="az-ch">{c.name}</span><b>{b.title}</b></div>
            </button>
          ))}
          {found.hadiths.map(([id, [, t]]) => (
            <button key={id} className="az-row" onClick={() => nav(`/hadith/e/${id}`)}>
              <div className="t"><span className="az-ch">Темы</span><b>{snippet(t, 140)}</b></div>
            </button>
          ))}
          {found.books.length + found.hadiths.length === 0 && <div className="empty">Ничего не найдено</div>}
        </>
      ) : (
        <>
          <div className="az-tabs">
            <div className="sortseg">
              <button className={tab === 'books' ? 'on' : ''} onClick={() => setTab('books')}>Сборники</button>
              <button className={tab === 'topics' ? 'on' : ''} onClick={() => setTab('topics')}>Темы</button>
              <button className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>Избранное{hfav.length ? ` · ${hfav.length}` : ''}</button>
            </div>
          </div>
          <div style={{ height: 8 }} />
          {!idx && <div className="loading">Загрузка…</div>}

          {idx && tab === 'books' && (
            <>
              {lastCol && lastBook && (
                <button className="hd-continue" onClick={() => nav(`/hadith/c/${lastCol.id}/${lastBook.n}?i=${last!.i}`)}>
                  <div className="t">
                    <span>Продолжить · {lastCol.name}</span>
                    <b>{lastBook.title}</b>
                  </div>
                  <span className="hd-go"><Icon id="right" /></span>
                </button>
              )}
              {idx.collections.map((c, k) => (
                <button key={c.id} className={'hd-col' + (k === 0 ? ' first' : '')} onClick={() => nav(`/hadith/c/${c.id}`)}>
                  <div className="hd-col-ar">{c.ar}</div>
                  <div className="t">
                    <b>{c.name}</b>
                    <span>{c.author}</span>
                    <p>{c.about}</p>
                  </div>
                  <div className="hd-col-stat">
                    <span><b>{c.hadiths.toLocaleString('ru-RU')}</b> {plural(c.hadiths, 'хадис', 'хадиса', 'хадисов')}</span>
                    {c.books.length > 1 && <span><b>{c.books.length}</b> {c.id === 'bukhari' ? plural(c.books.length, 'книга', 'книги', 'книг') : plural(c.books.length, 'глава', 'главы', 'глав')}</span>}
                  </div>
                </button>
              ))}
              <p className="hd-note">
                Здесь только сборники с полным переводом на русский. Остальные («Сунан» Абу Дауда, ат-Тирмизи, ан-Насаи, Ибн Маджи, «Сахих» Муслима)
                появятся, когда их перевод будет завершён.
              </p>
            </>
          )}

          {tab === 'topics' && (
            <>
              <p className="az-sub" style={{ marginTop: -6 }}>Хадисы с объяснением и выводами · {Object.keys(topics?.hadiths ?? {}).length.toLocaleString('ru-RU')}</p>
              <div className="az-grid">
                {roots.map((t) => (
                  <button key={t.id} className="az-cat" onClick={() => nav(`/hadith/t/${t.id}`)}>
                    <span className="ib"><Icon id={TOPIC_ICON[t.id] ?? 'scroll'} /></span>
                    <b>{topicTitle(t)}</b>
                    <span>{t.count} {plural(t.count, 'хадис', 'хадиса', 'хадисов')}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'fav' && (
            hfav.length === 0 ? (
              <div className="stub">
                <Icon id="bookmark" />
                <b>Здесь будут избранные хадисы</b>
                <p>Нажмите на значок закладки у хадиса, чтобы сохранить его сюда.</p>
              </div>
            ) : hfav.map((key) => <FavRow key={key} fkey={key} idx={idx} topics={topics} />)
          )}
        </>
      )}
      <TabBar />
    </div>
  )
}

/** Строка избранного: подгружает заголовок хадиса */
function FavRow({ fkey, idx, topics }: { fkey: string; idx: HIndex | null; topics: TopicsData | null }) {
  const nav = useNavigate()
  const [text, setText] = useState<{ ch: string; title: string } | null>(null)
  const parts = fkey.split(':')
  useEffect(() => {
    if (parts[0] === 'e') {
      const t = topics?.hadiths[parts[1]]
      if (t) setText({ ch: 'Темы', title: t[1] })
    } else if (idx) {
      const c = idx.collections.find((x) => x.id === parts[1])
      loadBook(parts[1], Number(parts[2])).then((b) => {
        const it = b.items[Number(parts[3])]
        const ru = it?.ru.find((p) => !/:$/.test(p)) ?? it?.ru[0] ?? ''
        setText({ ch: `${c?.name ?? ''} · ${b.title}`, title: it ? (splitTitle(it.t).title || ru) : '' })
      }).catch(() => {})
    }
  }, [fkey, idx, topics])
  const open = () => nav(parts[0] === 'e' ? `/hadith/e/${parts[1]}` : `/hadith/c/${parts[1]}/${parts[2]}?i=${parts[3]}`)
  return (
    <button className="az-row" onClick={open}>
      <div className="t">
        <span className="az-ch">{text?.ch ?? '…'}</span>
        <b>{text ? snippet(text.title.replace(/\*\*/g, ''), 140) : ''}</b>
      </div>
      <Icon id="right" className="icon chev-s" />
    </button>
  )
}
