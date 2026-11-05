import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { buildTopicTree, loadTopics, topicPath, type TopicTree } from '../../lib/topics'
import { POPULAR_TOPICS, TOPIC_TILES } from '../../lib/topicTiles'
import { plural } from '../../lib/plural'
import type { Topic } from '../../types/concepts'
import { ConceptVerses } from './ConceptVerses'

const SHOW = 60 // сколько номеров аятов показываем сразу
interface View { title: string; ids: number[]; crumb?: string }

/** Вкладка «Темы»: о чём говорит Коран. Плитки разделов, поиск и «Часто ищут»; внутри раздела — подтемы с аятами (тематический указатель QUL) */
export function TopicsTab({ focus }: { focus?: number | null }) {
  const [list, setList] = useState<Topic[] | null | undefined>(undefined)
  const [q, setQ] = useState('')
  const [view, setView] = useState<View | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set())
  useEffect(() => { loadTopics().then(setList) }, [])
  const tree = useMemo(() => (list ? buildTopicTree(list) : null), [list])

  const show = (v: View, expand: number[] = []) => { setView(v); setOpen(new Set(expand)); setQ(''); window.scrollTo?.(0, 0); document.querySelector('.screen.words')?.scrollTo({ top: 0 }) }

  // пришли из аята: показываем эту тему, с путём до неё
  useEffect(() => {
    if (!focus || !tree) return
    const t = tree.byId.get(focus)
    if (!t) return
    const path = topicPath(tree, focus)
    show({ title: t.ru, ids: [focus], crumb: path.slice(0, -1).map((x) => x.ru).join(' › ') }, [focus])
  }, [focus, tree])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/ё/g, 'е')
    if (!s || !list || !tree) return null
    return list.filter((t) => t.ru.toLowerCase().replace(/ё/g, 'е').includes(s)).slice(0, 40)
  }, [q, list, tree])

  if (list === undefined) return <div className="loading">Загрузка…</div>
  if (!list || !tree) return <div className="empty">Не удалось загрузить темы</div>

  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n })
  const exists = (id: number) => tree.byId.has(id)

  // ===== внутри раздела =====
  if (view) {
    return (
      <>
        <button className="tp-back" onClick={() => setView(null)}><Icon id="back" />Все темы</button>
        {view.crumb && <div className="tp-crumb">{view.crumb}</div>}
        <h3 className="tp-title">{view.title}</h3>
        {view.ids.filter(exists).map((id) => <TopicNode key={id} t={tree.byId.get(id)!} tree={tree} depth={0} open={open} toggle={toggle} />)}
      </>
    )
  }

  // ===== главный экран =====
  return (
    <>
      <div className="search" style={{ margin: '0 0 8px' }}>
        <Icon id="search" />
        <input placeholder="Терпение, развод, молитва…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {results ? (
        <>
          {results.length === 0 && <div className="empty">Ничего не найдено</div>}
          {results.map((t) => {
            const n = tree.total(t.i).length
            const path = topicPath(tree, t.i)
            return (
              <button key={t.i} className="tp-res" onClick={() => show({ title: t.ru, ids: [t.i], crumb: path.slice(0, -1).map((x) => x.ru).join(' › ') }, [t.i])}>
                <b>{t.ru}</b>
                <span>{path.slice(-3, -1).map((x) => x.ru).join(' › ') || 'Раздел'}{n ? ` · ${n} ${plural(n, 'аят', 'аята', 'аятов')}` : ''}</span>
              </button>
            )
          })}
        </>
      ) : (
        <>
          <div className="group-t">Часто ищут</div>
          <div className="fw-chips">
            {POPULAR_TOPICS.filter((p) => exists(p.id)).map((p) => (
              <button key={p.id} onClick={() => show({ title: tree.byId.get(p.id)!.ru, ids: [p.id], crumb: topicPath(tree, p.id).slice(0, -1).map((x) => x.ru).join(' › ') }, [p.id])}>{p.label}</button>
            ))}
          </div>
          <div className="group-t">Разделы</div>
          <div className="tp-tiles">
            {TOPIC_TILES.map((t) => {
              const ids = t.ids.filter(exists)
              const n = new Set(ids.flatMap((i) => tree.total(i))).size
              return (
                <button key={t.title} className="tp-tile" onClick={() => show({ title: t.title, ids }, ids.length === 1 ? [ids[0]] : [])}>
                  <span className="tp-ic"><Icon id={t.icon} /></span>
                  <b>{t.title}</b>
                  <span>{n} {plural(n, 'аят', 'аята', 'аятов')}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function TopicNode({ t, tree, depth, open, toggle }: { t: Topic; tree: TopicTree; depth: number; open: Set<number>; toggle: (id: number) => void }) {
  const nav = useNavigate()
  const [all, setAll] = useState(false)
  const kids = tree.kids.get(t.i) ?? []
  const isOpen = open.has(t.i)
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
          {kids.map((k) => <TopicNode key={k.i} t={k} tree={tree} depth={depth + 1} open={open} toggle={toggle} />)}
        </div>
      )}
    </div>
  )
}
