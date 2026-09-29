import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { SurahRow, TabBar, useQuranMeta } from '../components/ui'
import { useStore } from '../store/settings'

type Place = 'all' | 'mk' | 'md'

// Запоминаем место в списке, сортировку и фильтр — при возврате из суры список открывается там же
const memory = { top: 0, offset: 0, sort: 'mushaf' as 'mushaf' | 'rev', place: 'all' as Place }

export default function SurahList() {
  const nav = useNavigate()
  const meta = useQuranMeta()
  const lastRead = useStore((s) => s.lastRead)
  const [sort, setSortState] = useState(memory.sort)
  const [place, setPlaceState] = useState<Place>(memory.place)
  const [query, setQuery] = useState<string | null>(null)
  const screen = useRef<HTMLDivElement>(null)
  const sub = useRef<HTMLDivElement>(null)
  const lastTop = useRef(0)
  const wrap = useRef<HTMLDivElement>(null)
  const offset = useRef(0) // на сколько пикселей уехал верхний блок
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setSort = (v: typeof sort) => { memory.sort = v; setSortState(v) }
  const setPlace = (v: Place) => { memory.place = v; setPlaceState(v) }

  const list = useMemo(() => {
    if (!meta) return []
    let l = meta.surahs.filter((s) => place === 'all' || (place === 'mk') === s.mk)
    if (query) {
      const q = query.trim().toLowerCase().replace(/[-\s]/g, '')
      l = l.filter((s) => String(s.id) === q || s.name.toLowerCase().replace(/[-\s]/g, '').includes(q) || s.meaning.toLowerCase().includes(q))
    }
    return sort === 'rev' ? [...l].sort((a, b) => a.rev - b.rev) : l
  }, [meta, sort, place, query])

  // сдвинуть верхний блок (anim — плавно доехать, иначе строго за пальцем)
  function apply(v: number, anim = false) {
    const w = wrap.current, inner = sub.current
    if (!w) return
    offset.current = v
    memory.offset = v
    const h = inner?.offsetHeight ?? 0
    w.style.transition = anim ? 'transform .28s cubic-bezier(.22, 1, .36, 1)' : 'none'
    w.style.transform = v ? `translateY(${-v}px)` : ''
    if (inner) {
      inner.style.transition = anim ? 'opacity .28s ease' : 'none'
      inner.style.opacity = h ? String(1 - Math.min(1, v / h) * 0.9) : '1'
      inner.style.pointerEvents = v > h / 2 ? 'none' : ''
    }
  }

  // вернуться на то же место, когда список отрисован
  useLayoutEffect(() => {
    if (meta && screen.current && memory.top) {
      screen.current.scrollTop = memory.top
      lastTop.current = memory.top
      apply(memory.offset)
    }
  }, [meta])

  // верхний блок двигается вместе с пальцем: вниз — уезжает, вверх — выезжает обратно
  function onScroll() {
    const el = screen.current!
    // «пружина» iOS у верхнего/нижнего края — не учитываем
    const max = el.scrollHeight - el.clientHeight
    const top = Math.min(max, Math.max(0, el.scrollTop))
    memory.top = top
    const d = top - lastTop.current
    lastTop.current = top
    if (query !== null) return
    const h = sub.current?.offsetHeight ?? 0
    const v = Math.min(h, Math.max(0, offset.current + d))
    apply(top <= 0 ? 0 : v)
    // палец остановился на полпути — мягко доводим до открытого или закрытого положения
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const cur = offset.current
      if (cur > 0 && cur < h) {
        const target = cur > h / 2 && lastTop.current > h ? h : 0
        apply(target, true)
      }
    }, 140)
  }

  const counts = meta ? { all: 114, mk: meta.surahs.filter((s) => s.mk).length, md: meta.surahs.filter((s) => !s.mk).length } : { all: 114, mk: 0, md: 0 }
  const last = lastRead && meta ? meta.surahs[lastRead.s - 1] : null

  return (
    <div className="screen sl" ref={screen} onScroll={onScroll}>
      <div className="sticky-title">
        {query === null ? <h1>Коран</h1> : (
          <div className="search" style={{ flex: 1, margin: '0 12px 0 0' }}>
            <Icon id="search" />
            <input autoFocus placeholder="Название или номер суры" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}
        <button className="icon-btn" onClick={() => setQuery(query === null ? '' : null)} aria-label="Поиск">
          <Icon id={query === null ? 'search' : 'close'} />
        </button>
      </div>

      {/* блок под заголовком «прилипает» и при прокрутке вниз уезжает под заголовок (без скачков списка) */}
      <div className="sl-sub" ref={wrap}>
        {query === null && (
          <div ref={sub} className="sl-sub-inner">
            <button className="continue" onClick={() => (lastRead ? nav(`/read/${lastRead.s}?a=${lastRead.a}`) : nav('/read/1'))}>
              <div className="t">
                <b>{last ? 'Продолжить чтение' : 'Начать чтение'}</b>
                <span>{last && lastRead ? `${last.name} · аят ${lastRead.a} · стр. ${lastRead.p}` : 'Аль-Фатиха · стр. 1'}</span>
              </div>
              <div className="go"><Icon id="play" /></div>
            </button>
            <div className="sortseg">
              <button className={sort === 'mushaf' ? 'on' : ''} onClick={() => setSort('mushaf')}>По порядку</button>
              <button className={sort === 'rev' ? 'on' : ''} onClick={() => setSort('rev')}>По ниспосланию</button>
            </div>
          </div>
        )}
        <div className="sl-chips">
          <button className={'chip' + (place === 'all' ? ' on' : '')} onClick={() => setPlace('all')}>Все <i>{counts.all}</i></button>
          <button className={'chip' + (place === 'mk' ? ' on' : '')} onClick={() => setPlace('mk')}>Мекканские <i>{counts.mk}</i></button>
          <button className={'chip' + (place === 'md' ? ' on' : '')} onClick={() => setPlace('md')}>Мединские <i>{counts.md}</i></button>
        </div>
      </div>

      {!meta && <div className="loading">Загрузка…</div>}
      {meta && list.length === 0 && <div className="empty">Ничего не найдено</div>}
      {list.map((s) => (
        <SurahRow key={s.id} s={s} sort={sort} current={lastRead?.s === s.id} onClick={() => nav(`/read/${s.id}`)} />
      ))}
      <TabBar />
    </div>
  )
}
