import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { SurahRow, TabBar, useQuranMeta } from '../components/ui'
import { useStore } from '../store/settings'

type Place = 'all' | 'mk' | 'md'

export default function SurahList() {
  const nav = useNavigate()
  const meta = useQuranMeta()
  const lastRead = useStore((s) => s.lastRead)
  const [sort, setSort] = useState<'mushaf' | 'rev'>('mushaf')
  const [place, setPlace] = useState<Place>('all')
  const [query, setQuery] = useState<string | null>(null)

  const list = useMemo(() => {
    if (!meta) return []
    let l = meta.surahs.filter((s) => place === 'all' || (place === 'mk') === s.mk)
    if (query) {
      const q = query.trim().toLowerCase().replace(/[-\s]/g, '')
      l = l.filter((s) => String(s.id) === q || s.name.toLowerCase().replace(/[-\s]/g, '').includes(q) || s.meaning.toLowerCase().includes(q))
    }
    return sort === 'rev' ? [...l].sort((a, b) => a.rev - b.rev) : l
  }, [meta, sort, place, query])

  const counts = meta ? { all: 114, mk: meta.surahs.filter((s) => s.mk).length, md: meta.surahs.filter((s) => !s.mk).length } : { all: 114, mk: 0, md: 0 }
  const last = lastRead && meta ? meta.surahs[lastRead.s - 1] : null

  return (
    <div className="screen sl">
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

      {query === null && (
        <>
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
        </>
      )}

      <div className="sticky-chips">
        <button className={'chip' + (place === 'all' ? ' on' : '')} onClick={() => setPlace('all')}>Все <i>{counts.all}</i></button>
        <button className={'chip' + (place === 'mk' ? ' on' : '')} onClick={() => setPlace('mk')}>Мекканские <i>{counts.mk}</i></button>
        <button className={'chip' + (place === 'md' ? ' on' : '')} onClick={() => setPlace('md')}>Мединские <i>{counts.md}</i></button>
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
