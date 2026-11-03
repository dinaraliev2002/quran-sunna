import { useEffect, useState } from 'react'
import { loadWbw } from '../lib/data'

/** Пословный перевод суры (по аятам); null — ещё грузится или нет сети */
export function useWbw(sid: number) {
  const [rows, setRows] = useState<string[][] | null>(null)
  useEffect(() => {
    let alive = true
    loadWbw(sid).then((r) => alive && setRows(r)).catch(() => {})
    return () => { alive = false }
  }, [sid])
  return rows
}
