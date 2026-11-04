import { createPortal } from 'react-dom'
import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { SurahBanner } from '../../../components/SurahBanner'
import { loadMushafPage, loadWbw } from '../../../lib/data'
import { loadPageFont, pageFont, pagePalette } from '../../../lib/fonts'
import { layoutLines } from '../../../lib/mushafLayout'
import { haptic } from '../../../lib/telegram'
import { useLandscape } from '../../../hooks/useLandscape'
import { useUi } from '../../../store/ui'
import type { MushafPage } from '../../../types/quran'
import { SurahStoryButton, useAsbabIndex } from '../Asbab'
import { useKulievIndex } from '../Kuliev'
import { Bismillah } from './Bismillah'

// ---------- Режим «Мусхаф»: печатная страница ----------

export const MushafView = memo(function MushafView({ page, tajweed, playing, onAyahHold }: {
  page: number; tajweed: boolean; playing: string | null; onAyahHold: (key: string) => void
}) {
  const [mp, setMp] = useState<MushafPage | null>(null)
  const [ready, setReady] = useState(false)
  const [pressed, setPressed] = useState<string | null>(null)
  const [tall, setTall] = useState(false) // страница не помещается по высоте — листается вниз
  const box = useRef<HTMLDivElement>(null)
  const hold = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const tap = useRef<{ t: number; el: HTMLElement } | null>(null)
  const [tip, setTip] = useState<{ x: number; top: number; bottom: number; g: string; text: string } | null>(null)
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
      m.style.fontSize = Math.min(byWidth, page <= 2 || scroll || tall ? byWidth : byHeight).toFixed(2) + 'px'
      // Заголовки сур по высоте зависят от ширины страницы, а не от шрифта. На широком и невысоком окне (браузер) страница
      // не помещается целиком — тогда не уменьшаем текст, а даём прокрутку страницы вниз (как в альбомной ориентации)
      if (page > 2 && !scroll) {
        const mus = m.parentElement as HTMLElement
        const cs = getComputedStyle(mus)
        const pf = m.querySelector<HTMLElement>('.pfoot')
        const avail = mus.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 12 - (pf?.offsetHeight ?? 24)
        // сколько места нужно странице при ширинном шрифте — считаем по замерам (не зависит от того, листается страница или нет)
        const fs0 = parseFloat(m.style.fontSize)
        const hOf = (sel: string) => (lines.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0) / fs0
        const kw = hOf('.ln.w') || 1.55
        const kb = hOf('.ln.bism') || kw
        let need = 0
        lines.querySelectorAll<HTMLElement>(':scope > .ln').forEach((c) => {
          need += c.classList.contains('head') ? c.offsetHeight : c.classList.contains('w') ? kw * byWidth : c.classList.contains('bism') ? kb * byWidth : 0
        })
        // из прокрутки возвращаемся в целую страницу только с запасом — чтобы не «мигало» на границе
        const over = need > avail - (tall ? 12 : 0)
        setTall((t) => (t === over ? t : over))
      }
      // короткие строки (конец суры) не растягиваем на всю ширину — иначе между словами огромные пробелы
      lines.querySelectorAll<HTMLElement>('.ln.w').forEach((ln) => {
        let w = 0
        ln.querySelectorAll('span').forEach((sp) => (w += sp.getBoundingClientRect().width))
        ln.classList.toggle('loose', w < lines.clientWidth * 0.72)
      })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(m)
    if (m.parentElement) ro.observe(m.parentElement) // окно браузера изменилось по высоте
    return () => ro.disconnect()
  }, [ready, mp, page, scroll, tall])

  // страница сменилась — подсказка со словом больше не нужна; сама пропадает через 5 секунд
  useEffect(() => { setTip(null) }, [page])
  useEffect(() => {
    if (!tip) return
    const t = setTimeout(() => setTip(null), 5000)
    return () => clearTimeout(t)
  }, [tip])

  // двойное нажатие на слово → подсказка с переводом этого слова
  const showWord = async (el: HTMLElement) => {
    const key = el.dataset.k!
    const [s, a] = key.split(':').map(Number)
    const same = [...(box.current?.querySelectorAll<HTMLElement>(`span[data-k="${key}"]:not([data-e])`) ?? [])]
    const i = same.indexOf(el)
    if (i < 0) return
    const rows = await loadWbw(s).catch(() => null)
    const tr = rows?.[a - 1]
    if (!tr) return
    let k = i
    while (k > 0 && !tr[k]) k-- // пустая подпись — слово переведено вместе с предыдущим
    if (!tr[k]) return
    haptic.tick('quran')
    const r = el.getBoundingClientRect()
    setTip({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom, g: el.textContent ?? '', text: tr[k] })
  }
  const onUp = (e: RPE) => {
    const quick = hold.current !== null // отпустили до долгого нажатия и без сдвига
    cancelHold()
    if (!quick) { tap.current = null; return }
    const el = (e.target as HTMLElement).closest<HTMLElement>('span[data-k]')
    if (!el || el.dataset.e) { tap.current = null; return }
    const now = Date.now()
    if (tap.current && now - tap.current.t < 350 && tap.current.el === el) { tap.current = null; showWord(el) } else tap.current = { t: now, el }
  }

  // долгое нажатие на аят → окно с переводом и тафсиром
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current.timer); hold.current = null; setPressed(null) }
  const onDown = (e: RPE) => {
    if (tip) setTip(null)
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
    <div className={'mus' + (scroll || tall ? ' scroll' : '')}>
      <div className={'mushaf' + (page <= 2 ? ' short' : '')} ref={box}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={cancelHold} onContextMenu={(e) => e.preventDefault()}>
        <div className="lines">
          {layoutLines(mp).map((l, i) => {
            if (l.kind === 'head') return (
              <div key={i} className="ln head"><SurahBanner sid={l.sid} compact story={!!(ix?.w?.[l.sid] || kix?.s[l.sid]?.intro)} /><SurahStoryButton sid={l.sid} compact /></div>
            )
            if (l.kind === 'bism') return <Bismillah key={i} tajweed={tajweed} className="ln bism" />
            if (l.kind === 'empty') return <div key={i} className="ln" />
            return (
              <div key={i} className={'ln w' + (page <= 2 ? ' center' : '')} style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }}>
                {mp.lines[l.n].map(([g, key, end], j) => (
                  <span key={j} data-k={key} data-e={end ? 1 : undefined} className={key === playing ? 'hl' : key === pressed ? 'press' : ''}>{g}</span>
                ))}
              </div>
            )
          })}
        </div>
        <div className="pfoot">{page}</div>
      </div>
      {tip && createPortal(
        <div className={'mw-tip' + (tip.top < 130 ? ' below' : '')} style={{ left: Math.min(Math.max(tip.x, 90), window.innerWidth - 90), top: tip.top < 130 ? tip.bottom + 8 : tip.top - 8 }}>
          <span className="g qpc" style={{ fontFamily: `'${family}'`, ['--pal' as string]: pagePalette(page) }}>{tip.g}</span>
          <b>{tip.text}</b>
        </div>, document.body)}
    </div>
  )
})
