import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadSurah } from '../../lib/data'
import { useStore } from '../../store/settings'

/** Первые аяты понятия: арабский текст и перевод (по выбранному в настройках) — нажатие открывает аят в чтении */
export function ConceptVerses({ refs }: { refs: string[] }) {
  const nav = useNavigate()
  const tr = useStore((s) => s.translation)
  const [rows, setRows] = useState<{ k: string; ar: string; tr: string }[]>([])
  useEffect(() => {
    let alive = true
    Promise.all(refs.map(async (k) => {
      const [s, a] = k.split(':').map(Number)
      const ayahs = await loadSurah(s).catch(() => null)
      const x = ayahs?.find((y) => y.n === a)
      return x ? { k, ar: x.t, tr: tr === 'aa' ? x.aa : x.ku } : null
    })).then((r) => { if (alive) setRows(r.filter((x): x is { k: string; ar: string; tr: string } => !!x)) })
    return () => { alive = false }
  }, [refs.join(','), tr])
  return (
    <>
      {rows.map((r) => (
        <button key={r.k} className="cn-verse" onClick={() => { const [s, a] = r.k.split(':'); nav(`/read/${s}?a=${a}&from=link`) }}>
          <span className="wd-dim">{r.k}</span>
          <span className="ar" dir="rtl">{r.ar}</span>
          <p>{r.tr}</p>
        </button>
      ))}
    </>
  )
}
