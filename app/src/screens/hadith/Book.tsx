import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { ARABIC_FONTS } from '../../lib/azkar'
import { favBook, loadBook, loadHadithIndex, shareBody, type HBookData, type HIndex } from '../../lib/hadith'
import { haptic, shareText } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { ArParas, RuParas, splitTitle } from './HadithText'
import { HadithSettings } from './HadithSettings'

// где был человек в каждой книге (при возврате назад — то же место)
const scrollMemory = new Map<string, number>()

// Книга (глава) сборника: хадисы идут подряд сверху вниз, внизу — переход к соседним главам
export default function Book() {
  const nav = useNavigate()
  const { cid = '', n = '1' } = useParams()
  const [search] = useSearchParams()
  const focus = search.has('i') ? Number(search.get('i')) : null
  const bn = Number(n)
  const [idx, setIdx] = useState<HIndex | null>(null)
  const [book, setBook] = useState<HBookData | null>(null)
  const [settings, setSettings] = useState(false)
  const st = useStore()
  const screen = useRef<HTMLDivElement>(null)
  const memKey = `${cid}/${bn}/${focus ?? ''}`

  useEffect(() => {
    setBook(null)
    loadHadithIndex().then(setIdx)
    loadBook(cid, bn).then(setBook)
  }, [cid, bn])

  const col = idx?.collections.find((c) => c.id === cid)
  const pos = col ? col.books.findIndex((b) => b.n === bn) : -1
  const prev = col && pos > 0 ? col.books[pos - 1] : null
  const next = col && pos >= 0 && pos < col.books.length - 1 ? col.books[pos + 1] : null
  const single = col?.books.length === 1

  // открыть: там же, где были, или на нужном хадисе (из избранного / «Продолжить»)
  useLayoutEffect(() => {
    const el = screen.current
    if (!book || !el) return
    if (scrollMemory.has(memKey)) { el.scrollTop = scrollMemory.get(memKey)!; return }
    if (focus !== null) {
      const card = el.querySelector<HTMLElement>(`[data-i="${focus}"]`)
      if (card) el.scrollTop = card.offsetTop - 70
    } else el.scrollTop = 0
  }, [book])

  // запоминаем, какой хадис сейчас на экране — для «Продолжить»
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onScroll = () => {
    const el = screen.current!
    scrollMemory.set(memKey, el.scrollTop)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const cards = el.querySelectorAll<HTMLElement>('[data-i]')
      let cur = 0
      for (const c of cards) { if (c.offsetTop - el.scrollTop < el.clientHeight * 0.35) cur = Number(c.dataset.i); else break }
      st.setHadithLast({ c: cid, n: bn, i: cur })
    }, 500)
  }
  useEffect(() => { if (book) st.setHadithLast({ c: cid, n: bn, i: focus ?? 0 }) }, [book])
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const go = (b: { n: number } | null) => b && nav(`/hadith/c/${cid}/${b.n}`, { replace: true })

  return (
    <div
      className="screen hdb" ref={screen} onScroll={onScroll}
      style={{ ['--hd-ar' as string]: st.hdArSize + 'px', ['--hd-tr' as string]: st.hdTrSize + 'px', ['--az-font' as string]: ARABIC_FONTS[st.azFont ?? 'sch'].css }}
    >
      <div className="hdb-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{single ? col?.name : book?.title ?? col?.name ?? 'Хадисы'}</b><span>{single ? col?.author : col?.name ?? ''}</span></div>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Настройки текста"><Icon id="gear" /></button>
      </div>

      {!book && <div className="loading">Загрузка…</div>}
      {book && !single && (
        <div className="hdb-head">
          {book.ar && <div className="hdb-head-ar">{book.ar}</div>}
          <h1>{book.title}</h1>
          {col && col.books[pos]?.range && <span>Хадисы {col.books[pos].range}</span>}
        </div>
      )}

      {book?.items.map((it, i) => {
        const { no, title } = splitTitle(it.t)
        const key = favBook(cid, bn, i)
        const fav = st.hfav.includes(key)
        const ref = `${col?.name ?? ''}${no ? `, ${/^\d/.test(no) ? '№ ' + no : no.toLowerCase()}` : ''}`
        return (
          <article key={i} className="hd-card" data-i={i}>
            <div className="hd-card-h">
              {no && <span className="hd-no">{no}</span>}
              <div className="hd-acts">
                <button className={fav ? 'on' : ''} onClick={() => { haptic.tap(); st.toggleHadithFav(key) }} aria-label={fav ? 'Убрать из избранного' : 'В избранное'}>
                  <Icon id="bookmark" />
                </button>
                <button onClick={() => shareText(shareBody(title, it.ru.join('\n\n'), ref))} aria-label="Поделиться"><Icon id="share" /></button>
              </div>
            </div>
            {title && <h3 className="hd-title">{title}</h3>}
            {st.hdShowAr && it.ar.length > 0 && <ArParas paras={it.ar} />}
            {st.hdShowAr && it.ar.length > 0 && it.ru.length > 0 && <div className="azc-divider"><span>۞</span></div>}
            {it.ru.length > 0 ? <RuParas paras={it.ru} /> : <p className="hd-src">Перевода нет</p>}
          </article>
        )
      })}

      {book && !single && (
        <div className="hdb-nav">
          <button disabled={!prev} onClick={() => go(prev)}><Icon id="back" /><span>{prev ? prev.title : ''}</span></button>
          <button disabled={!next} onClick={() => go(next)}><span>{next ? next.title : ''}</span><Icon id="right" /></button>
        </div>
      )}

      {settings && <HadithSettings onClose={() => setSettings(false)} />}
    </div>
  )
}
