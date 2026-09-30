import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural, TabBar } from '../../components/ui'
import { CATEGORY_ICON, chapterTitle, loadAzkar, type AzkarData } from '../../lib/azkar'
import { useChapterProgress } from './Azkar'

// Группа азкаров (например, «Путешествие») → список её разделов
export default function Category() {
  const nav = useNavigate()
  const { id } = useParams()
  const [data, setData] = useState<AzkarData | null>(null)
  const progress = useChapterProgress(data)
  useEffect(() => { loadAzkar().then(setData) }, [])

  const cat = data?.categories.find((c) => c.id === Number(id))
  const chapters = data?.chapters.filter((c) => c.cat === Number(id)) ?? []

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{cat?.name ?? 'Азкары'}</b><span>{chapters.length} {plural(chapters.length, 'раздел', 'раздела', 'разделов')}</span></div>
        <span className="icon-btn ghost"><Icon id={CATEGORY_ICON[Number(id)] ?? 'star'} /></span>
      </div>
      {!data && <div className="loading">Загрузка…</div>}
      {chapters.map((c) => {
        const p = progress(c.id)
        return (
          <button key={c.id} className="list-item" onClick={() => nav(`/azkar/ch/${c.id}`)}>
            <div className="t"><b>{chapterTitle(c)}</b><span>{c.items.length} {plural(c.items.length, 'мольба', 'мольбы', 'мольб')}</span></div>
            {p.done > 0 ? <span className="az-count">{p.done}/{p.total}</span> : <Icon id="right" className="icon chev-s" />}
          </button>
        )
      })}
      <TabBar />
    </div>
  )
}
