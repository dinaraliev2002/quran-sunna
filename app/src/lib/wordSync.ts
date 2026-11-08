// Подсветка слова, которое сейчас звучит. Разметка слов в записи суры (public/data/recite) есть у части чтецов;
// у остальных подсвечивается только аят.
import { useEffect } from 'react'
import { create } from 'zustand'
import { playbackPos, playingTiming, usePlayer } from '../store/player'

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
      const segs = pos ? playingTiming(pos.key)?.w?.[Number(pos.key.split(':')[1]) - 1] : null
      let w = 0
      if (pos && segs?.length) {
        for (const [n, st] of segs) { if (st <= pos.ms) w = n; else break }
        // после последнего слова (пауза до следующего аята) слово не подсвечиваем
        if (pos.ms > segs[segs.length - 1][2] + 250) w = 0
      }
      set(pos?.key ?? null, w)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { live = false; cancelAnimationFrame(raf) }
  }, [status])
}
