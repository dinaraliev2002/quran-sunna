import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural, TabBar } from '../../components/ui'
import { loadHadithIndex, type HBook, type HGroup, type HIndex } from '../../lib/hadith'
import { useStore } from '../../store/settings'

const scrollMemory = new Map<string, number>()
const stripNum = (ar: string) => ar.replace(/^[٠-٩\d]+\s*[-–]\s*/, '')

// Сборник → список книг (аль-Бухари, Муслим) или глав (Рияд ас-Салихин).
// Книга со вложенными главами («Толкование Корана») — один пункт; её главы — отдельным списком (/g/:g).
export default function Collection() {
  const nav = useNavigate()
  const { cid = '', g } = useParams()
  const grp = Number(g) || 0
  const [idx, setIdx] = useState<HIndex | null>(null)
  const last = useStore((s) => s.hadithLast)
  const screen = useRef<HTMLDivElement>(null)
  const memKey = `${cid}/${grp}`
  useEffect(() => { loadHadithIndex().then(setIdx) }, [])
  useLayoutEffect(() => { if (idx && screen.current) screen.current.scrollTop = scrollMemory.get(memKey) ?? 0 }, [idx, memKey])

  const c = idx?.collections.find((x) => x.id === cid)
  // 40 хадисов ан-Навави — одна «книга»: сразу открываем хадисы
  if (c && c.books.length === 1) return <Navigate to={`/hadith/c/${cid}/1`} replace />
  const group = grp ? c?.groups.find((x) => x.g === grp) : null
  const books = c ? (grp ? c.books.filter((b) => b.grp === grp) : c.books) : []
  const lastBook = last?.c === cid ? c?.books.find((b) => b.n === last.n) : null
  const isBookUnit = cid === 'bukhari' || cid === 'muslim'
  const unit: [string, string, string] = isBookUnit && !grp ? ['книга', 'книги', 'книг'] : ['глава', 'главы', 'глав']
  const topCount = c ? (grp ? books.length : c.books.filter((b) => !b.grp).length + c.groups.length) : 0

  const bookRow = (b: HBook) => (
    <button className={'hd-book' + (lastBook?.n === b.n ? ' cur' : '')} onClick={() => nav(`/hadith/c/${cid}/${b.n}`)}>
      <div className="num-badge"><span>{b.no || '•'}</span></div>
      <div className="t">
        <b>{b.title}</b>
        <span>{b.range ? `Хадисы ${b.range}` : b.intro ? 'Вступление' : `${b.count} ${plural(b.count, 'раздел', 'раздела', 'разделов')}`}</span>
      </div>
      {b.ar && <div className="hd-book-ar">{stripNum(b.ar)}</div>}
    </button>
  )
  const groupRow = (gr: HGroup) => (
    <button className={'hd-book grp' + (lastBook?.grp === gr.g ? ' cur' : '')} onClick={() => nav(`/hadith/c/${cid}/g/${gr.g}`)}>
      <div className="num-badge"><span>{gr.no || '•'}</span></div>
      <div className="t">
        <b>{gr.title}</b>
        <span>{gr.count} {plural(gr.count, 'глава', 'главы', 'глав')}{gr.range ? ` · хадисы ${gr.range}` : ''}</span>
      </div>
      <span className="hd-grp-go"><Icon id="rows" /><Icon id="right" /></span>
    </button>
  )

  return (
    <div className="screen hdb" ref={screen} onScroll={(e) => scrollMemory.set(memKey, e.currentTarget.scrollTop)}>
      <div className="hdb-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl">
          <b>{group?.title ?? c?.name ?? 'Хадисы'}</b>
          <span>{group ? c?.name : c ? `${topCount} ${plural(topCount, ...unit)}` : ''}</span>
        </div>
        <span style={{ width: 44 }} />
      </div>
      {!c && <div className="loading">Загрузка…</div>}
      {c && !group && (
        <div className="hd-cover">
          <div className="hd-cover-ar">{c.ar}</div>
          <p>{c.about}</p>
          <span>{c.author} · {c.hadiths.toLocaleString('ru-RU')} {plural(c.hadiths, 'хадис', 'хадиса', 'хадисов')} с переводом</span>
          {c.part && <em>{c.part}</em>}
        </div>
      )}
      {group && (
        <div className="hd-cover">
          {group.ar && <div className="hd-cover-ar small">{stripNum(group.ar)}</div>}
          <span>{group.count} {plural(group.count, 'глава', 'главы', 'глав')}{group.range ? ` · хадисы ${group.range}` : ''}</span>
        </div>
      )}
      {c && books.map((b, k) => (
        <Fragment key={b.n}>
          {grp || !b.grp ? bookRow(b) : b.grp !== books[k - 1]?.grp && groupRow(c.groups.find((x) => x.g === b.grp)!)}
        </Fragment>
      ))}
      <TabBar />
    </div>
  )
}
