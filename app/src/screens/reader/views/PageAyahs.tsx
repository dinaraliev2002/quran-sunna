import { memo, useEffect, useRef, useState } from 'react'
import { loadMushafPage, loadSurah } from '../../../lib/data'
import type { Ayah, Surah } from '../../../types/quran'
import { AyahBlock } from './AyahBlock'
import { HizbMark } from './HizbMark'
import { SurahHead } from './SurahHead'
import type { AyahActions, ViewOpts } from './types'

// ---------- Режим «Страница»: аяты одной страницы мусхафа ----------
export const PageAyahs = memo(function PageAyahs({ page, surahs, opts, act }: { page: number; surahs: Surah[]; opts: ViewOpts; act: AyahActions }) {
  const [items, setItems] = useState<{ sid: number; a: Ayah }[] | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadMushafPage(page).then(async (mp) => {
      const keys = new Set<string>()
      Object.values(mp.lines).forEach((ln) => ln.forEach((w) => keys.add(w[1])))
      const sids = [...new Set([...keys].map((k) => Number(k.split(':')[0])))]
      const loaded = await Promise.all(sids.map((s) => loadSurah(s)))
      const out: { sid: number; a: Ayah }[] = []
      sids.forEach((sid, i) => loaded[i].forEach((a) => { if (keys.has(`${sid}:${a.n}`)) out.push({ sid, a }) }))
      if (alive) setItems(out)
    })
    return () => { alive = false }
  }, [page])

  useEffect(() => {
    if (!act.playing || !box.current) return
    box.current.querySelector<HTMLElement>(`[data-key="${act.playing}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [act.playing])

  return (
    <div className="pscroll" ref={box}>
      <div className="content">
        {!items && <div className="loading">Загрузка…</div>}
        {items?.map(({ sid, a }) => {
          const key = `${sid}:${a.n}`
          return (
            <div key={key}>
              {a.n === 1 && <SurahHead s={surahs[sid - 1]} tajweed={opts.tajweed} />}
              <HizbMark a={a} />
              <AyahBlock sid={sid} a={a} opts={opts} act={act} playing={act.playing === key} hidden={act.hidden(key)} marked={act.bookmarked(key)} />
            </div>
          )
        })}
        {items && <div className="page-foot">— {page} —</div>}
      </div>
    </div>
  )
})
