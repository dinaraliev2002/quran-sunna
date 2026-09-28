import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { loadMushafPage, loadSurah, surahGlyph, type Ayah, type MushafPage, type Surah } from '../../lib/data'
import { loadPageFont, pageFont, pagePalette } from '../../lib/fonts'
import { useUi } from '../../store/ui'

export interface AyahActions {
  playing: string | null
  /** идёт ли звук прямо сейчас (для кнопки ▶/⏸ у звучащего аята) */
  sounding: boolean
  onToggle: () => void
  hidden: (key: string) => boolean
  bookmarked: (key: string) => boolean
  onPlay: (surah: number, ayah: number) => void
  onTafsir: (surah: number, ayah: number) => void
  onBookmark: (key: string) => void
}

export interface ViewOpts { tajweed: boolean; translation: 'ku' | 'aa' }

// «Бисмилля» — глифами первой страницы мусхафа (1:1 без знака конца аята)
function useBismillah() {
  const [g, setG] = useState<string | null>(null)
  useEffect(() => { loadSurah(1).then((a) => setG(a[0].g.split(' ').slice(0, -1).join(' '))) }, [])
  return g
}

function Bismillah({ tajweed, className }: { tajweed: boolean; className: string }) {
  const g = useBismillah()
  const theme = useUi((s) => s.theme)
  if (!g) return <div className={className}>&nbsp;</div>
  return <div className={className + ' qpc'} style={{ fontFamily: `'${pageFont(1, tajweed, theme)}'`, ['--pal' as string]: pagePalette(1) }}>{g}</div>
}

// ---------- Заголовок суры ----------
export function SurahHead({ s, tajweed }: { s: Surah; tajweed: boolean }) {
  return (
    <div className="s-head">
      <div className="banner">{surahGlyph(s.id)}</div>
      {s.id !== 1 && s.id !== 9 && <Bismillah tajweed={tajweed} className="bism" />}
    </div>
  )
}

// ---------- Аят с переводом ----------
// Арабский текст рисуется шрифтом той страницы мусхафа, на которой стоит аят (как в печатном издании).
export const AyahBlock = memo(function AyahBlock({ sid, a, opts, act, playing, hidden, marked, theme }: {
  sid: number; a: Ayah; opts: ViewOpts; act: AyahActions; playing: boolean; hidden: boolean; marked: boolean; theme: 'light' | 'dark'
}) {
  const key = `${sid}:${a.n}`
  const family = pageFont(a.p, opts.tajweed, theme)
  return (
    <div className={'a-block' + (playing ? ' playing' : '')} data-key={key} data-page={a.p}>
      <div className="a-head">
        <span className="a-key">{key}{playing ? ' · звучит' : ''}</span>
        <button className={'a-act' + (playing ? ' on' : '')} onClick={() => (playing ? act.onToggle() : act.onPlay(sid, a.n))}
          aria-label={playing && act.sounding ? 'Пауза' : 'Слушать'}><Icon id={playing && act.sounding ? 'pause' : 'play'} /></button>
        <button className="a-act" onClick={() => act.onTafsir(sid, a.n)} aria-label="Тафсир"><Icon id="info" /></button>
        <button className={'a-act' + (marked ? ' on' : '')} onClick={() => act.onBookmark(key)} aria-label="Закладка"><Icon id="bookmark" /></button>
      </div>
      <div className={'a-ar qpc' + (hidden ? ' hidden' : '')} style={{ fontFamily: `'${family}', 'UthmanicHafs'`, ['--pal' as string]: pagePalette(a.p) }}>
        {a.g}
      </div>
      <div className="a-tr">{opts.translation === 'aa' ? a.aa : a.ku}</div>
    </div>
  )
})

// ---------- Режим «Сура»: вся сура, листается вниз ----------
export function SuraView({ surah, scrollTo, opts, act, onTop }: {
  surah: Surah; scrollTo: number; opts: ViewOpts; act: AyahActions; onTop: (ayah: number, page: number) => void
}) {
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const onTopRef = useRef(onTop)
  onTopRef.current = onTop
  const theme = useUi((s) => s.theme)

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
      <div className="content">
        <SurahHead s={surah} tajweed={opts.tajweed} />
        {!ayahs && <div className="loading">Загрузка…</div>}
        {ayahs?.map((a, i) => {
          const key = `${surah.id}:${a.n}`
          const pageEnd = !ayahs[i + 1] || ayahs[i + 1].p !== a.p
          return (
            <div key={a.n}>
              <AyahBlock sid={surah.id} a={a} opts={opts} act={act} theme={theme} playing={act.playing === key} hidden={act.hidden(key)} marked={act.bookmarked(key)} />
              {pageEnd && <div className="pmark">{a.p} стр.</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Режим «Страница»: аяты одной страницы мусхафа ----------
export const PageAyahs = memo(function PageAyahs({ page, surahs, opts, act }: { page: number; surahs: Surah[]; opts: ViewOpts; act: AyahActions }) {
  const [items, setItems] = useState<{ sid: number; a: Ayah }[] | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const theme = useUi((s) => s.theme)

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
              <AyahBlock sid={sid} a={a} opts={opts} act={act} theme={theme} playing={act.playing === key} hidden={act.hidden(key)} marked={act.bookmarked(key)} />
            </div>
          )
        })}
        {items && <div className="page-foot">— {page} —</div>}
      </div>
    </div>
  )
})

// ---------- Режим «Мусхаф»: печатная страница ----------
type Line = { kind: 'words'; n: number } | { kind: 'head'; sid: number } | { kind: 'bism' } | { kind: 'empty' }

function layoutLines(mp: MushafPage): Line[] {
  const nums = Object.keys(mp.lines).map(Number)
  const lastLine = mp.p <= 2 ? Math.max(...nums) : 15
  const startAt = new Map(mp.starts.map(([sid, line]) => [line, sid]))
  const lastWords = mp.lines[String(Math.max(...nums))]
  const lastSid = Number(lastWords[lastWords.length - 1][1].split(':')[0])
  const out: Line[] = []
  let n = 1
  while (n <= lastLine) {
    if (mp.lines[n]) { out.push({ kind: 'words', n }); n++; continue }
    // серия пустых строк: заголовок суры и/или «Бисмилля»
    let end = n
    while (end + 1 <= lastLine && !mp.lines[end + 1]) end++
    const len = end - n + 1
    const atPageEnd = end === lastLine
    const sid = atPageEnd ? lastSid + 1 : startAt.get(end + 1) ?? lastSid
    if (len >= 2) { out.push({ kind: 'head', sid }, sid === 9 || sid === 1 ? { kind: 'empty' } : { kind: 'bism' }); for (let i = 2; i < len; i++) out.push({ kind: 'empty' }) }
    else if (atPageEnd || sid === 9 || sid === 1) out.push({ kind: 'head', sid })
    else out.push({ kind: 'bism' })
    n = end + 1
  }
  return out
}

export const MushafView = memo(function MushafView({ page, tajweed, playing }: { page: number; tajweed: boolean; playing: string | null }) {
  const [mp, setMp] = useState<MushafPage | null>(null)
  const [ready, setReady] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const theme = useUi((s) => s.theme)

  useEffect(() => {
    let alive = true
    setReady(false)
    Promise.all([loadMushafPage(page), loadPageFont(page, tajweed, theme)]).then(([m]) => { if (alive) { setMp(m); setReady(true) } })
    return () => { alive = false }
  }, [page, tajweed, theme])

  // подгоняем шрифт: самая длинная строка = ширина страницы, 15 строк = высота
  useLayoutEffect(() => {
    const m = box.current
    if (!m || !ready) return
    const fit = () => {
      const lines = m.querySelector<HTMLElement>('.lines')!
      m.style.fontSize = '20px'
      let maxW = 0
      lines.querySelectorAll('.ln.w').forEach((ln) => {
        let w = 0
        ln.querySelectorAll('span').forEach((sp) => (w += sp.getBoundingClientRect().width))
        maxW = Math.max(maxW, w)
      })
      // на страницах 1–2 строки по центру с промежутками между словами — оставляем запас
      const byWidth = maxW ? (20 * lines.clientWidth) / maxW * (page <= 2 ? 0.84 : 0.96) : 20
      const byHeight = lines.clientHeight / 15 / 1.6
      m.style.fontSize = Math.min(byWidth, page <= 2 ? byWidth : byHeight).toFixed(2) + 'px'
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(m)
    return () => ro.disconnect()
  }, [ready, mp, page])

  if (!mp || !ready) return <div className="mus"><div className="loading">Загрузка страницы…</div></div>
  const family = pageFont(page, tajweed, theme)
  return (
    <div className="mus">
      <div className={'mushaf' + (page <= 2 ? ' short' : '')} ref={box}>
        <div className="lines">
          {layoutLines(mp).map((l, i) => {
            if (l.kind === 'head') return <div key={i} className="ln head">{surahGlyph(l.sid)}</div>
            if (l.kind === 'bism') return <Bismillah key={i} tajweed={tajweed} className="ln bism" />
            if (l.kind === 'empty') return <div key={i} className="ln" />
            return (
              <div key={i} className={'ln w' + (page <= 2 ? ' center' : '')} style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }}>
                {mp.lines[l.n].map(([g, key], j) => <span key={j} className={key === playing ? 'hl' : ''}>{g}</span>)}
              </div>
            )
          })}
        </div>
        <div className="pfoot">{page}</div>
      </div>
    </div>
  )
})
