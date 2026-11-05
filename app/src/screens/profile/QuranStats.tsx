import { useNavigate } from 'react-router-dom'
import { useQuranMeta } from '../../hooks/useQuranMeta'
import { LEARNED_STAGE } from '../../lib/hifz'
import { parseQKey } from '../../lib/hifzQuran'
import { learnedSurahs } from '../../lib/knownSurahs'
import { plural } from '../../lib/plural'
import { useStore } from '../../store/settings'

const TOTAL_AYAHS = 6236

/** Профиль: сколько сур и аятов заучено наизусть */
export function QuranStats() {
  const nav = useNavigate()
  const cards = useStore((s) => s.qhifz)
  const meta = useQuranMeta()
  const ids = meta ? learnedSurahs(cards, meta.surahs) : []
  let learned = 0, started = 0
  for (const [k, c] of Object.entries(cards)) {
    const p = parseQKey(k)
    if (!p) continue
    const n = p.b - p.a + 1
    started += n
    if (c.s >= LEARNED_STAGE) learned += n
  }
  const names = ids.slice(0, 8).map((s) => meta?.surahs[s - 1]?.name).filter(Boolean).join(', ')
  return (
    <section className="pf-card">
      <div className="pf-ch"><b>Заучивание Корана</b><button onClick={() => nav('/hifz/quran')}>{started ? 'Открыть' : 'Начать'}</button></div>
      <div className="pf-bar two">
        <i className="a" style={{ width: `${(learned / TOTAL_AYAHS) * 100}%` }} />
        {started > learned && <i className="b" style={{ width: `${((started - learned) / TOTAL_AYAHS) * 100}%` }} />}
      </div>
      <div className="pf-kv"><span>Заучено сур</span><b>{ids.length} из 114</b></div>
      <div className="pf-kv"><span>Выучено аятов</span><b>{learned} {plural(learned, 'аят', 'аята', 'аятов')}</b></div>
      {started > learned && <div className="pf-kv"><span>В повторении</span><b>{started - learned} {plural(started - learned, 'аят', 'аята', 'аятов')}</b></div>}
      {ids.length > 0 && <div className="pf-small">{names}{ids.length > 8 ? ` и ещё ${ids.length - 8}` : ''}</div>}
      {started === 0 && <div className="pf-small">Отметьте суры, которые уже знаете, в разделе «Заучивание → Коран».</div>}
    </section>
  )
}
