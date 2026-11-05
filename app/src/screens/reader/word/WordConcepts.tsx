import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadConceptWords, loadConcepts } from '../../../lib/concepts'
import { rememberReaderSpot } from '../../../lib/readerSpot'
import { useWordSheet } from '../../../store/wordSheet'
import type { Concept } from '../../../types/concepts'
import type { WordTarget } from '../../../types/morph'

/** В «Разборе»: если слово — человек, место, животное и т. п., кнопка «Понятие: …» ведёт в раздел «Понятия» */
export function WordConcepts({ target }: { target: WordTarget }) {
  const nav = useNavigate()
  const close = useWordSheet((s) => s.close)
  const [list, setList] = useState<Concept[]>([])
  useEffect(() => {
    let alive = true
    Promise.all([loadConceptWords(), loadConcepts()]).then(([w, all]) => {
      const ids = w?.[`${target.s}:${target.a}:${target.w}`] ?? []
      if (alive) setList(ids.map((i) => all?.find((c) => c.i === i)).filter((c): c is Concept => !!c))
    })
    return () => { alive = false }
  }, [target.s, target.a, target.w])
  if (!list.length) return null
  return (
    <div className="wd-concept">
      {list.map((c) => <button key={c.i} onClick={() => { rememberReaderSpot(target.s, target.a, false); close(); nav('/words', { state: { concept: c.i } }) }}>Понятие: {c.ru}</button>)}
    </div>
  )
}
