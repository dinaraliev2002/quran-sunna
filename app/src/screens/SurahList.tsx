import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { haptic } from '../lib/telegram'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Tour } from '../components/Tour'
import { plural, SurahRow, TabBar, useQuranMeta } from '../components/ui'
import { loadSurah, surahByPage, surahGlyph, TOTAL_PAGES } from '../lib/data'
import { useAsbabIndex } from './reader/Asbab'
import { setStoryMode, useStoryMode, type StoryMode } from '../lib/storyMode'
import { useKulievIndex } from './reader/Kuliev'
import { MODE_LABEL, modeSurahs } from './Stories'
import { useStore } from '../store/settings'

type Place = 'all' | 'mk' | 'md'

// Запоминаем место в списке, сортировку и фильтр — при возврате из суры список открывается там же
const memory = { top: 0, offset: 0, sort: 'mushaf' as 'mushaf' | 'rev' | 'stories', place: 'all' as Place }

export default function SurahList() {
  const nav = useNavigate()
  const meta = useQuranMeta()
  const ix = useAsbabIndex()
  const kx = useKulievIndex()
  const mode = useStoryMode(!!kx)
  const lastRead = useStore((s) => s.lastRead)
  const storyLast = useStore((s) => s.storyLast)
  const [sort, setSortState] = useState(memory.sort)
  const [place, setPlaceState] = useState<Place>(memory.place)
  const [query, setQuery] = useState<string | null>(null)
  const screen = useRef<HTMLDivElement>(null)
  const sub = useRef<HTMLDivElement>(null)
  const lastTop = useRef(0)
  const wrap = useRef<HTMLDivElement>(null)
  const offset = useRef(0) // на сколько пикселей уехал верхний блок
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [modeMenu, setModeMenu] = useState(false)
  const press = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longPressed = useRef(false)
  const setSort = (v: typeof sort) => { memory.sort = v; setSortState(v) }
  const setPlace = (v: Place) => { memory.place = v; setPlaceState(v) }

  const list = useMemo(() => {
    if (!meta) return []
    let l = meta.surahs.filter((s) => place === 'all' || (place === 'mk') === s.mk)
    if (sort === 'stories') { const has = new Set(modeSurahs(ix, kx, mode)); l = l.filter((s) => has.has(s.id)) }
    if (query) {
      const q = query.trim().toLowerCase().replace(/[-\s]/g, '')
      l = l.filter((s) => String(s.id) === q || s.name.toLowerCase().replace(/[-\s]/g, '').includes(q) || s.meaning.toLowerCase().includes(q))
    }
    return sort === 'rev' ? [...l].sort((a, b) => a.rev - b.rev) : l
  }, [meta, sort, place, query, ix, kx, mode])

  // поиск числом: страница мусхафа 1–604
  const num = query && /^\d{1,3}$/.test(query.trim()) ? Number(query.trim()) : 0
  const page = num >= 1 && num <= TOTAL_PAGES ? num : 0
  // открываем на первом аяте этой страницы — так и режим «Сура» прокрутит куда нужно
  async function openPage(p: number) {
    const s = surahByPage(meta!.surahs, p)
    const ayahs = await loadSurah(s.id)
    const a = ayahs.find((x) => x.p >= p) ?? ayahs[0]
    nav(`/read/${s.id}?a=${a.n}&p=${p}`)
  }

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

  // во вкладке «Истории» считаем только суры, у которых есть истории
  const storyIds = new Set(modeSurahs(ix, kx, mode))
  const pool = meta ? meta.surahs.filter((s) => sort !== 'stories' || storyIds.has(s.id)) : []
  const counts = meta ? { all: pool.length, mk: pool.filter((s) => s.mk).length, md: pool.filter((s) => !s.mk).length } : { all: 114, mk: 0, md: 0 }
  const last = lastRead && meta ? meta.surahs[lastRead.s - 1] : null
  const lastStory = storyLast && meta ? meta.surahs[storyLast.s - 1] : null

  return (
    <div className="screen sl" ref={screen} onScroll={onScroll}>
      <div className="sticky-title">
        {query === null ? <h1>Коран</h1> : (
          <div className="search" style={{ flex: 1, margin: '0 12px 0 0' }}>
            <Icon id="search" />
            <input autoFocus placeholder="Сура или номер страницы" value={query} onChange={(e) => setQuery(e.target.value)} />
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
            {sort === 'stories' ? (
              // во вкладке «Истории» — своё место чтения, по историям аятов
              <button className="continue" onClick={() => nav(storyLast ? `/stories/${storyLast.s}?a=${storyLast.a}` : `/stories/${modeSurahs(ix, kx, mode)[0] ?? 1}`)}>
                <div className="t">
                  <b>{lastStory ? 'Продолжить чтение' : 'Начать чтение'}</b>
                  <span>{lastStory && storyLast ? `${lastStory.name} · аят ${storyLast.a}` : mode === 'kv' ? 'Комментарии с первой суры' : mode === 'st' ? 'Истории аятов с первой суры' : 'Истории и комментарии с первой суры'}</span>
                </div>
                <div className="go"><Icon id="play" /></div>
              </button>
            ) : (
              <button className="continue" onClick={() => (lastRead ? nav(`/read/${lastRead.s}?a=${lastRead.a}&hl=1`) : nav('/read/1'))}>
                <div className="t">
                  <b>{last ? 'Продолжить чтение' : 'Начать чтение'}</b>
                  <span>{last && lastRead ? `${last.name} · аят ${lastRead.a} · стр. ${lastRead.p}` : 'Аль-Фатиха · стр. 1'}</span>
                </div>
                <div className="go"><Icon id="play" /></div>
              </button>
            )}
            <div className="sortseg">
              <button className={sort === 'mushaf' ? 'on' : ''} onClick={() => setSort('mushaf')}>По порядку</button>
              <button className={sort === 'rev' ? 'on' : ''} onClick={() => setSort('rev')}>По ниспосланию</button>
              <button className={sort === 'stories' ? 'on' : ''}
                onPointerDown={() => { longPressed.current = false; if (kx) press.current = setTimeout(() => { longPressed.current = true; haptic.tap(); setModeMenu(true) }, 450) }}
                onPointerUp={() => clearTimeout(press.current)} onPointerLeave={() => clearTimeout(press.current)} onPointerCancel={() => clearTimeout(press.current)}
                onContextMenu={(e) => { e.preventDefault(); if (kx) setModeMenu(true) }}
                onClick={() => { if (longPressed.current) return; if (sort === 'stories' && kx) setModeMenu(true); else setSort('stories') }}>
                Истории{sort === 'stories' && kx && <Icon id="up" className="icon modechev" />}
              </button>
              {modeMenu && kx && (
                <>
                  <div className="modemenu-bg" onClick={() => setModeMenu(false)} />
                  <div className="modemenu">
                    {(['all', 'st', 'kv'] as StoryMode[]).map((m) => (
                      <button key={m} className={mode === m ? 'on' : ''} onClick={() => { haptic.tap(); setStoryMode(m); setSort('stories'); setModeMenu(false) }}>
                        {MODE_LABEL[m]}{mode === m && <Icon id="check" className="icon" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
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
      {/* число 1–604 — это и страница мусхафа: она первой строкой, а сура с этим номером (до 114) — ниже */}
      {meta && page > 0 && (
        <button className="jrow" onClick={() => openPage(page)}>
          <div className="num-badge"><span>{page}</span></div>
          <b>Страница {page}</b><span>{surahByPage(meta.surahs, page).name}</span>
        </button>
      )}
      {meta && list.length === 0 && !page && <div className="empty">Ничего не найдено</div>}
      {sort !== 'stories' && list.map((s) => (
        <SurahRow key={s.id} s={s} sort={sort} current={lastRead?.s === s.id} onClick={() => nav(`/read/${s.id}`)} />
      ))}
      {/* «Истории»: только суры, у которых есть истории ниспослания, — читать их подряд */}
      {sort === 'stories' && list.map((s) => {
        const n = mode === 'kv' ? 0 : ix?.n?.[s.id] ?? 0
        const w = mode === 'kv' ? 0 : ix?.w?.[s.id] ?? 0
        const k = mode === 'st' ? 0 : kx?.s[s.id]?.n.length ?? 0
        const parts = [
          n ? `${n} ${plural(n, 'история', 'истории', 'историй')}` : '',
          w ? 'история суры' : '',
          k ? `${k} ${plural(k, 'комментарий', 'комментария', 'комментариев')}` : (mode !== 'st' && kx?.s[s.id]?.intro ? 'вступление' : ''),
        ].filter(Boolean)
        return (
          <button key={s.id} className="srow" onClick={() => nav(`/stories/${s.id}`)}>
            <div className="num-badge"><span>{s.id}</span></div>
            <div className="t">
              <b>{s.name}</b>
              <span>{parts.join(' · ')}</span>
            </div>
            <div className="r">
              <span className="sname">{surahGlyph(s.id)}</span>
              <span className={'tag ' + (s.mk ? 'mk' : 'md')}>{s.mk ? 'Мекканская' : 'Мединская'}</span>
            </div>
          </button>
        )
      })}
      <TabBar />
      {query === null && <Tour id="quran" ready={!!meta} steps={[
        { el: '.sl .continue', title: 'Продолжить чтение', text: 'Открывает Коран там, где вы остановились.' },
        { el: '.sl .sortseg', title: 'Порядок сур', text: 'По порядку мусхафа или по ниспосланию. «Истории» — читать подряд истории ниспослания и комментарии. Зажмите эту кнопку (или нажмите на неё ещё раз) — можно выбрать: всё вместе, только истории или только комментарии.' },
        { el: '.sl .sticky-title .icon-btn', title: 'Поиск', text: 'Найдите суру по названию или номеру. Введите число — откроется и страница мусхафа с этим номером.' },
        { el: '.sl-chips', title: 'Мекканские и мединские', text: 'Показать только суры, ниспосланные в Мекке или в Медине.' },
      ]} />}
    </div>
  )
}
