import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VERB_FORMS } from '../../lib/morphLabels'
import { EMPTY_FILTER, hasFilter, searchForms, type GrammarFilter } from '../../lib/grammarSearch'
import { loadRoots } from '../../lib/morph'
import { plural } from '../../lib/plural'
import type { RootIndex } from '../../types/morph'

type Opt = [string, string]
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
type Key = Exclude<keyof GrammarFilter, 'pass'>

const GROUPS: { k: Key; title: string; show?: (f: GrammarFilter) => boolean; opts: Opt[] }[] = [
  { k: 'pos', title: 'Часть речи', opts: [['V', 'Глагол'], ['N', 'Имя']] },
  { k: 'form', title: 'Порода глагола', show: (f) => f.pos !== 'N', opts: ROMAN.map((r, i): Opt => [String(i + 1), r]) },
  { k: 'tense', title: 'Время', show: (f) => f.pos !== 'N', opts: [['PERF', 'Прошедшее'], ['IMPF', 'Настоящее / будущее'], ['IMPV', 'Повелительное']] },
  { k: 'mood', title: 'Наклонение', show: (f) => f.pos !== 'N' && f.tense !== 'PERF', opts: [['IND', 'Изъявительное'], ['SUBJ', 'Сослагательное'], ['JUS', 'Усечённое']] },
  { k: 'kind', title: 'Вид имени', show: (f) => f.pos !== 'V', opts: [['ACT_PCPL', 'Действ. причастие'], ['PASS_PCPL', 'Страдат. причастие'], ['VN', 'Масдар'], ['ADJ', 'Прилагательное'], ['PN', 'Имя собств.']] },
  { k: 'case', title: 'Падеж', show: (f) => f.pos !== 'V', opts: [['NOM', 'Именительный'], ['GEN', 'Родительный'], ['ACC', 'Винительный']] },
  { k: 'person', title: 'Лицо', opts: [['1', '1-е'], ['2', '2-е'], ['3', '3-е']] },
  { k: 'gender', title: 'Род', opts: [['M', 'Мужской'], ['F', 'Женский']] },
  { k: 'number', title: 'Число', opts: [['S', 'Ед.'], ['D', 'Дв.'], ['P', 'Мн.']] },
]

/** Вкладка «Поиск по грамматике»: выбираем признаки — видим все такие формы слов Корана (у слов с корнем) */
export function GrammarTab() {
  const nav = useNavigate()
  const [roots, setRoots] = useState<RootIndex | null | undefined>(undefined)
  const [f, setF] = useState<GrammarFilter>(EMPTY_FILTER)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { loadRoots().then(setRoots) }, [])
  const res = useMemo(() => (roots && hasFilter(f) ? searchForms(roots, f) : null), [roots, f])

  const pick = (k: Key, v: string) => setF((p) => {
    const n = { ...p, [k]: p[k] === v ? '' : v } as GrammarFilter
    if (k === 'pos') { n.form = ''; n.tense = ''; n.mood = ''; n.kind = ''; n.case = ''; n.pass = false } // признаки другой части речи сбрасываем
    return n
  })
  const go = (ref: string) => { const [s, a] = ref.split(':'); nav(`/read/${s}?a=${a}&from=link`) }

  if (roots === undefined) return <div className="loading">Загрузка…</div>
  if (!roots) return <div className="empty">Не удалось загрузить разбор слов</div>
  return (
    <>
      <p className="wd-note">Отметьте признаки, например: глагол · IV порода · прошедшее время. Покажем все такие слова Корана. Ищет среди слов, у которых есть корень (частицы и местоимения не входят).</p>
      {GROUPS.filter((g) => !g.show || g.show(f)).map((g) => (
        <div key={g.k} className="gs-group">
          <div className="wd-sub">{g.title}</div>
          <div className="fw-chips">
            {g.opts.map(([v, label]) => (
              <button key={v} className={f[g.k] === v ? 'on' : ''} onClick={() => pick(g.k, v)} title={g.k === 'form' ? VERB_FORMS[v] : undefined}>{label}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="gs-group">
        <div className="fw-chips">
          {f.pos !== 'N' && <button className={f.pass ? 'on' : ''} onClick={() => setF({ ...f, pass: !f.pass })}>Страдательный залог</button>}
          {hasFilter(f) && <button onClick={() => setF(EMPTY_FILTER)}>Сбросить всё</button>}
        </div>
      </div>
      {res && (
        <>
          <div className="wd-sub">Найдено: {res.total} {plural(res.total, 'слово', 'слова', 'слов')}{res.hits.length < res.total ? ' · самые частые формы' : ''}</div>
          {res.hits.length === 0 && <div className="empty">Таких слов нет</div>}
          {res.hits.map((h) => {
            const k = h.w + h.lemma + h.root
            return (
              <div className="gs-hit" key={k}>
                <button className="gs-main" onClick={() => setOpen(open === k ? null : k)}>
                  <span className="ar" dir="rtl">{h.w}</span>
                  <span className="mid">корень <span className="ar">{h.root}</span></span>
                  <b>{h.n}</b>
                </button>
                {open === k && <div className="wd-refs sm">{h.refs.map((r) => <button key={r} onClick={() => go(r)}>{r}</button>)}</div>}
              </div>
            )
          })}
        </>
      )}
    </>
  )
}
