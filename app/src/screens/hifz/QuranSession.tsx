import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { useQuranMeta } from '../../hooks/useQuranMeta'
import { loadSurah } from '../../lib/data'
import { dayNum } from '../../lib/hifz'
import { coveredAyahs, loadQItem, nextStart, passageFrom, qKey, qSet } from '../../lib/hifzQuran'
import { type QItem } from '../../types/hifzQuran'
import { haptic } from '../../lib/telegram'
import { setRate, setReciter, usePlayer } from '../../store/player'
import { useStore } from '../../store/settings'
import { REVIEW_MAX } from './session/steps'
import { LearnItem } from './session/LearnItem'
import { ReviewItem } from './session/ReviewItem'
import { GearSheet } from './session/GearSheet'
import { Finish } from './session/Finish'

// Урок заучивания отрывка Корана (learn) и повторение (review).
//  learn:  слушать и читать → [видно слово через одно / через два] → [продолжи аят] → по памяти (виден перевод) → «Запомнил»
//  review: по памяти (виден перевод, арабский размыт; нажатие — открыть и послушать) → Плохо / Средне / Хорошо
export default function QuranSessionRoute({ mode }: { mode: 'learn' | 'review' }) {
  return <QuranSession key={useLocation().key} mode={mode} />
}

function QuranSession({ mode }: { mode: 'learn' | 'review' }) {
  const nav = useNavigate()
  const [search] = useSearchParams()
  const surahs = useQuranMeta()?.surahs
  const [queue, setQueue] = useState<QItem[] | null>(null)
  const [done, setDone] = useState(0)
  const [gear, setGear] = useState(false)
  const rate = useStore((s) => s.qhRate)

  useEffect(() => {
    const st = useStore.getState()
    setReciter(st.reciter)
    return () => { usePlayer.getState().stop(); setRate(null) }
  }, [])
  useEffect(() => { setRate(rate) }, [rate])

  // очередь собирается один раз при открытии
  useEffect(() => {
    if (!surahs) return
    const st = useStore.getState()
    const cards = st.qhifz
    let p: Promise<QItem[]>
    if (mode === 'review') {
      // ?k= — один отрывок, ?weak=1 — слабые места, ?s= — вся сура, иначе — что пора повторить
      const s = Number(search.get('s')), only = search.get('k'), weak = search.get('weak')
      const d = dayNum()
      const keys = Object.entries(cards).filter(([k, c]) => (only ? k === only : weak ? st.qhWeak.includes(k) : s ? k.startsWith(s + ':') : c.d <= d)).sort((a, b) => a[1].d - b[1].d).slice(0, REVIEW_MAX).map(([k]) => k)
      p = Promise.all(keys.map(loadQItem)).then((l) => l.filter((x): x is QItem => !!x).sort((a, b) => b.s - a.s || a.a - b.a))
    } else {
      // с выбранного аята (из читалки) или откуда учим дальше
      const s0 = Number(search.get('s')), a0 = Number(search.get('a'))
      if (s0 && a0) st.set({ qhPos: { s: s0, a: a0 } })
      const start = s0 && a0 ? { s: s0, a: a0, end: surahs[s0 - 1].ayahs } : nextStart(cards, st.qhPos, (s) => surahs[s - 1].ayahs, qSet(st.qhSet, st.qhMy))
      const left = Math.max(0, st.qhPerDay - (st.today.qa ?? 0))
      const n = Number(search.get('n')) || left || st.qhPerDay
      p = !start ? Promise.resolve([]) : loadSurah(start.s).then((ay) => {
        const ps = passageFrom(ay, cards, start.s, start.a, n, start.end)
        // аят из читалки уже учится — повторяем его отрывок
        return coveredAyahs(cards, ps.s).has(ps.a) ? [] : [{ key: qKey(ps.s, ps.a, ps.b), s: ps.s, a: ps.a, b: ps.b, ayahs: ay.slice(ps.a - 1, ps.b) }]
      })
    }
    p.then(setQueue).catch(() => setQueue([]))
  }, [mode, search, surahs])

  const item = queue?.[0]
  const next = () => { usePlayer.getState().stop(); setQueue((q) => q!.slice(1)); setDone((n) => n + 1) }
  const name = (s: number) => surahs?.[s - 1]?.name ?? ''

  return (
    <div className="nml hz-s">
      <div className="azc-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="close" /></button>
        <div className="ttl"><b>{mode === 'learn' ? 'Новый отрывок' : 'Повторение'}</b><span>{queue && item ? `${name(item.s)} · ${item.a === item.b ? `аят ${item.a}` : `${item.a}–${item.b}`}${mode === 'review' ? ` · ${done + 1} из ${done + queue.length}` : ''}` : 'Коран'}</span></div>
        <button className="icon-btn" onClick={() => { haptic.tap(); setGear(true) }} aria-label="Настройки"><Icon id="gear" /></button>
      </div>
      {gear && <GearSheet onClose={() => setGear(false)} />}
      {!queue ? <div className="loading">Загрузка…</div>
        : !item ? <Finish mode={mode} count={done} />
          : mode === 'learn' ? <LearnItem key={item.key} item={item} onDone={next} />
            : <ReviewItem key={item.key} item={item} onDone={next} />}
    </div>
  )
}

