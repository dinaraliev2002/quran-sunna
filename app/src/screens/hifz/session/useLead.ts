import { useEffect, useState } from 'react'
import { loadSurah } from '../../../lib/data'
import { coveredAyahs } from '../../../lib/hifzQuran'
import { useStore } from '../../../store/settings'
import { type Ayah } from '../../../types/quran'
import { type QItem } from '../../../types/hifzQuran'

/** Связка для «цепочки»: последний аят прошлого (уже выученного) отрывка, который стоит прямо перед новым. null — связки нет */
export function useLead(item: QItem): Ayah | null {
  const cards = useStore((s) => s.qhifz)
  const [lead, setLead] = useState<Ayah | null>(null)
  const prev = item.a - 1
  const has = prev >= 1 && coveredAyahs(cards, item.s).has(prev)
  useEffect(() => {
    setLead(null)
    if (has) loadSurah(item.s).then((ay) => setLead(ay[prev - 1] ?? null))
  }, [item.s, prev, has])
  return lead
}
