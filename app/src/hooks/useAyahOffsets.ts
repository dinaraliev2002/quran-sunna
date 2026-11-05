import { useEffect, useState } from 'react'
import { loadWbw } from '../lib/data'
import type { MushafPage } from '../types/quran'

/**
 * Аят может начинаться на предыдущей странице мусхафа — тогда слова на этой странице нумеруются не с первого.
 * Возвращает для каждого аята, который здесь заканчивается, сколько его слов осталось на предыдущих страницах.
 */
export function useAyahOffsets(mp: MushafPage | null) {
  const [off, setOff] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!mp) return
    let alive = true
    const ends: string[] = []
    const cnt = new Map<string, number>()
    for (const line of Object.values(mp.lines)) {
      for (const [, key, end] of line) {
        if (end) ends.push(key)
        else cnt.set(key, (cnt.get(key) ?? 0) + 1)
      }
    }
    const surahs = [...new Set(ends.map((k) => Number(k.split(':')[0])))]
    Promise.all(surahs.map((s) => loadWbw(s).catch(() => null).then((rows) => [s, rows] as const))).then((res) => {
      if (!alive) return
      const out: Record<string, number> = {}
      for (const key of ends) {
        const [s, a] = key.split(':').map(Number)
        const total = res.find((r) => r[0] === s)?.[1]?.[a - 1]?.length
        if (total) out[key] = Math.max(0, total - (cnt.get(key) ?? 0))
      }
      setOff(out)
    })
    return () => { alive = false }
  }, [mp])
  return off
}
