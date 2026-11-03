import { useEffect, useState } from 'react'
import { loadSurah } from '../lib/data'
import { type Surah } from '../types/quran'
import { dayNum } from '../lib/hifz'
import { nextStart, passageFrom, qSet, remainingWords, setProgress } from '../lib/hifzQuran'
import { type QSet } from '../types/hifzQuran'
import { dayStr, useStore } from '../store/settings'
// Заучивание Корана: что на сегодня, следующий отрывок, цель

/** Что на сегодня в Коране: отрывки на повтор и сколько новых аятов осталось по плану */
export function useQhToday() {
  const cards = useStore((s) => s.qhifz)
  const plan = useStore((s) => s.qhPerDay)
  const today = useStore((s) => s.today)
  const d = dayNum()
  const due = Object.entries(cards).filter(([, c]) => c.d <= d).map(([k]) => k)
  const learnedToday = today.d === dayStr() ? (today.qa ?? 0) : 0
  return { due, learnedToday, plan, newLeft: Math.max(0, plan - learnedToday), started: Object.keys(cards).length > 0 }
}

/** Следующий новый отрывок (по плану на сегодня) */
export function useNextPassage(surahs: Surah[] | undefined, n: number) {
  const cards = useStore((s) => s.qhifz)
  const pos = useStore((s) => s.qhPos)
  const setId = useStore((s) => s.qhSet)
  const my = useStore((s) => s.qhMy)
  const [p, setP] = useState<{ s: number; a: number; b: number; words: number } | null>(null)
  const start = surahs ? nextStart(cards, pos, (s) => surahs[s - 1].ayahs, qSet(setId, my)) : null
  useEffect(() => {
    if (!start) { setP(null); return }
    let alive = true
    loadSurah(start.s).then((ay) => alive && setP(passageFrom(ay, cards, start.s, start.a, Math.max(1, n), start.end)))
    return () => { alive = false }
  }, [start?.s, start?.a, start?.end, n, cards])
  return p
}

/** Слова по аятам для сур (грузим по мере надобности) — чтобы считать объём в страницах */
export function useWordsOf(ids: number[]) {
  const [m, setM] = useState<Record<number, number[]>>({})
  const key = ids.join()
  useEffect(() => {
    let alive = true
    const need = ids.filter((s) => !m[s])
    if (need.length) Promise.all(need.map((s) => loadSurah(s).then((a) => [s, a.map((x) => x.w.length)] as const))).then((r) => alive && setM((o) => ({ ...o, ...Object.fromEntries(r) })))
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (s: number) => m[s]
}

/** Что сейчас учим целиком: выбранная сура или подборка — для цели */
export function useTarget(surahs: Surah[]) {
  const st = useStore()
  const count = (s: number) => surahs[s - 1].ayahs
  const t = st.qhGoal?.t ?? (st.qhPos && !qSet(st.qhSet, st.qhMy).ranges.some((r) => r.s === st.qhPos!.s) ? 's:' + st.qhPos.s : 'set:' + st.qhSet)
  const set: QSet = t.startsWith('s:') ? { id: t, name: 'Сура ' + surahs[+t.slice(2) - 1].name, ar: '', short: '', sub: '', ranges: [{ s: +t.slice(2) }] } : qSet(t.slice(4), st.qhMy)
  const wordsOf = useWordsOf([...new Set(set.ranges.map((r) => r.s))])
  return { t, set, ...setProgress(st.qhifz, set, count), rem: remainingWords(st.qhifz, set, wordsOf) }
}
