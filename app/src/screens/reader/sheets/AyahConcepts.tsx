import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { conceptsOfAyah, loadConcepts } from '../../../lib/concepts'
import type { Concept } from '../../../types/concepts'

/** «О ком и о чём в аяте»: понятия (люди, места, существа…) из этого аята; нажатие открывает их в разделе «Слова Корана» */
export function AyahConcepts({ surah, ayah }: { surah: number; ayah: number }) {
  const nav = useNavigate()
  const [list, setList] = useState<Concept[] | null>(null)
  useEffect(() => { loadConcepts().then((c) => setList(c ? conceptsOfAyah(c, `${surah}:${ayah}`) : [])) }, [surah, ayah])
  if (!list?.length) return null
  return (
    <>
      <div className="as-label">О ком и о чём в аяте</div>
      <div className="fw-chips">
        {list.slice(0, 12).map((c) => <button key={c.i} onClick={() => nav('/words', { state: { concept: c.i } })}>{c.ru}</button>)}
      </div>
    </>
  )
}
