import { useEffect, useMemo, useState } from 'react'
import { loadFreq, loadKnownWords, saveKnownWords } from '../../lib/freqWords'
import { haptic } from '../../lib/telegram'
import { plural } from '../../lib/plural'
import { useWordSheet } from '../../store/wordSheet'
import { Icon } from '../../components/Icon'
import type { FreqData } from '../../types/morph'

const KINDS = [['', 'Все'], ['V', 'Глаголы'], ['N', 'Имена'], ['P', 'Частицы']] as const
const STEP = 50

/** Вкладка «Частые слова»: слова по убыванию частоты, отметка «знаю» и доля текста, которую понимаешь */
export function FreqTab() {
  const [data, setData] = useState<FreqData | null | undefined>(undefined)
  const [known, setKnown] = useState(loadKnownWords)
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('')
  const [limit, setLimit] = useState(STEP)
  const open = useWordSheet((s) => s.open)
  useEffect(() => { loadFreq().then(setData) }, [])

  const stats = useMemo(() => {
    if (!data) return null
    let n = 0, cnt = 0
    for (const w of data.w) if (known.has(w[0])) { n++; cnt += w[3] }
    return { n, pct: Math.round((1000 * cnt) / data.total) / 10 }
  }, [data, known])

  if (data === undefined) return <div className="loading">Загрузка…</div>
  if (!data) return <div className="empty">Не удалось загрузить список слов</div>

  // место в общем списке (по частоте) остаётся прежним, даже если выбран фильтр
  const rows = data.w.map((w, i) => ({ w, rank: i + 1 })).filter((r) => !kind || r.w[2] === kind)
  const toggle = (lemma: string) => {
    haptic.tap()
    const s = new Set(known)
    if (!s.delete(lemma)) s.add(lemma)
    setKnown(s); saveKnownWords(s)
  }
  const go = (ref: string) => { const [s, a, w] = ref.split(':').map(Number); open({ s, a, w }) }

  return (
    <>
      <div className="fw-stat">
        <b>{stats?.n ?? 0}</b>
        <span>{plural(stats?.n ?? 0, 'слово знакомо', 'слова знакомы', 'слов знакомы')} · понимаете ≈ {stats?.pct ?? 0}% слов Корана</span>
      </div>
      <p className="wd-note">Слова идут по частоте. 100 самых частых покрывают 55% текста Корана, 300 — 70%, 1000 — 85%. Нажмите на слово, чтобы увидеть его в аяте, а на галочку — отметить, что знаете.</p>
      <div className="fw-chips">
        {KINDS.map(([id, label]) => <button key={id} className={kind === id ? 'on' : ''} onClick={() => { setKind(id); setLimit(STEP) }}>{label}</button>)}
      </div>
      {rows.slice(0, limit).map(({ w, rank }) => (
        <div className={'fw-row' + (known.has(w[0]) ? ' known' : '')} key={w[0] + w[1] + w[2]}>
          <span className="fw-rank">{rank}</span>
          <button className="fw-main" onClick={() => go(w[5])}>
            <span className="ar fw-ar" dir="rtl">{w[0]}</span>
            <span className="fw-tr">{w[4] || '—'}</span>
          </button>
          <span className="fw-n">{w[3]}</span>
          <button className="fw-ok" onClick={() => toggle(w[0])} aria-label="Знаю это слово"><Icon id="check" /></button>
        </div>
      ))}
      {limit < rows.length && <button className="wd-more" onClick={() => setLimit(limit + STEP)}>Показать ещё</button>}
    </>
  )
}
