import { useEffect, useState } from 'react'
import { loadRoots } from '../lib/morph'
import type { RootInfo } from '../types/morph'

/** Корень из общего списка: undefined — грузится, null — нет данных */
export function useRoot(root: string | null) {
  const [info, setInfo] = useState<RootInfo | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    if (!root) return
    loadRoots().then((r) => alive && setInfo(r?.[root] ?? null))
    return () => { alive = false }
  }, [root])
  return root ? info : null
}
