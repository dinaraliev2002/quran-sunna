import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadSurah } from '../../../lib/data'
import { useSideSwipe } from '../../../hooks/useSideSwipe'
import type { Ayah, Surah } from '../../../types/quran'
import { AyahBlock } from './AyahBlock'
import { HizbMark } from './HizbMark'
import { SurahHead } from './SurahHead'
import type { AyahActions, ViewOpts } from './types'

// ---------- Режим «Сура»: вся сура, листается вниз ----------
export function SuraView({ surah, scrollTo, opts, act, onTop, prevName, nextName, onSwipe, enter }: {
  surah: Surah; scrollTo: number; opts: ViewOpts; act: AyahActions; onTop: (ayah: number, page: number) => void
  prevName: string | null; nextName: string | null; onSwipe: (dir: 1 | -1) => void; enter: '' | 'from-left' | 'from-right'
}) {
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const hintNext = useRef<HTMLDivElement>(null)
  const hintPrev = useRef<HTMLDivElement>(null)
  useSideSwipe(box, content, hintNext, hintPrev, onSwipe, !!nextName, !!prevName)
  const onTopRef = useRef(onTop)
  onTopRef.current = onTop

  useEffect(() => {
    let alive = true
    setAyahs(null)
    loadSurah(surah.id).then((a) => alive && setAyahs(a))
    return () => { alive = false }
  }, [surah.id])

  // прокрутка к нужному аяту
  useLayoutEffect(() => {
    if (!ayahs || !box.current) return
    const el = box.current.querySelector<HTMLElement>(`[data-key="${surah.id}:${scrollTo}"]`)
    box.current.scrollTop = scrollTo > 1 && el ? el.offsetTop - 80 : 0
  }, [ayahs, scrollTo, surah.id])

  // какой аят сейчас вверху экрана → последнее место чтения и номер страницы
  useEffect(() => {
    const el = box.current
    if (!el || !ayahs) return
    let raf = 0
    const check = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const top = el.scrollTop + 120
        const blocks = el.querySelectorAll<HTMLElement>('.a-block')
        let cur: HTMLElement | null = blocks[0] ?? null
        for (const b of blocks) { if (b.offsetTop <= top) cur = b; else break }
        if (cur) onTopRef.current(Number(cur.dataset.key!.split(':')[1]), Number(cur.dataset.page))
      })
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    return () => el.removeEventListener('scroll', check)
  }, [ayahs])

  // звучащий аят — докрутить до него
  useEffect(() => {
    if (!act.playing || !box.current) return
    box.current.querySelector<HTMLElement>(`[data-key="${act.playing}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [act.playing])

  return (
    <div className="vscroll" ref={box}>
      {nextName && <div className="swipe-hint left" ref={hintNext}>Следующая<b>{nextName}</b></div>}
      {prevName && <div className="swipe-hint right" ref={hintPrev}>Предыдущая<b>{prevName}</b></div>}
      <div className={'content' + (enter ? ' ' + enter : '')} ref={content}>
        <SurahHead s={surah} tajweed={opts.tajweed} />
        {!ayahs && <div className="loading">Загрузка…</div>}
        {ayahs?.map((a, i) => {
          const key = `${surah.id}:${a.n}`
          const pageEnd = !ayahs[i + 1] || ayahs[i + 1].p !== a.p
          return (
            <div key={a.n}>
              <HizbMark a={a} />
              <AyahBlock sid={surah.id} a={a} opts={opts} act={act} playing={act.playing === key} hidden={act.hidden(key)} marked={act.bookmarked(key)} />
              {pageEnd && <div className="pmark">{a.p} стр.</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
