// Подсветка слова, которое сейчас звучит. Тайминги слов (public/data/timing, собираются scripts/fetch-timings.mjs)
// есть у пяти чтецов; у остальных подсвечивается только аят.
import { useEffect } from 'react'
import { create } from 'zustand'
import { DATA_BASE } from './data'
import { currentReciter, playbackPos, usePlayer } from '../store/player'

type Seg = [number, number, number] // [слово, начало мс, конец мс]
type SurahTiming = Record<string, Seg[]>

const TIMED = new Set(['alafasy', 'husary_m', 'sudais', 'shatri', 'shuraym'])
export const hasWordTiming = (reciter: string) => TIMED.has(reciter)

const loaded = new Map<string, SurahTiming>()
const loading = new Set<string>()
const failed = new Set<string>()

function timingOf(reciter: string, surah: number): SurahTiming | null {
  const k = `${reciter}:${surah}`
  const hit = loaded.get(k)
  if (hit) return hit
  if (!loading.has(k) && !failed.has(k)) {
    loading.add(k)
    fetch(`${DATA_BASE}timing/${reciter}/${String(surah).padStart(3, '0')}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SurahTiming>) : Promise.reject(new Error(String(r.status)))))
      .then((j) => { loaded.set(k, j) })
      .catch(() => { failed.add(k) })
      .finally(() => loading.delete(k))
  }
  return null
}

/** Какое слово какого аята звучит сейчас (0 — слово не определено) */
export const useWordPos = create<{ key: string | null; word: number }>(() => ({ key: null, word: 0 }))

/** Номер звучащего слова, если звучит именно этот аят */
export const useWordOf = (key: string | null | undefined) => useWordPos((s) => (key && s.key === key ? s.word : 0))

/** Следит за плеером и обновляет useWordPos (запускается один раз на всё приложение) */
export function useWordHighlight() {
  const status = usePlayer((s) => s.status)
  useEffect(() => {
    const set = (key: string | null, word: number) => {
      const c = useWordPos.getState()
      if (c.key !== key || c.word !== word) useWordPos.setState({ key, word })
    }
    if (status !== 'playing') { set(null, 0); return }
    let live = true
    let raf = 0
    const tick = () => {
      if (!live) return
      const pos = playbackPos()
      const rec = currentReciter()
      if (!pos || !hasWordTiming(rec)) set(pos?.key ?? null, 0)
      else {
        const [s, a] = pos.key.split(':')
        const segs = timingOf(rec, Number(s))?.[a]
        let w = 0
        if (segs) {
          for (const [n, st] of segs) { if (st <= pos.ms) w = n; else break }
          // после последнего слова (пауза до следующего аята) слово не подсвечиваем
          if (pos.ms > segs[segs.length - 1][2] + 250) w = 0
        }
        set(pos.key, w)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { live = false; cancelAnimationFrame(raf) }
  }, [status])
}
