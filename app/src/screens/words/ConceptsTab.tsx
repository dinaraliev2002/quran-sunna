import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { loadConcepts } from '../../lib/concepts'
import { plural } from '../../lib/plural'
import type { Concept } from '../../types/concepts'

const SHOW = 60 // сколько аятов показываем сразу

/** Вкладка «Понятия»: люди, места, существа, растения и предметы Корана — где о каждом говорится */
export function ConceptsTab({ focus }: { focus?: string | null }) {
  const nav = useNavigate()
  const [list, setList] = useState<Concept[] | null | undefined>(undefined)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [open, setOpen] = useState<string | null>(focus ?? null)
  const [all, setAll] = useState(false)
  useEffect(() => { loadConcepts().then(setList) }, [])

  const cats = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of list ?? []) { const k = c.c[0] ?? 'Другое'; n.set(k, (n.get(k) ?? 0) + 1) }
    return [...n].sort((a, b) => b[1] - a[1])
  }, [list])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list ?? []).filter((c) => (!cat || (c.c[0] ?? 'Другое') === cat) && (!s || c.ru.toLowerCase().includes(s) || c.en.toLowerCase().includes(s) || c.ar.includes(q.trim())))
  }, [list, q, cat])

  useEffect(() => {
    if (!focus || !list) return
    setOpen(focus)
    requestAnimationFrame(() => document.getElementById('cn-' + focus)?.scrollIntoView({ block: 'start' }))
  }, [focus, list])

  if (list === undefined) return <div className="loading">Загрузка…</div>
  if (!list) return <div className="empty">Не удалось загрузить понятия</div>

  return (
    <>
      <div className="search" style={{ margin: '0 0 8px' }}>
        <Icon id="search" />
        <input placeholder="Муса, Мекка, верблюд…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="fw-chips">
        <button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>Все · {list.length}</button>
        {cats.map(([k, n]) => <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{k} · {n}</button>)}
      </div>
      {shown.length === 0 && <div className="empty">Ничего не найдено</div>}
      {shown.map((c) => {
        const isOpen = open === c.i
        const refs = isOpen && !all ? c.v.slice(0, SHOW) : c.v
        return (
          <div className={'gl-item' + (isOpen ? ' open' : '')} key={c.i} id={'cn-' + c.i}>
            <button className="gl-head" onClick={() => { setOpen(isOpen ? null : c.i); setAll(false) }} aria-expanded={isOpen}>
              <b>{c.ru}</b>
              <span className="gl-ar">{c.ar}</span>
              <Icon id="right" className="icon chev-s" />
            </button>
            {isOpen && (
              <div className="gl-card">
                <div className="gl-big" dir="rtl">{c.ar}</div>
                <b className="gl-name">{c.ru}</b>
                {c.c.length > 0 && <span className="gl-tag">{c.c.join(' · ').toUpperCase()}</span>}
                {c.d && <p className="gl-mean">{c.d}</p>}
                <p className="wd-note">
                  Упоминается в {c.v.length} {plural(c.v.length, 'аяте', 'аятах', 'аятах')}
                  {c.n > c.v.length ? ` (${c.n} ${plural(c.n, 'слово', 'слова', 'слов')})` : ''}.
                  {c.n > 600 ? ' Показаны первые.' : ''}
                </p>
                <div className="wd-refs">
                  {refs.map((k) => <button key={k} onClick={() => { const [s, a] = k.split(':'); nav(`/read/${s}?a=${a}&from=link`) }}>{k}</button>)}
                  {!all && c.v.length > SHOW && <button className="more" onClick={() => setAll(true)}>ещё {c.v.length - SHOW}</button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
