import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { buildTopicTree, loadTopics, topicPath, type TopicTree } from '../../lib/topics'
import { plural } from '../../lib/plural'
import type { Topic } from '../../types/concepts'
import { ConceptVerses } from './ConceptVerses'

const SHOW = 60 // сколько номеров аятов показываем сразу

/** Вкладка «Темы»: о чём говорит Коран — разделы и подтемы с аятами (тематический указатель QUL) */
export function TopicsTab({ focus }: { focus?: number | null }) {
  const [list, setList] = useState<Topic[] | null | undefined>(undefined)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<number>>(new Set())
  useEffect(() => { loadTopics().then(setList) }, [])
  const tree = useMemo(() => (list ? buildTopicTree(list) : null), [list])

  // пришли из аята: раскрываем всю цепочку до нужной темы
  useEffect(() => {
    if (!focus || !tree) return
    setOpen(new Set(topicPath(tree, focus).map((t) => t.i)))
    requestAnimationFrame(() => document.getElementById('tp-' + focus)?.scrollIntoView({ block: 'start' }))
  }, [focus, tree])

  // поиск: какие темы подходят сами или через подтемы
  const match = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/ё/g, 'е')
    if (!s || !tree) return null
    const ok = new Set<number>()
    for (const t of list ?? []) {
      if (!t.ru.toLowerCase().replace(/ё/g, 'е').includes(s)) continue
      for (const p of topicPath(tree, t.i)) ok.add(p.i)
    }
    return ok
  }, [q, tree, list])

  if (list === undefined) return <div className="loading">Загрузка…</div>
  if (!list || !tree) return <div className="empty">Не удалось загрузить темы</div>

  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n })
  const roots = tree.kids.get(0) ?? []
  return (
    <>
      <div className="search" style={{ margin: '0 0 8px' }}>
        <Icon id="search" />
        <input placeholder="Терпение, развод, молитва…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="wd-note">О чём говорит Коран: разделы и подтемы, у каждой — аяты. Нажмите на тему, чтобы раскрыть.</p>
      {match && match.size === 0 && <div className="empty">Ничего не найдено</div>}
      {roots.map((t) => <TopicNode key={t.i} t={t} tree={tree} depth={0} open={open} toggle={toggle} match={match} />)}
    </>
  )
}

function TopicNode({ t, tree, depth, open, toggle, match }: { t: Topic; tree: TopicTree; depth: number; open: Set<number>; toggle: (id: number) => void; match: Set<number> | null }) {
  const nav = useNavigate()
  const [all, setAll] = useState(false)
  if (match && !match.has(t.i)) return null
  const kids = tree.kids.get(t.i) ?? []
  const isOpen = open.has(t.i) || (!!match && kids.some((k) => match.has(k.i)))
  const n = tree.total(t.i).length
  const refs = all ? t.a : t.a.slice(0, SHOW)
  return (
    <div className={'tp-node' + (depth ? ' sub' : '')} id={'tp-' + t.i}>
      <button className={'tp-head' + (isOpen ? ' open' : '')} onClick={() => toggle(t.i)} aria-expanded={isOpen}>
        <b>{t.ru}</b>
        {n > 0 && <span>{n} {plural(n, 'аят', 'аята', 'аятов')}</span>}
        <Icon id="right" className="icon chev-s" />
      </button>
      {isOpen && (
        <div className="tp-body">
          {t.a.length > 0 && (
            <>
              <ConceptVerses refs={t.a.slice(0, 3)} />
              {t.a.length > 3 && (
                <div className="wd-refs" style={{ marginTop: 8 }}>
                  {refs.map((k) => <button key={k} onClick={() => { const [s, a] = k.split(':'); nav(`/read/${s}?a=${a}&from=link`) }}>{k}</button>)}
                  {!all && t.a.length > SHOW && <button className="more" onClick={() => setAll(true)}>ещё {t.a.length - SHOW}</button>}
                </div>
              )}
            </>
          )}
          {kids.map((k) => <TopicNode key={k.i} t={k} tree={tree} depth={depth + 1} open={open} toggle={toggle} match={match} />)}
        </div>
      )}
    </div>
  )
}
