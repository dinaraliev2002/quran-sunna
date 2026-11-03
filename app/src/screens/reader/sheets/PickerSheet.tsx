import { useMemo, useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead, SurahRow } from '../../../components/ui'
import { surahByPage, TOTAL_PAGES, type Surah } from '../../../lib/data'

export function PickerSheet({ surahs, juzPages, currentSurah, focusSearch, onClose, onSurah, onPage }: {
  surahs: Surah[]; juzPages: number[]; currentSurah: number; focusSearch?: boolean
  onClose: () => void; onSurah: (s: Surah) => void; onPage: (p: number) => void
}) {
  const [tab, setTab] = useState<'s' | 'j' | 'p'>('s')
  const [q, setQ] = useState('')
  const [pageInput, setPageInput] = useState('')
  const list = useMemo(() => {
    const n = q.trim().toLowerCase().replace(/[-\s]/g, '')
    if (!n) return surahs
    return surahs.filter((s) => String(s.id) === n || s.name.toLowerCase().replace(/[-\s]/g, '').includes(n) || s.meaning.toLowerCase().includes(n))
  }, [q, surahs])
  const qNum = /^\d{1,3}$/.test(q.trim()) ? Number(q.trim()) : 0
  const qPage = qNum >= 1 && qNum <= TOTAL_PAGES ? qNum : 0

  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Перейти" onClose={onClose} />
      <div className="sortseg">
        <button className={tab === 's' ? 'on' : ''} onClick={() => setTab('s')}>Суры</button>
        <button className={tab === 'j' ? 'on' : ''} onClick={() => setTab('j')}>Джузы</button>
        <button className={tab === 'p' ? 'on' : ''} onClick={() => setTab('p')}>Страница</button>
      </div>
      {tab === 's' && (
        <>
          <div className="search"><Icon id="search" /><input autoFocus={focusSearch} placeholder="Сура или номер страницы" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="body">
            {/* число 1–604 — это и страница мусхафа */}
            {qPage > 0 && (
              <button className="jrow" onClick={() => onPage(qPage)}>
                <div className="num-badge"><span>{qPage}</span></div>
                <b>Страница {qPage}</b><span>{surahByPage(surahs, qPage).name}</span>
              </button>
            )}
            {list.map((s) => <SurahRow key={s.id} s={s} current={s.id === currentSurah} onClick={() => onSurah(s)} />)}
            {list.length === 0 && !qPage && <div className="empty">Ничего не найдено</div>}
          </div>
        </>
      )}
      {tab === 'j' && (
        <div className="body">
          {juzPages.map((p, i) => {
            const s = [...surahs].reverse().find((x) => x.pages[0] <= p)!
            return (
              <button key={i} className="jrow" onClick={() => onPage(p)}>
                <div className="num-badge"><span>{i + 1}</span></div>
                <b>Джуз {i + 1}</b><span>{s.name} · стр. {p}</span>
              </button>
            )
          })}
        </div>
      )}
      {tab === 'p' && (
        <div className="body">
          <div className="gopage">
            <input inputMode="numeric" placeholder={`1–${TOTAL_PAGES}`} value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            <button className="bigbtn" onClick={() => { const p = Number(pageInput); if (p >= 1 && p <= TOTAL_PAGES) onPage(p) }}>Открыть</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
