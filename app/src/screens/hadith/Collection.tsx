import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural, TabBar } from '../../components/ui'
import { loadHadithIndex, type HIndex } from '../../lib/hadith'
import { useStore } from '../../store/settings'

const scrollMemory = new Map<string, number>()

// Сборник → список книг (аль-Бухари) или глав (Рияд ас-Салихин)
export default function Collection() {
  const nav = useNavigate()
  const { cid = '' } = useParams()
  const [idx, setIdx] = useState<HIndex | null>(null)
  const last = useStore((s) => s.hadithLast)
  const screen = useRef<HTMLDivElement>(null)
  useEffect(() => { loadHadithIndex().then(setIdx) }, [])
  useLayoutEffect(() => { if (idx && screen.current) screen.current.scrollTop = scrollMemory.get(cid) ?? 0 }, [idx, cid])

  const c = idx?.collections.find((x) => x.id === cid)
  // 40 хадисов ан-Навави — одна «книга»: сразу открываем хадисы
  if (c && c.books.length === 1) return <Navigate to={`/hadith/c/${cid}/1`} replace />
  const unit: [string, string, string] = cid === 'bukhari' ? ['книга', 'книги', 'книг'] : ['глава', 'главы', 'глав']

  return (
    <div className="screen" ref={screen} onScroll={(e) => scrollMemory.set(cid, e.currentTarget.scrollTop)}>
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{c?.name ?? 'Хадисы'}</b><span>{c ? `${c.books.length} ${plural(c.books.length, ...unit)}` : ''}</span></div>
        <span style={{ width: 44 }} />
      </div>
      {!c && <div className="loading">Загрузка…</div>}
      {c && (
        <>
          <div className="hd-cover">
            <div className="hd-cover-ar">{c.ar}</div>
            <p>{c.about}</p>
            <span>{c.author} · {c.hadiths.toLocaleString('ru-RU')} {plural(c.hadiths, 'хадис', 'хадиса', 'хадисов')}</span>
          </div>
          {c.books.map((b, k) => (
            <Fragment key={b.n}>
            {b.sec && b.sec !== c.books[k - 1]?.sec && <div className="hd-sec-h">{b.sec}</div>}
            <button className={'hd-book' + (last?.c === cid && last.n === b.n ? ' cur' : '')} onClick={() => nav(`/hadith/c/${cid}/${b.n}`)}>
              <div className="num-badge"><span>{b.no || '•'}</span></div>
              <div className="t">
                <b>{b.title}</b>
                <span>{b.range ? `Хадисы ${b.range}` : b.intro ? 'Вступление' : `${b.count} ${plural(b.count, 'раздел', 'раздела', 'разделов')}`}</span>
              </div>
              {b.ar && <div className="hd-book-ar">{b.ar.replace(/^[٠-٩\d]+\s*[-–]\s*/, '')}</div>}
            </button>
            </Fragment>
          ))}
        </>
      )}
      <TabBar />
    </div>
  )
}
