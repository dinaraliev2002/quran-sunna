import { useEffect, useState } from 'react'
import { loadMeta, loadSurahs } from '../lib/data'
import type { Surah } from '../types/quran'

/** Список сур + таблица начала джузов (загружаются один раз) */
export function useQuranMeta() {
  const [data, setData] = useState<{ surahs: Surah[]; juzPages: number[] } | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadSurahs(), loadMeta()]).then(([surahs, meta]) => alive && setData({ surahs, juzPages: meta.juzPages }))
    return () => { alive = false }
  }, [])
  return data
}
