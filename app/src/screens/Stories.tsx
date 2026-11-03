import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { SurahBanner } from '../components/SurahBanner'
import { plural } from '../lib/plural'
import { useQuranMeta } from '../hooks/useQuranMeta'
import { loadAsbabSurah, loadKulievSurah, loadSurah, type Ayah, type AsbabIndex, type AsbabStory, type KulievIndex, type KulievSurah, type Surah } from '../lib/data'
import { setStoryMode, useStoryMode, type StoryMode } from '../lib/storyMode'
import { haptic } from '../lib/telegram'
import { useStore } from '../store/settings'
import { Story, useAsbabIndex } from './reader/Asbab'
import { KvNote } from './reader/KvFormat'
import { StoryMarks, StoryMenu, StoryOutline, StorySearch, type OutlineItem, type StoryOverlay } from './StoryMenu'
import { useKulievIndex } from './reader/Kuliev'
import { QpcText } from './reader/views'
import { useSideSwipe } from '../hooks/useSideSwipe'

/** Суры, у которых есть истории (у аятов или у суры целиком), по порядку */
export const storySurahs = (ix: AsbabIndex | null) =>
  ix ? [...new Set([...Object.keys(ix.n ?? {}), ...Object.keys(ix.w ?? {})].map(Number))].sort((a, b) => a - b) : []

/** Суры с комментариями Кулиева (вступление или пояснения к аятам) */
export const kulievSurahs = (kx: KulievIndex | null) =>
  kx ? Object.entries(kx.s).filter(([, v]) => v.intro || v.n.length).map(([k]) => Number(k)).sort((a, b) => a - b) : []

/** Суры для выбранного режима: «всё» — где есть хоть что-то, «истории» — только с историями, «комментарии» — только с комментариями */
export function modeSurahs(ix: AsbabIndex | null, kx: KulievIndex | null, mode: StoryMode) {
  const st = storySurahs(ix), kv = kulievSurahs(kx)
  return mode === 'st' ? st : mode === 'kv' ? kv : [...new Set([...st, ...kv])].sort((a, b) => a - b)
}

export const MODE_TITLE: Record<StoryMode, string> = { all: 'Истории и комментарии', st: 'Истории аятов', kv: 'Комментарии' }

/** Подпись режима — под названием суры и в окне выбора */
export const MODE_LABEL: Record<StoryMode, string> = { all: 'Истории и комментарии', st: 'Только истории', kv: 'Только комментарии' }

// длинные отрывки не выписываем целиком — они есть в самом Коране по кнопке
const MAX_AYAHS = 5

/** «Истории аятов»: читать подряд только аяты с историями ниспослания — сура за сурой, свайпом вбок */
export default function Stories() {
  const nav = useNavigate()
  const params = useParams()
  const [search] = useSearchParams()
  const meta = useQuranMeta()
  const ix = useAsbabIndex()
  const kx = useKulievIndex()
  const mode = useStoryMode(!!kx)
  const st = useStore()
  const sid = Math.min(114, Math.max(1, Number(params.surah) || 1))
  const startAyah = Number(search.get('a')) || 0 // «Продолжить чтение» — открыть на этом отрывке
  const [enter, setEnter] = useState<'' | 'from-left' | 'from-right'>('')
  const [overlay, setOverlay] = useState<StoryOverlay>(null)
  const [bare, setBare] = useState(false) // панели спрятаны: листаем — прячутся, тап по тексту — возвращаются
  const gesture = useRef({ x: 0, y: 0, t: 0, lastTouch: 0 })
  const lastTop = useRef(new Map<Element, number>())
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const jumpKey = search.get('j') ?? ''
  const ids = modeSurahs(ix, kx, mode)
  const at = ids.indexOf(sid)
  const next = at >= 0 && at < ids.length - 1 ? ids[at + 1] : null
  const prev = at > 0 ? ids[at - 1] : null
  const surah = meta?.surahs[sid - 1]

  const go = (dir: 1 | -1) => {
    const to = dir === 1 ? next : prev
    if (!to) return
    setEnter(dir === 1 ? 'from-left' : 'from-right')
    // соседняя сура заменяет текущую в истории переходов — «Назад» ведёт к списку
    nav(`/stories/${to}`, { replace: true })
  }

  // перейти к отрывку: в этой суре — прокрутка с подсветкой, в другой — открыть ту суру
  const openAt = (s: number, a: number) => {
    setOverlay(null)
    nav(`/stories/${s}?a=${a}&hl=1&j=${Date.now()}`, { replace: s === sid })
  }

  const onDown = (e: React.PointerEvent) => { gesture.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, lastTouch: Date.now() } }
  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8 || e.timeStamp - g.t > 350) return
    if ((e.target as HTMLElement).closest('button, a, input')) return
    setBare((b) => !b)
  }
  const onScroll = (e: React.UIEvent) => {
    const el = e.target as Element
    const prev = lastTop.current.get(el)
    lastTop.current.set(el, el.scrollTop)
    // только если листает сам человек, а не приложение при переходе к отрывку
    if (prev === undefined || Date.now() - gesture.current.lastTouch > 1500) return
    if (Math.abs(el.scrollTop - prev) > 6) setBare(true)
  }
  useEffect(() => { if (overlay) setBare(false) }, [overlay])

  return (
    <div className={'reader' + (bare ? ' bare' : '')} style={{ ['--ar-size' as string]: st.arSize + 'px', ['--tr-size' as string]: st.trSize + 'px' }}>
      <div className="view" onPointerDown={onDown} onPointerUp={onUp} onScrollCapture={onScroll} onWheel={() => { gesture.current.lastTouch = Date.now() }}>
        {surah && ix && (
          <StoryList key={sid + mode} surah={surah} ix={ix} mode={mode} hasKv={!!kx} enter={enter} onSwipe={go} startAyah={startAyah}
            jumpKey={jumpKey} highlight={!!search.get('hl')} onOutline={setOutline}
            nextName={next ? meta!.surahs[next - 1].name : null} prevName={prev ? meta!.surahs[prev - 1].name : null} />
        )}
      </div>
      <div className="rtop">
        <button className="sq glass" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="rtitle glass">
          <div className="t">
            <b>{surah ? surah.name : MODE_TITLE[mode]}</b>
            <span>{surah ? MODE_LABEL[mode] : ''}</span>
          </div>
        </div>
        <button className="sq glass" onClick={() => setOverlay('menu')} aria-label="Меню"><Icon id="grid" /></button>
      </div>
      {surah && overlay === 'menu' && <StoryMenu surah={surah} mode={mode} hasKv={!!kx} onClose={() => setOverlay(null)} onGo={setOverlay} />}
      {surah && overlay === 'outline' && <StoryOutline surah={surah} items={outline} onClose={() => setOverlay(null)} onPick={(a) => openAt(sid, a)} />}
      {overlay === 'marks' && <StoryMarks onClose={() => setOverlay(null)} onOpen={openAt} />}
      {surah && overlay === 'search' && (
        <StorySearch surah={surah} ix={ix} kx={kx} mode={mode} onClose={() => setOverlay(null)}
          onOpen={(hit) => { if (mode !== 'all' && mode !== hit.kind) setStoryMode('all'); openAt(hit.s, hit.from) }} />
      )}
    </div>
  )
}

interface Block { from: number; to: number; list: AsbabStory[]; kv: string[][] }

function StoryList({ surah, ix, mode, hasKv, enter, onSwipe, nextName, prevName, startAyah, jumpKey, highlight, onOutline }: {
  jumpKey: string; highlight: boolean; onOutline: (items: OutlineItem[]) => void
  surah: Surah; ix: AsbabIndex; mode: StoryMode; hasKv: boolean; enter: '' | 'from-left' | 'from-right'; onSwipe: (dir: 1 | -1) => void
  nextName: string | null; prevName: string | null; startAyah: number
}) {
  const nav = useNavigate()
  const saveLast = useStore((s) => s.setStoryLast)
  const marks = useStore((s) => s.storyMarks)
  const setMarks = useStore((s) => s.set)
  const [stories, setStories] = useState<AsbabStory[] | null>(null)
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null)
  const [kv, setKv] = useState<KulievSurah | null | undefined>(undefined)
  const box = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const hintNext = useRef<HTMLDivElement>(null)
  const hintPrev = useRef<HTMLDivElement>(null)
  useSideSwipe(box, content, hintNext, hintPrev, onSwipe, !!nextName, !!prevName)

  useEffect(() => {
    let alive = true
    Promise.all([loadAsbabSurah(surah.id), loadSurah(surah.id), hasKv && mode !== 'st' ? loadKulievSurah(surah.id) : Promise.resolve(null)])
      .then(([s, a, k]) => { if (alive) { setStories(s ?? []); setAyahs(a); setKv(k) } })
    return () => { alive = false }
  }, [surah.id, hasKv, mode])

  // истории суры целиком — вверху; истории аятов — по группам одного и того же отрывка, по порядку аятов;
  // комментарии Кулиева — к своему отрывку, а если у аята историй нет — отдельным блоком
  const whole = mode === 'kv' ? [] : stories?.filter((x) => x.whole) ?? []
  const groups = useMemo(() => {
    const out: Block[] = []
    if (mode !== 'kv') {
      for (const x of stories ?? []) {
        if (x.whole) continue
        const g = out.find((o) => o.from === x.from && o.to === x.to)
        if (g) g.list.push(x)
        else out.push({ from: x.from, to: x.to, list: [x], kv: [] })
      }
    }
    if (mode !== 'st' && kv) {
      for (const [k, notes] of Object.entries(kv.notes)) {
        const n = Number(k)
        const g = out.find((o) => o.from <= n && n <= o.to)
        if (g) g.kv.push(...notes)
        else out.push({ from: n, to: n, list: [], kv: notes })
      }
    }
    return out.sort((a, b) => a.from - b.from || a.to - b.to)
  }, [stories, kv, mode])
  const count = groups.reduce((n, g) => n + g.list.length, 0)
  const kvCount = groups.filter((g) => g.kv.length).length
  const loaded = !!stories && kv !== undefined

  // открыть на сохранённом отрывке
  useLayoutEffect(() => {
    if (!ayahs || !startAyah || !box.current) return
    const el = box.current.querySelector<HTMLElement>(`[data-from="${startAyah}"]`)
    if (!el) return
    box.current.scrollTop = el.offsetTop - 80
    if (highlight) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2600) }
  }, [ayahs, kv, stories, startAyah, jumpKey])

  // оглавление суры для меню
  useEffect(() => { onOutline(groups.map((g) => ({ from: g.from, to: g.to, st: g.list.length, kv: g.kv.length }))) }, [groups])

  // какой отрывок сейчас вверху экрана → место для «Продолжить чтение» в разделе «Истории»
  useEffect(() => {
    const el = box.current
    if (!el || !ayahs) return
    let t: ReturnType<typeof setTimeout> | undefined
    const check = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const top = el.scrollTop + 120
        let a = groups[0]?.from ?? 1
        for (const g of el.querySelectorAll<HTMLElement>('[data-from]')) { if (g.offsetTop <= top) a = Number(g.dataset.from); else break }
        saveLast({ s: surah.id, a })
      }, 600)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    return () => { el.removeEventListener('scroll', check); clearTimeout(t) }
  }, [ayahs, groups, surah.id, saveLast])

  return (
    <div className="vscroll" ref={box}>
      {nextName && <div className="swipe-hint left" ref={hintNext}>Следующая<b>{nextName}</b></div>}
      {prevName && <div className="swipe-hint right" ref={hintPrev}>Предыдущая<b>{prevName}</b></div>}
      <div className={'content' + (enter ? ' ' + enter : '')} ref={content}>
        <div className="s-head">
          <SurahBanner sid={surah.id} />
          <div className="s-meta">
            {[
              mode !== 'kv' && count ? `${count} ${plural(count, 'история', 'истории', 'историй')} у аятов` : '',
              mode !== 'kv' && whole.length ? 'история суры' : '',
              mode !== 'st' && kvCount ? `${kvCount} ${plural(kvCount, 'комментарий', 'комментария', 'комментариев')}` : '',
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        {!loaded && <div className="loading">Загрузка…</div>}
        {mode !== 'st' && kv && kv.intro.length > 0 && (
          <>
            <div className="as-label">О суре</div>
            <div className="kv"><div className="kv-note"><KvNote paras={kv.intro} /></div></div>
          </>
        )}
        {whole.length > 0 && (
          <>
            <div className="as-label">История суры</div>
            <Group list={whole} ix={ix} />
          </>
        )}
        {ayahs && groups.map((g) => (
          <div key={`${g.from}-${g.to}`} className="st-group" data-from={g.from}>
            <div className="st-label">
              <div className="as-label">{g.from === g.to ? `Аят ${g.from}` : `Аяты ${g.from}–${g.to}`}</div>
              <button className={'st-mark' + (marks.includes(`${surah.id}:${g.from}`) ? ' on' : '')} aria-label="Закладка" onClick={() => {
                haptic.tap()
                const k = `${surah.id}:${g.from}`
                setMarks({ storyMarks: marks.includes(k) ? marks.filter((m) => m !== k) : [...marks, k] })
              }}><Icon id="bookmark" /></button>
            </div>
            <Passage sid={surah.id} ayahs={ayahs.filter((a) => a.n >= g.from && a.n <= g.to)} />
            {g.list.length > 0 && <Group list={g.list} ix={ix} />}
            {g.kv.length > 0 && (
              <>
                <div className="as-label">Комментарий</div>
                <div className="kv">
                  {g.kv.map((paras, i) => <div key={i} className="kv-note"><KvNote paras={paras} /></div>)}
                </div>
              </>
            )}
            <button className="asb-chain st-open" onClick={() => nav(`/read/${surah.id}?a=${g.from}`)}>
              Открыть в Коране →
            </button>
          </div>
        ))}
        {loaded && !ayahs && <div className="loading">Загрузка…</div>}
        <div className="tafsir-hint asb-ai">
          {mode !== 'kv' ? 'Истории переведены с арабского с помощью ИИ, а не человеком — в переводе возможны неточности.' : 'Комментарии Э. Кулиева (издание Комплекса короля Фахда).'}
          {nextName ? ' Свайп вправо — следующая сура.' : ''}
        </div>
      </div>
    </div>
  )
}

/** Текст отрывка: арабский и перевод; длинный — первые аяты, остальное в Коране */
function Passage({ sid, ayahs }: { sid: number; ayahs: Ayah[] }) {
  const st = useStore()
  const shown = ayahs.slice(0, MAX_AYAHS)
  return (
    <div className="st-passage">
      {shown.map((a) => (
        <div key={a.n} className="st-ayah">
          <QpcText page={a.p} glyphs={a.g} tajweed={st.tajweed} className="a-ar" />
          <div className="a-tr"><span className="st-n">{sid}:{a.n}</span> {st.translation === 'aa' ? a.aa : a.ku}</div>
        </div>
      ))}
      {ayahs.length > shown.length && (
        <div className="st-more">…и ещё {ayahs.length - shown.length} {plural(ayahs.length - shown.length, 'аят', 'аята', 'аятов')} — полностью в Коране</div>
      )}
    </div>
  )
}

/** Истории одного отрывка: одна — сразу раскрыта, несколько — раскрываются по нажатию */
function Group({ list, ix }: { list: AsbabStory[]; ix: AsbabIndex }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="asb-list">
      {list.map((x) => (
        <Story key={x.id} x={x} ix={ix} open={open === x.id || list.length === 1} single={list.length === 1}
          onToggle={() => { haptic.tap(); setOpen(open === x.id ? null : x.id) }} />
      ))}
    </div>
  )
}
