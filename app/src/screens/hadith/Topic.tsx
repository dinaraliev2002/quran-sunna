import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural, TabBar } from '../../components/ui'
import { snippet } from '../../lib/azkar'
import { loadTopics, TOPIC_ICON, topicTitle, type TopicsData } from '../../lib/hadith'

const scrollMemory = new Map<number, number>()

// Тема «Энциклопедии хадисов»: подтемы и хадисы этой темы
export default function Topic() {
  const nav = useNavigate()
  const tid = Number(useParams().id)
  const [data, setData] = useState<TopicsData | null>(null)
  const screen = useRef<HTMLDivElement>(null)
  useEffect(() => { loadTopics().then(setData) }, [])
  useLayoutEffect(() => { if (data && screen.current) screen.current.scrollTop = scrollMemory.get(tid) ?? 0 }, [data, tid])

  const topic = data?.topics.find((t) => t.id === tid)
  const children = data?.topics.filter((t) => t.parent === tid) ?? []
  const parent = topic?.parent ? data?.topics.find((t) => t.id === topic.parent) : null

  return (
    <div className="screen" ref={screen} onScroll={(e) => scrollMemory.set(tid, e.currentTarget.scrollTop)}>
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{topic ? topicTitle(topic) : 'Темы'}</b><span>{parent ? topicTitle(parent) : topic ? `${topic.count} ${plural(topic.count, 'хадис', 'хадиса', 'хадисов')}` : ''}</span></div>
        <span className="icon-btn ghost"><Icon id={TOPIC_ICON[tid] ?? 'scroll'} /></span>
      </div>
      {!data && <div className="loading">Загрузка…</div>}

      {children.length > 0 && (
        <div className="group">
          {children.map((c) => (
            <button key={c.id} className="sitem" onClick={() => nav(`/hadith/t/${c.id}`)}>
              <span className="t">{c.title}</span>
              <span className="v">{c.count}</span>
              <Icon id="right" className="icon chev" />
            </button>
          ))}
        </div>
      )}

      {topic && topic.ids.length > 0 && (
        <>
          {children.length > 0 && <div className="section-h"><h2>Хадисы темы</h2></div>}
          {topic.ids.map((id, k) => (
            <button key={id} className="az-row" onClick={() => nav(`/hadith/e/${id}?t=${tid}`)}>
              <div className="az-num">{k + 1}</div>
              <div className="t"><b>{snippet(data!.hadiths[id]?.[1] ?? '', 160)}</b></div>
            </button>
          ))}
        </>
      )}
      <TabBar />
    </div>
  )
}
