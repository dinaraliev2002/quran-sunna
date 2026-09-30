import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { ARABIC_FONTS } from '../../lib/azkar'
import { favBook, loadBook, loadHadithIndex, shareBody, type HBookData, type HIndex } from '../../lib/hadith'
import { haptic, shareText } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { ArParas, RuParas, splitTitle } from './HadithText'
import { HadithSettings } from './HadithSettings'

// на какой карточке был человек в каждой книге (при возврате назад — та же карточка)
const cardMemory = new Map<string, number>()

// Книга (глава) сборника: хадисы — карточки, листаются вбок (свайп влево — следующий),
// текст длинной карточки прокручивается внутри неё. Внизу — переход к соседним книгам.
export default function Book() {
  const nav = useNavigate()
  const { cid = '', n = '1' } = useParams()
  const [search] = useSearchParams()
  const focus = search.has('i') ? Number(search.get('i')) : null
  const bn = Number(n)
  const [idx, setIdx] = useState<HIndex | null>(null)
  const [book, setBook] = useState<HBookData | null>(null)
  const [cur, setCur] = useState(0)
  const [settings, setSettings] = useState(false)
  const st = useStore()
  const track = useRef<HTMLDivElement>(null)
  const memKey = `${cid}/${bn}/${focus ?? ''}`

  useEffect(() => {
    let alive = true
    setBook(null)
    loadHadithIndex().then((x) => alive && setIdx(x))
    loadBook(cid, bn).then((x) => alive && setBook(x))
    return () => { alive = false }
  }, [cid, bn])

  const col = idx?.collections.find((c) => c.id === cid)
  const pos = col ? col.books.findIndex((b) => b.n === bn) : -1
  const meta = col?.books[pos]
  const prev = col && pos > 0 ? col.books[pos - 1] : null
  const next = col && pos >= 0 && pos < col.books.length - 1 ? col.books[pos + 1] : null
  const single = col?.books.length === 1
  const items = book?.items ?? []

  // открыть на той же карточке, что в прошлый раз, или на нужном хадисе (из избранного / «Продолжить»)
  useLayoutEffect(() => {
    const el = track.current
    if (!book || !el) return
    const k = Math.min(items.length - 1, Math.max(0, cardMemory.get(memKey) ?? focus ?? 0))
    el.scrollLeft = k * el.clientWidth
    setCur(k)
    st.setHadithLast({ c: cid, n: bn, i: k })
  }, [book])

  const onScroll = () => {
    const el = track.current!
    const k = Math.round(el.scrollLeft / el.clientWidth)
    if (k === cur || k < 0 || k >= items.length) return
    setCur(k)
    haptic.tick()
    cardMemory.set(memKey, k)
    st.setHadithLast({ c: cid, n: bn, i: k })
  }
  const goCard = (k: number) => track.current?.scrollTo({ left: k * track.current.clientWidth, behavior: 'smooth' })
  const goBook = (b: { n: number } | null) => b && nav(`/hadith/c/${cid}/${b.n}`, { replace: true })

  const title = single ? col?.name : book?.title ?? meta?.title ?? col?.name ?? 'Хадисы'
  const sub = single ? col?.author : [col?.name, meta?.range && `хадисы ${meta.range}`].filter(Boolean).join(' · ')

  return (
    <div className="hdk" style={{ ['--hd-ar' as string]: st.hdArSize + 'px', ['--hd-tr' as string]: st.hdTrSize + 'px', ['--az-font' as string]: ARABIC_FONTS[st.azFont ?? 'sch'].css }}>
      <div className="azc-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{title}</b><span>{sub}</span></div>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Настройки текста"><Icon id="gear" /></button>
      </div>
      {items.length > 1 && <div className="hdk-progress"><i style={{ width: `${((cur + 1) / items.length) * 100}%` }} /></div>}

      {!book && <div className="loading">Загрузка…</div>}
      <div className="azc-track" ref={track} onScroll={onScroll}>
        {items.map((it, i) => {
          // рисуем только соседние карточки — в книге бывает больше сотни разделов
          if (Math.abs(i - cur) > 2) return <section key={i} className="azc-card" />
          const { no, title: t } = splitTitle(it.t)
          const isHadith = it.h !== undefined // отдельный хадис из главы (аль-Бухари, Муслим)
          const key = favBook(cid, bn, i)
          const fav = st.hfav.includes(key)
          const ref = `${col?.name ?? ''}${isHadith ? (it.h ? `, № ${it.h}` : '') : no ? `, ${/^\d/.test(no) ? '№ ' + no : no.toLowerCase()}` : ''}`
          // хадис без перевода — арабский текст показываем всегда
          const showAr = (st.hdAr || it.ru.length === 0) && it.ar.length > 0
          return (
            <section key={i} className="azc-card">
              <article className="hdk-body">
                <div className="hd-card-h">
                  {isHadith ? <span className="hd-no">{it.h ? `Хадис № ${it.h}` : 'Другая версия'}</span>
                    : no ? <span className="hd-no">{no}</span> : <span className="hd-count">{i + 1} из {items.length}</span>}
                  <div className="hd-acts">
                    <button className={fav ? 'on' : ''} onClick={() => { haptic.tap(); st.toggleHadithFav(key) }} aria-label={fav ? 'Убрать из избранного' : 'В избранное'}>
                      <Icon id="bookmark" />
                    </button>
                    <button onClick={() => shareText(shareBody(isHadith ? '' : t, it.ru.join('\n\n'), ref))} aria-label="Поделиться"><Icon id="share" /></button>
                  </div>
                </div>
                {isHadith ? (t || no) && <div className="hd-bab">{no}{no && t ? ' · ' : ''}{t}</div> : t && <h3 className="hd-title">{t}</h3>}
                {showAr && <ArParas paras={it.ar} />}
                {showAr && it.ru.length > 0 && <div className="azc-divider"><span>۞</span></div>}
                {it.ru.length > 0 ? <RuParas paras={it.ru} hadith={isHadith || undefined} /> : <p className="hd-src">Перевода на русский пока нет</p>}
              </article>
            </section>
          )
        })}
      </div>

      {book && (
        <div className="hdk-bar">
          {!single && (
            <button className="hdk-book" disabled={!prev} onClick={() => goBook(prev)} aria-label="Предыдущая глава">
              <Icon id="back" /><span>{prev ? (cid === 'bukhari' || cid === 'muslim') && !meta?.grp ? 'Пред. книга' : 'Пред. глава' : ''}</span>
            </button>
          )}
          <div className="hdk-pager">
            <button disabled={cur === 0} onClick={() => goCard(cur - 1)} aria-label="Предыдущий хадис"><Icon id="back" /></button>
            <span>{cur + 1} / {items.length}</span>
            <button disabled={cur >= items.length - 1} onClick={() => goCard(cur + 1)} aria-label="Следующий хадис"><Icon id="right" /></button>
          </div>
          {!single && (
            <button className="hdk-book" disabled={!next} onClick={() => goBook(next)} aria-label="Следующая глава">
              <span>{next ? (cid === 'bukhari' || cid === 'muslim') && !meta?.grp ? 'След. книга' : 'След. глава' : ''}</span><Icon id="right" />
            </button>
          )}
        </div>
      )}

      {settings && <HadithSettings onClose={() => setSettings(false)} />}
    </div>
  )
}
