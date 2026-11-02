import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE, type RefObject } from 'react'
import { Icon } from '../../components/Icon'
import { SurahBanner } from '../../components/SurahBanner'
import { arDigits, hasAsbab, hasKuliev, isSajda, hizbOf, loadMushafPage, loadSurah, loadWbw, QUARTER_LABEL, type Ayah, type MushafPage, type Surah } from '../../lib/data'
import { loadPageFont, pageFont, pagePalette, useFontReady } from '../../lib/fonts'
import { haptic } from '../../lib/telegram'
import { useUi } from '../../store/ui'
import { SurahStoryButton, useAsbabIndex } from './Asbab'
import { useKulievIndex } from './Kuliev'

export interface AyahActions {
  playing: string | null
  /** идёт ли звук прямо сейчас (для кнопки ▶/⏸ у звучащего аята) */
  sounding: boolean
  onToggle: () => void
  hidden: (key: string) => boolean
  bookmarked: (key: string) => boolean
  onPlay: (surah: number, ayah: number) => void
  /** окно аята: перевод + тафсир */
  onInfo: (surah: number, ayah: number) => void
  onBookmark: (key: string) => void
}

export interface ViewOpts { tajweed: boolean; translation: 'ku' | 'aa'; wbw: boolean }

// ---------- Текст глифами шрифта страницы мусхафа (пока шрифт грузится — не показываем «квадратики») ----------
export function QpcText({ page, glyphs, tajweed, className = '' }: { page: number; glyphs: string; tajweed: boolean; className?: string }) {
  const theme = useUi((s) => s.theme)
  const family = pageFont(page, tajweed, theme)
  const ready = useFontReady(family)
  return (
    <div className={className + ' qpc' + (ready ? '' : ' loading-font')} style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }}>
      {glyphs}
    </div>
  )
}

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

/** Слово глифом страницы: у растянутых (кашида) слов «хвост» выходит за поле глифа — расширяем поля, чтобы он поместился в рамку */
function GlyphWord({ glyph, family, ready, style }: { glyph: string; family: string; ready: boolean; style: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current, box = el?.parentElement
    if (!el || !box || !ready) return
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.font = `${getComputedStyle(el).fontSize} '${family}'`
    const m = ctx.measureText(glyph)
    const over = Math.max(0, m.actualBoundingBoxLeft + m.actualBoundingBoxRight - m.width)
    box.style.paddingInline = `${12 + Math.ceil(over / 2)}px`
  }, [ready, family, glyph])
  return <span ref={ref} className="wa qpc" style={style}>{glyph}</span>
}

/** Аят по словам: арабское слово (глифом страницы мусхафа, с цветами таджвида) и русская подпись под ним */
function WbwText({ sid, a, tajweed, hidden }: { sid: number; a: Ayah; tajweed: boolean; hidden: boolean }) {
  const theme = useUi((s) => s.theme)
  const family = pageFont(a.p, tajweed, theme)
  const ready = useFontReady(family)
  const tr = useWbw(sid)?.[a.n - 1]
  const gl = a.g.split(' ')
  const glyph = gl.length === a.w.length + 1 // у части аятов глифы не совпадают со словами — тогда текст Усмани
  const st = glyph ? { fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(a.p) } : undefined
  // запасной вариант: разметка таджвида по словам (пробелы внутри тегов не делят слова)
  const parts = a.tj.replace(/<[^>]+>/g, (m) => m.replace(/ /g, '')).split(' ').map((x) => x.replace(//g, ' '))
  const colored = !glyph && tajweed && parts.length === a.w.length
  return (
    <div className={'wbw a-wbw' + (glyph && !ready ? ' loading-font' : '') + (hidden ? ' hidden' : '')}>
      {a.w.map((w, i) => (
        <div className="w" key={i}>
          {glyph
            ? <GlyphWord glyph={gl[i]} family={family} ready={ready} style={st!} />
            : colored ? <span className="wa" dangerouslySetInnerHTML={{ __html: parts[i] }} /> : <span className="wa">{w}</span>}
          <span className="wt">{tr ? tr[i] || '·' : ' '}</span>
        </div>
      ))}
      {/* номер аята — тем же глифом страницы, что и в обычном чтении */}
      <QpcText page={a.p} glyphs={gl[gl.length - 1]} tajweed={tajweed} className="wbw-end" />
    </div>
  )
}

/**
 * Аят по словам для заучивания: глифы страницы мусхафа (с таджвидом), скрытые слова — пустые рамки той же ширины.
 * hide(i) — скрыто ли слово i; нажатие на скрытое слово — onPeek(i).
 */
export function AyahWords({ a, tajweed, hide, onPeek }: { a: Ayah; tajweed: boolean; hide?: (i: number) => boolean; onPeek?: (i: number) => void }) {
  const theme = useUi((s) => s.theme)
  const family = pageFont(a.p, tajweed, theme)
  const ready = useFontReady(family)
  const gl = a.g.split(' ')
  const glyph = gl.length === a.w.length + 1
  const parts = a.tj.replace(/<[^>]+>/g, (m) => m.replace(/ /g, '')).split(' ').map((x) => x.replace(//g, ' '))
  const colored = !glyph && tajweed && parts.length === a.w.length
  return (
    <div className={'qw-ayah' + (glyph ? ' qpc' : '') + (glyph && !ready ? ' loading-font' : '')} dir="rtl" style={glyph ? { fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(a.p) } : undefined}>
      {a.w.map((w, i) => {
        const inner = glyph ? gl[i] : colored ? <span dangerouslySetInnerHTML={{ __html: parts[i] }} /> : w
        return hide?.(i)
          ? <button key={i} className={'qw gap' + (glyph ? '' : ' txt')} onClick={() => onPeek?.(i)} aria-label="Показать слово"><span>{inner}</span></button>
          : <span key={i} className={'qw' + (glyph ? '' : ' txt')}>{inner}</span>
      })}
      {glyph ? <span className="qw end">{gl[gl.length - 1]}</span> : <span className="qw txt end">{arDigits(a.n)}</span>}
    </div>
  )
}

// «Бисмилля» — глифами первой страницы мусхафа (1:1 без знака конца аята)
let bismGlyphs: string | null = null
function Bismillah({ tajweed, className }: { tajweed: boolean; className: string }) {
  const [g, setG] = useState(bismGlyphs)
  useEffect(() => {
    if (!g) loadSurah(1).then((a) => { bismGlyphs = a[0].g.split(' ').slice(0, -1).join(' '); setG(bismGlyphs) })
  }, [g])
  return g ? <QpcText page={1} glyphs={g} tajweed={tajweed} className={className} /> : <div className={className}>&nbsp;</div>
}

// ---------- Заголовок суры ----------
export function SurahHead({ s, tajweed }: { s: Surah; tajweed: boolean }) {
  return (
    <div className="s-head">
      <SurahBanner sid={s.id} />
      <div className="s-meta">{s.mk ? 'Мекканская' : 'Мединская'} · {s.ayahs} аятов</div>
      <SurahStoryButton sid={s.id} name={s.name} />
      {s.id !== 1 && s.id !== 9 && <Bismillah tajweed={tajweed} className="bism" />}
    </div>
  )
}

/** Метка начала хизба или его четверти (как ۞ на полях печатного мусхафа) */
function HizbMark({ a }: { a: Ayah }) {
  if (!a.rs) return null
  const { hizb, quarter } = hizbOf(a.r)
  const juzStart = quarter === 0 && hizb % 2 === 1
  return (
    <div className="hmark">
      <span>۞</span>
      {quarter === 0 ? <b>Хизб {hizb}{juzStart ? ` · Джуз ${(hizb + 1) / 2}` : ''}</b> : <b>{QUARTER_LABEL[quarter]} хизба {hizb}</b>}
    </div>
  )
}

/** Телефон повёрнут боком (низкий и широкий экран) */
function useLandscape() {
  const q = () => window.innerWidth > window.innerHeight && window.innerHeight < 600
  const [v, setV] = useState(q)
  useEffect(() => {
    // при повороте размеры окна обновляются не сразу — перепроверяем ещё раз, когда всё уляжется
    let t: ReturnType<typeof setTimeout> | undefined
    const on = () => { setV(q()); clearTimeout(t); t = setTimeout(() => setV(q()), 350) }
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); clearTimeout(t) }
  }, [])
  return v
}

// ---------- Аят с переводом ----------
export const AyahBlock = memo(function AyahBlock({ sid, a, opts, act, playing, hidden, marked }: {
  sid: number; a: Ayah; opts: ViewOpts; act: AyahActions; playing: boolean; hidden: boolean; marked: boolean
}) {
  const key = `${sid}:${a.n}`
  const story = hasAsbab(useAsbabIndex(), sid, a.n)
  const kix = useKulievIndex()
  const comment = hasKuliev(kix, sid, a.n)
  const sajda = isSajda(kix, sid, a.n)
  return (
    <div className={'a-block' + (playing ? ' playing' : '')} data-key={key} data-page={a.p}>
      <div className="a-head">
        <span className="a-key">{key}{playing ? ' · звучит' : ''}</span>
        {/* у аята есть история ниспослания — она в окне аята */}
        {story && <button className="a-story" onClick={() => act.onInfo(sid, a.n)}><Icon id="book" />История аята</button>}
        {comment && !story && <button className="a-story" onClick={() => act.onInfo(sid, a.n)}><Icon id="scroll" />Комментарий</button>}
        {sajda && <button className="a-story sj" onClick={() => act.onInfo(sid, a.n)} aria-label="Земной поклон">۩</button>}
        <div className="a-acts">
          <button className={'a-act' + (playing ? ' playing' : '')} onClick={() => (playing ? act.onToggle() : act.onPlay(sid, a.n))}
            aria-label={playing && act.sounding ? 'Пауза' : 'Слушать'}><Icon id={playing && act.sounding ? 'pause' : 'play'} /></button>
          <button className="a-act" onClick={() => act.onInfo(sid, a.n)} aria-label="Перевод и тафсир"><Icon id="info" /></button>
          <button className={'a-act' + (marked ? ' on' : '')} onClick={() => act.onBookmark(key)} aria-label="Закладка"><Icon id="bookmark" /></button>
        </div>
      </div>
      {opts.wbw
        ? <WbwText sid={sid} a={a} tajweed={opts.tajweed} hidden={hidden} />
        : <QpcText page={a.p} glyphs={a.g} tajweed={opts.tajweed} className={'a-ar' + (hidden ? ' hidden' : '')} />}
      <div className="a-tr">{opts.translation === 'aa' ? a.aa : a.ku}</div>
    </div>
  )
})

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

/** Свайп вбок по прокручиваемому блоку — соседняя сура (как листание страниц: вправо — следующая, влево — предыдущая).
 *  Содержимое едет за пальцем, подсказки «Следующая/Предыдущая» проявляются. */
export function useSideSwipe(
  box: RefObject<HTMLDivElement | null>, content: RefObject<HTMLDivElement | null>,
  hintNext: RefObject<HTMLDivElement | null>, hintPrev: RefObject<HTMLDivElement | null>,
  onSwipe: (dir: 1 | -1) => void, hasNext: boolean, hasPrev: boolean,
) {
  const swipeRef = useRef({ onSwipe, hasNext, hasPrev })
  swipeRef.current = { onSwipe, hasNext, hasPrev }
  useEffect(() => {
    const el = box.current!, c = content.current!
    let x = 0, y = 0, dx = 0, lock: null | 'h' | 'v' = null
    const set = (v: number, anim: boolean) => {
      c.style.transition = anim ? 'transform .28s cubic-bezier(.22,1,.36,1), opacity .28s' : 'none'
      c.style.transform = v ? `translateX(${v}px)` : ''
      c.style.opacity = String(1 - Math.min(0.5, Math.abs(v) / 600))
      const k = Math.min(1, Math.abs(v) / 90)
      if (hintNext.current) hintNext.current.style.opacity = String(v > 0 ? k : 0)
      if (hintPrev.current) hintPrev.current.style.opacity = String(v < 0 ? k : 0)
    }
    const start = (e: TouchEvent) => { x = e.touches[0].clientX; y = e.touches[0].clientY; dx = 0; lock = null }
    const move = (e: TouchEvent) => {
      const mx = e.touches[0].clientX - x, my = e.touches[0].clientY - y
      if (!lock && (Math.abs(mx) > 10 || Math.abs(my) > 10)) lock = Math.abs(mx) > Math.abs(my) * 1.3 ? 'h' : 'v'
      if (lock !== 'h') return
      e.preventDefault()
      const { hasNext, hasPrev } = swipeRef.current
      // у первой/последней суры — «резиновый» упор
      dx = (mx > 0 && !hasNext) || (mx < 0 && !hasPrev) ? mx * 0.25 : mx
      set(dx, false)
    }
    const end = () => {
      if (lock !== 'h') return
      const { hasNext, hasPrev, onSwipe } = swipeRef.current
      if (dx > 90 && hasNext) { set(el.clientWidth, true); haptic.tick(); setTimeout(() => onSwipe(1), 200) }
      else if (dx < -90 && hasPrev) { set(-el.clientWidth, true); haptic.tick(); setTimeout(() => onSwipe(-1), 200) }
      else set(0, true)
      lock = null
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end)
    }
  }, [])
}

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

export const MushafView = memo(function MushafView({ page, tajweed, playing, onAyahHold }: {
  page: number; tajweed: boolean; playing: string | null; onAyahHold: (key: string) => void
}) {
  const [mp, setMp] = useState<MushafPage | null>(null)
  const [ready, setReady] = useState(false)
  const [pressed, setPressed] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const hold = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const theme = useUi((s) => s.theme)
  const ix = useAsbabIndex() // у каких сур есть «История суры» — кнопка в звезде заголовка
  const kix = useKulievIndex()

  useEffect(() => {
    let alive = true
    setReady(false)
    Promise.all([loadMushafPage(page), loadPageFont(page, tajweed, theme)]).then(([m]) => { if (alive) { setMp(m); setReady(true) } })
    return () => { alive = false }
  }, [page, tajweed, theme])

  // альбомная ориентация телефона: 15 строк по высоте не влезут — подгоняем по ширине и листаем вниз
  const scroll = useLandscape()

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
      // строки растягиваются по ширине (space-between), так что запас почти не нужен
      const byWidth = maxW ? (20 * lines.clientWidth) / maxW * (page <= 2 ? 0.86 : 0.995) : 20
      const byHeight = lines.clientHeight / 15 / 1.45
      m.style.fontSize = Math.min(byWidth, page <= 2 || scroll ? byWidth : byHeight).toFixed(2) + 'px'
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(m)
    return () => ro.disconnect()
  }, [ready, mp, page, scroll])

  // долгое нажатие на аят → окно с переводом и тафсиром
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current.timer); hold.current = null; setPressed(null) }
  const onDown = (e: RPE) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k
    if (!key) return
    const timer = setTimeout(() => { hold.current = null; haptic.tap(); setPressed(null); onAyahHold(key) }, 450)
    hold.current = { x: e.clientX, y: e.clientY, timer }
    setPressed(key)
  }
  const onMove = (e: RPE) => {
    if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 8) cancelHold()
  }

  if (!mp || !ready) return <div className="mus"><div className="loading">Загрузка страницы…</div></div>
  const family = pageFont(page, tajweed, theme)
  return (
    <div className={'mus' + (scroll ? ' scroll' : '')}>
      <div className={'mushaf' + (page <= 2 ? ' short' : '')} ref={box}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={cancelHold} onPointerCancel={cancelHold} onContextMenu={(e) => e.preventDefault()}>
        <div className="lines">
          {layoutLines(mp).map((l, i) => {
            if (l.kind === 'head') return (
              <div key={i} className="ln head"><SurahBanner sid={l.sid} compact story={!!(ix?.w?.[l.sid] || kix?.s[l.sid]?.intro)} /><SurahStoryButton sid={l.sid} compact /></div>
            )
            if (l.kind === 'bism') return <Bismillah key={i} tajweed={tajweed} className="ln bism" />
            if (l.kind === 'empty') return <div key={i} className="ln" />
            return (
              <div key={i} className={'ln w' + (page <= 2 ? ' center' : '')} style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }}>
                {mp.lines[l.n].map(([g, key], j) => (
                  <span key={j} data-k={key} className={key === playing ? 'hl' : key === pressed ? 'press' : ''}>{g}</span>
                ))}
              </div>
            )
          })}
        </div>
        <div className="pfoot">{page}</div>
      </div>
    </div>
  )
})
