import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { TabBar } from '../../components/ui'
import { loadNames, type AllahName, type NamesData } from '../../lib/names'
import { useStore } from '../../store/settings'

type Filter = 'all' | 'learned' | 'new'
const memory = { filter: 'all' as Filter, grid: true, top: 0 }

/** Транскрипция с выделенной ударной буквой */
export function Translit({ name }: { name: AllahName }) {
  const { tr, st } = name
  if (st < 0 || st >= tr.length) return <>{tr}</>
  return <>{tr.slice(0, st)}<span className="nm-st">{tr[st]}</span>{tr.slice(st + 1)}</>
}

// 99 имён Аллаха: прогресс заучивания, фильтр, плитки (или список)
export default function Names() {
  const nav = useNavigate()
  const [data, setData] = useState<NamesData | null>(null)
  const [filter, setFilterState] = useState<Filter>(memory.filter)
  const [grid, setGridState] = useState(memory.grid)
  const [q, setQ] = useState<string | null>(null)
  const learned = useStore((s) => s.learned)
  const screen = useRef<HTMLDivElement>(null)
  useEffect(() => { loadNames().then(setData) }, [])
  useLayoutEffect(() => { if (data && screen.current && memory.top) screen.current.scrollTop = memory.top }, [data])

  const setFilter = (f: Filter) => { memory.filter = f; setFilterState(f) }
  const setGrid = (g: boolean) => { memory.grid = g; setGridState(g) }
  const query = (q ?? '').trim().toLowerCase().replace(/ё/g, 'е')
  const list = useMemo(() => (data?.names ?? []).filter((n) => {
    if (filter === 'learned' && !learned.includes(n.n)) return false
    if (filter === 'new' && learned.includes(n.n)) return false
    if (!query) return true
    return `${n.tr} ${n.ru}`.toLowerCase().replace(/ё/g, 'е').includes(query) || n.ar.includes(q!.trim()) || String(n.n) === query
  }), [data, filter, learned, query])
  const k = learned.length

  return (
    <div className="screen az nm" ref={screen} onScroll={(e) => { memory.top = e.currentTarget.scrollTop }}>
      <div className="sticky-title">
        {q === null ? <h1>99 имён</h1> : (
          <div className="search" style={{ flex: 1, margin: '0 12px 0 0' }}>
            <Icon id="search" />
            <input autoFocus placeholder="Имя или значение" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {q === null && <button className="icon-btn" onClick={() => setGrid(!grid)} aria-label={grid ? 'Списком' : 'Плитками'}><Icon id={grid ? 'rows' : 'grid'} /></button>}
          <button className="icon-btn" onClick={() => setQ(q === null ? '' : null)} aria-label="Поиск"><Icon id={q === null ? 'search' : 'close'} /></button>
        </div>
      </div>

      {q === null && (
        <div className="nm-hero">
          <div className="nm-hero-top">
            <div className="nm-ring">
              <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" className="bg" /><circle cx="32" cy="32" r="27" className="fg" strokeDasharray={169.6} strokeDashoffset={169.6 * (1 - k / 99)} transform="rotate(-90 32 32)" /></svg>
              <span>{k}</span>
            </div>
            <div className="t">
              <b>{k === 99 ? 'Все имена выучены — машаАллах!' : k ? `Выучено ${k} из 99` : 'Выучите прекрасные имена'}</b>
              <span>«У Аллаха девяносто девять имён… Кто запомнит их, войдёт в Рай» (аль-Бухари, Муслим)</span>
            </div>
          </div>
          <div className="nm-hero-btns">
            <button onClick={() => nav('/names/learn?mode=cards')}><Icon id="page" />Карточки</button>
            <button onClick={() => nav('/names/learn?mode=quiz')}><Icon id="check" />Тест</button>
          </div>
        </div>
      )}

      <div className="az-tabs">
        <div className="sortseg">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Все</button>
          <button className={filter === 'learned' ? 'on' : ''} onClick={() => setFilter('learned')}>Выучил{k ? ` · ${k}` : ''}</button>
          <button className={filter === 'new' ? 'on' : ''} onClick={() => setFilter('new')}>Не выучил</button>
        </div>
      </div>
      <div style={{ height: 8 }} />

      {!data && <div className="loading">Загрузка…</div>}
      {data && (grid ? (
        <div className="nm-grid">
          {list.map((n) => (
            <button key={n.n} className={'nm-tile' + (learned.includes(n.n) ? ' done' : '')} onClick={() => nav(`/names/${n.n}`)}>
              <span className="nm-no">{n.n}</span>
              {learned.includes(n.n) && <span className="nm-ok"><Icon id="check" /></span>}
              <span className="nm-ar">{n.ar}</span>
              <b><Translit name={n} /></b>
              <small>{n.ru}</small>
            </button>
          ))}
        </div>
      ) : list.map((n) => (
        <button key={n.n} className="hd-book" onClick={() => nav(`/names/${n.n}`)}>
          <div className="num-badge"><span>{n.n}</span></div>
          <div className="t"><b><Translit name={n} /></b><span>{n.ru}</span></div>
          {learned.includes(n.n) ? <span className="nm-ok inline"><Icon id="check" /></span> : null}
          <div className="nm-ar-s">{n.ar}</div>
        </button>
      )))}
      {data && list.length === 0 && <div className="empty">{filter === 'learned' ? 'Пока ни одного выученного имени' : 'Ничего не найдено'}</div>}
      {data && <p className="hd-note" style={{ marginTop: 18 }}>Список и толкования — по книге Са‘ида аль-Кахтани «Толкование прекрасных имён Аллаха в свете Корана и Сунны» (пер. Э. Кулиева).</p>}
      <TabBar />
    </div>
  )
}
