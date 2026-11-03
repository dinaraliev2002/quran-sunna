import { useEffect, useState } from 'react'
import { loadChains, loadLinks, loadSahabi } from '../lib/narrators'
import type { NarratorLink } from '../types/narrators'

/** Цепочка хадиса: у Бухари и Муслима — своя, у ан-Навави и «Рияда» — из первоисточника; плюс сподвижник. undefined — грузится, null — нет */

export function useNarratorLink(cid: string, bn: number, i: number): NarratorLink | undefined {
  const [link, setLink] = useState<NarratorLink | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const k = `${bn}:${i}`
    setLink(undefined)
    if (cid === 'bukhari' || cid === 'muslim') loadChains(cid).then((c) => alive && setLink(c[k] ? { chain: c[k] } : null))
    else if (cid === 'riyad' || cid === 'nawawi') Promise.all([loadSahabi(cid), loadLinks(cid)]).then(([s, l]) => {
      if (!alive) return
      const v: NonNullable<NarratorLink> = {}
      if (s[k]) v.sahabi = { id: s[k][0], sure: !!s[k][1] }
      if (l[k]) { v.chain = l[k][2]; v.src = [l[k][0], l[k][1]] }
      setLink(v.chain || v.sahabi ? v : null)
    })
    else setLink(null)
    return () => { alive = false }
  }, [cid, bn, i])
  return link
}
