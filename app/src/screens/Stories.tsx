import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { SurahBanner } from '../components/SurahBanner'
import { plural, useQuranMeta } from '../components/ui'
import { loadAsbabSurah, loadSurah, surahGlyph, type Ayah, type AsbabIndex, type AsbabStory, type Surah } from '../lib/data'
import { haptic } from '../lib/telegram'
import { useStore } from '../store/settings'
import { Story, useAsbabIndex } from './reader/Asbab'
import { QpcText, useSideSwipe } from './reader/views'

/** Суры, у которых есть истории (у аятов или у суры целиком), по порядку */
export const storySurahs = (ix: AsbabIndex | null) =>
  ix ? [...new Set([...Object.keys(ix.n ?? {}), ...Object.keys(ix.w ?? {})].map(Number))].sort((a, b) => a - b) : []

// длинные отрывки не выписываем целиком — они есть в самом Коране по кнопке
const MAX_AYAHS = 5

/** «Истории аятов»: читать подряд только аяты с историями ниспослания — сура за сурой, свайпом вбок */
export default function Stories() {
  const nav = useNavigate()
  const params = useParams()
  const [search] = useSearchParams()
  const meta = useQuranMeta()
  const ix = useAsbabIndex()
  const sid = Math.min(114, Math.max(1, Number(params.surah) || 1))
  const startAyah = Number(search.get('a')) || 0 // «Продолжить чтение» — открыть на этом отрывке
  const [enter, setEnter] = useState<'' | 'from-left' | 'from-right'>('')
  const ids = storySurahs(ix)
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

  return (
    <div className="reader">
      <div className="view">
        {surah && ix && (
          <StoryList key={sid} surah={surah} ix={ix} enter={enter} onSwipe={go} startAyah={startAyah}
            nextName={next ? meta!.surahs[next - 1].name : null} prevName={prev ? meta!.surahs[prev - 1].name : null} />
        )}
      </div>
      <div className="rtop">
        <button className="sq glass" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="rtitle glass">
          <div className="t">
            <b>{surah ? `Истории · ${surah.name}` : 'Истории аятов'}</b>
            <span>{surah ? `Сура ${surah.id} · ${surah.mk ? 'Мекканская' : 'Мединская'}` : ''}</span>
          </div>
          {surah && <span className="sname">{surahGlyph(surah.id)}</span>}
        </div>
      </div>
    </div>
  )
}

function StoryList({ surah, ix, enter, onSwipe, nextName, prevName, startAyah }: {
  surah: Surah; ix: AsbabIndex; enter: '' | 'from-left' | 'from-right'; onSwipe: (dir: 1 | -1) => void
  nextName: string | null; prevName: string | null; startAyah: number
}) {
  const nav = useNavigate()
  const saveLast = useStore((s) => s.setStoryLast)
  const [stories, setStories] = useState<AsbabStory[] | null>(null)
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const hintNext = useRef<HTMLDivElement>(null)
  const hintPrev = useRef<HTMLDivElement>(null)
  useSideSwipe(box, content, hintNext, hintPrev, onSwipe, !!nextName, !!prevName)

  useEffect(() => {
    let alive = true
    Promise.all([loadAsbabSurah(surah.id), loadSurah(surah.id)]).then(([s, a]) => { if (alive) { setStories(s ?? []); setAyahs(a) } })
    return () => { alive = false }
  }, [surah.id])

  // истории суры целиком — вверху; истории аятов — по группам одного и того же отрывка, по порядку аятов
  const whole = stories?.filter((x) => x.whole) ?? []
  const groups = useMemo(() => {
    const out: { from: number; to: number; list: AsbabStory[] }[] = []
    for (const x of stories ?? []) {
      if (x.whole) continue
      const g = out.find((o) => o.from === x.from && o.to === x.to)
      if (g) g.list.push(x)
      else out.push({ from: x.from, to: x.to, list: [x] })
    }
    return out.sort((a, b) => a.from - b.from || a.to - b.to)
  }, [stories])
  const count = groups.reduce((n, g) => n + g.list.length, 0)

  // открыть на сохранённом отрывке
  useLayoutEffect(() => {
    if (!ayahs || !startAyah || !box.current) return
    const el = box.current.querySelector<HTMLElement>(`[data-from="${startAyah}"]`)
    if (el) box.current.scrollTop = el.offsetTop - 80
  }, [ayahs, startAyah])

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
            {count} {plural(count, 'история', 'истории', 'историй')} у аятов{whole.length ? ' · история суры' : ''}
          </div>
        </div>
        {!stories && <div className="loading">Загрузка…</div>}
        {whole.length > 0 && (
          <>
            <div className="as-label">История суры</div>
            <Group list={whole} ix={ix} />
          </>
        )}
        {ayahs && groups.map((g) => (
          <div key={`${g.from}-${g.to}`} className="st-group" data-from={g.from}>
            <div className="as-label">{g.from === g.to ? `Аят ${g.from}` : `Аяты ${g.from}–${g.to}`}</div>
            <Passage sid={surah.id} ayahs={ayahs.filter((a) => a.n >= g.from && a.n <= g.to)} />
            <Group list={g.list} ix={ix} />
            <button className="asb-chain st-open" onClick={() => nav(`/read/${surah.id}?a=${g.from}`)}>
              Открыть в Коране →
            </button>
          </div>
        ))}
        {stories && !ayahs && <div className="loading">Загрузка…</div>}
        <div className="tafsir-hint asb-ai">
          Истории переведены с арабского с помощью ИИ, а не человеком — в переводе возможны неточности.
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
