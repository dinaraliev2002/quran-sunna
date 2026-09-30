import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { TabBar, plural } from '../../components/ui'
import { CATEGORY_ICON, chapterTitle, DAILY_MAIN, DAILY_ROUTINE, EVENING, loadAzkar, MORNING, nowIsMorning, snippet, timesLabel, type AzkarData } from '../../lib/azkar'
import { useStore } from '../../store/settings'

type Tab = 'daily' | 'all' | 'groups'
const memory = { tab: 'daily' as Tab, top: 0 }

/** Сколько азкаров главы уже прочитано сегодня полностью */
export function useChapterProgress(data: AzkarData | null) {
  const az = useStore((s) => s.today.az)
  return (ch: number) => {
    const chapter = data?.chapters.find((c) => c.id === ch)
    if (!chapter || !data) return { done: 0, total: 0 }
    const done = chapter.items.filter((i) => (az?.[`${ch}:${i}`] ?? 0) >= data.items[i].rep).length
    return { done, total: chapter.items.length }
  }
}

function Ring({ done, total, size = 44 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 4, len = 2 * Math.PI * r, k = total ? done / total : 0
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={len} strokeDashoffset={len * (1 - k)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

export default function Azkar() {
  const nav = useNavigate()
  const [data, setData] = useState<AzkarData | null>(null)
  const [tab, setTabState] = useState<Tab>(memory.tab)
  const [q, setQ] = useState<string | null>(null)
  const progress = useChapterProgress(data)
  const screen = useRef<HTMLDivElement>(null)
  const setTab = (t: Tab) => { memory.tab = t; memory.top = 0; setTabState(t); if (screen.current) screen.current.scrollTop = 0 }

  useEffect(() => { loadAzkar().then(setData) }, [])
  // вернуться на то же место после открытия главы
  useLayoutEffect(() => { if (data && screen.current && memory.top) screen.current.scrollTop = memory.top }, [data])

  const chapterById = useMemo(() => new Map(data?.chapters.map((c) => [c.id, c]) ?? []), [data])
  const query = (q ?? '').trim().toLowerCase()

  // «Все»: каждый азкар отдельно
  const all = useMemo(() => {
    if (!data) return []
    const list = data.chapters.flatMap((c) => c.items.map((i, k) => ({ id: i, ch: c, k })))
    if (!query) return list
    return list.filter(({ id, ch }) => chapterTitle(ch).toLowerCase().includes(query) || ch.name.toLowerCase().includes(query) || data.items[id].ru.toLowerCase().includes(query))
  }, [data, query])

  const morningFirst = nowIsMorning()
  const main = [...DAILY_MAIN].sort((a, b) => {
    const pri = (ch: number) => (ch === (morningFirst ? MORNING : EVENING) ? 0 : ch === (morningFirst ? EVENING : MORNING) ? 1 : 2)
    return pri(a.ch) - pri(b.ch)
  })

  return (
    <div className="screen az" ref={screen} onScroll={(e) => { memory.top = e.currentTarget.scrollTop }}>
      <div className="sticky-title">
        {q === null ? <h1>Азкары</h1> : (
          <div className="search" style={{ flex: 1, margin: '0 12px 0 0' }}>
            <Icon id="search" />
            <input autoFocus placeholder="Поиск по азкарам" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <button className="icon-btn" onClick={() => { setQ(q === null ? '' : null); if (q === null) setTab('all') }} aria-label="Поиск">
          <Icon id={q === null ? 'search' : 'close'} />
        </button>
      </div>
      <div className="az-tabs">
        <div className="sortseg">
          <button className={tab === 'daily' ? 'on' : ''} onClick={() => setTab('daily')}>Ежедневные</button>
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Все</button>
          <button className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}>Группы</button>
        </div>
      </div>
      <div style={{ height: 8 }} />

      {!data && <div className="loading">Загрузка…</div>}

      {data && tab === 'daily' && (
        <>
          {main.slice(0, 2).map((d, i) => {
            const p = progress(d.ch)
            const complete = p.total > 0 && p.done >= p.total
            return (
              <button key={d.ch} className={'az-hero' + (i === 0 ? ' primary' : '')} onClick={() => nav(`/azkar/ch/${d.ch}`)}>
                <div className="t">
                  <span className="az-when">{i === 0 ? 'Сейчас' : morningFirst ? 'Вечером' : 'Утром'}</span>
                  <b>{d.title}</b>
                  <span>{d.hint}</span>
                </div>
                <div className="az-ring">
                  <Ring done={p.done} total={p.total} size={58} />
                  <span>{complete ? <Icon id="check" /> : `${p.done}/${p.total}`}</span>
                </div>
              </button>
            )
          })}
          <div className="section-h"><h2>Каждый день</h2></div>
          {main.slice(2).map((d) => {
            const p = progress(d.ch)
            return (
              <button key={d.ch} className="list-item" onClick={() => nav(`/azkar/ch/${d.ch}`)}>
                <div className="ib"><Icon id={d.icon} /></div>
                <div className="t"><b>{d.title}</b><span>{d.hint} · {p.total} {plural(p.total, 'мольба', 'мольбы', 'мольб')}</span></div>
                {p.done > 0 ? <span className="az-count">{p.done}/{p.total}</span> : <Icon id="right" className="icon chev-s" />}
              </button>
            )
          })}
          <div className="section-h"><h2>В течение дня</h2></div>
          <div className="group">
            {DAILY_ROUTINE.map((ch) => {
              const c = chapterById.get(ch)
              if (!c) return null
              return (
                <button key={ch} className="sitem" onClick={() => nav(`/azkar/ch/${ch}`)}>
                  <span className="t">{c.name}</span>
                  <span className="v">{c.items.length}</span>
                  <Icon id="right" className="icon chev" />
                </button>
              )
            })}
          </div>
        </>
      )}

      {data && tab === 'all' && (
        <>
          <p className="az-sub" style={{ marginTop: -6 }}>{query ? `Найдено: ${all.length}` : `Все мольбы книги по порядку · ${all.length}`}</p>
          {all.map(({ id, ch }) => {
            const it = data.items[id]
            return (
              <button key={id} className="az-row" onClick={() => nav(`/azkar/ch/${ch.id}?item=${id}`)}>
                <div className="az-num">{id}</div>
                <div className="t">
                  <span className="az-ch">{chapterTitle(ch)}</span>
                  <b>{snippet(it.ru)}</b>
                </div>
                {it.rep > 1 && <span className="az-rep">{timesLabel(it.rep)}</span>}
              </button>
            )
          })}
          {all.length === 0 && <div className="empty">Ничего не найдено</div>}
        </>
      )}

      {data && tab === 'groups' && (
        <div className="az-grid">
          {data.categories.map((c) => {
            const n = data.chapters.filter((x) => x.cat === c.id).length
            return (
              <button key={c.id} className="az-cat" onClick={() => nav(`/azkar/cat/${c.id}`)}>
                <span className="ib"><Icon id={CATEGORY_ICON[c.id] ?? 'star'} /></span>
                <b>{c.name}</b>
                <span>{n} {plural(n, 'раздел', 'раздела', 'разделов')}</span>
              </button>
            )
          })}
        </div>
      )}
      <TabBar />
    </div>
  )
}

export { Ring }
