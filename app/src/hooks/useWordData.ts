import { useEffect, useState } from 'react'
import { loadWbw } from '../lib/data'
import { loadMorph } from '../lib/morph'
import type { MorphWord, WordTarget } from '../types/morph'

/** Разбор и русский перевод одного слова; word === undefined — ещё грузится, null — данных нет */
export function useWordData(t: WordTarget) {
  const [res, setRes] = useState<{ key: string; word: MorphWord | null; tr: string | null } | null>(null)
  const key = `${t.s}:${t.a}:${t.w}`
  useEffect(() => {
    let alive = true
    Promise.all([loadMorph(t.s), loadWbw(t.s).catch(() => null)]).then(([m, rows]) => {
      if (!alive) return
      const tr = rows?.[t.a - 1]
      let k = t.w - 1
      while (tr && k > 0 && !tr[k]) k-- // пустая подпись — слово переведено вместе с предыдущим
      setRes({ key, word: m?.[String(t.a)]?.[t.w - 1] ?? null, tr: tr?.[k] || null })
    })
    return () => { alive = false }
  }, [key, t.s, t.a, t.w])
  return res && res.key === key ? res : { key, word: undefined, tr: null }
}
