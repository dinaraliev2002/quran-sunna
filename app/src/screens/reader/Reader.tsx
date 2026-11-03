import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPE, type UIEvent as RUE } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Tour } from '../../components/Tour'
import { useQuranMeta } from '../../hooks/useQuranMeta'
import { juzByPage, loadMushafPage, loadSurah, surahByPage, surahGlyph, type Surah } from '../../lib/data'
import { haptic } from '../../lib/telegram'
import { setSurahCounts } from '../../lib/listen'
import { RECITERS, setBitrates, setMediaTitle, setReciter, usePlayer, type MemoOptions } from '../../store/player'
import { useStore, type ReadMode } from '../../store/settings'
import { Dial } from './Dial'
import { Pager } from './Pager'
import { useKulievIndex } from './Kuliev'
import { AyahSheet, BookmarksSheet, MemoSheet, MenuPanel, MODES, ModePop, PickerSheet, ReaderSettingsSheet } from './sheets'
import { MushafView, PageAyahs, SuraView, type AyahActions } from './views'
import { MemoBar } from './MemoBar'
import { readerTour } from './tour'
import { useFlashAyah } from '../../hooks/useFlashAyah'
import { useLastRead } from '../../hooks/useLastRead'
import { usePageReadTimer } from '../../hooks/usePageReadTimer'

type Overlay = null | 'pop' | 'menu' | 'picker' | 'search' | 'memo' | 'bookmarks' | 'settings' | { tafsir: [number, number] }

export default function Reader() {
  const meta = useQuranMeta()
  const loc = useLocation()
  if (!meta) return <div className="reader"><div className="loading">Загрузка…</div></div>
  // новый адрес (другая сура/аят) — новый экран чтения с нуля
  return <ReaderInner key={loc.pathname + loc.search} surahs={meta.surahs} juzPages={meta.juzPages} />
}

function ReaderInner({ surahs, juzPages }: { surahs: Surah[]; juzPages: number[] }) {
  const nav = useNavigate()
  const kulievIx = useKulievIndex()
  const params = useParams()
  const [search] = useSearchParams()
  const st = useStore()
  const player = usePlayer()

  const initSurah = Math.min(114, Math.max(1, Number(params.surah) || 1))
  const initAyah = Number(search.get('a')) || 1
  const [surahId, setSurahId] = useState(initSurah)
  const [target, setTarget] = useState({ ayah: initAyah, nonce: 0 }) // куда прокрутить в режиме «Сура»
  const [page, setPage] = useState(Number(search.get('p')) || surahs[initSurah - 1].pages[0])
  const [overlay, setOverlay] = useState<Overlay>(search.get('memo') ? 'memo' : null) // ?memo=1 — сразу окно заучивания (кнопка на главной)
  const [enter, setEnter] = useState<'' | 'from-left' | 'from-right'>('') // анимация появления соседней суры
  // режим «чистого чтения»: панели спрятаны, пока не тапнешь по экрану
  const [bare, setBare] = useState(false)
  const gesture = useRef({ x: 0, y: 0, t: 0, lastTouch: 0 })
  const lastScroll = useRef(new WeakMap<Element, { top: number; left: number }>())
  const topAyah = useRef(initAyah)
  const appScrollUntil = useRef(0) // до этого момента прокрутку делает само приложение (подсветка аята), а не человек

  // аят, на котором остановились, и его страница: при смене страницы запоминаем его, а не первый аят страницы
  // (p = 0 — страница ещё не известна)
  const pinned = useRef<{ s: number; a: number; p: number } | null>(initAyah > 1 ? { s: initSurah, a: initAyah, p: Number(search.get('p')) || 0 } : null)

  // точная страница стартового аята
  useEffect(() => {
    if (search.get('p')) return
    loadSurah(initSurah).then((ayahs) => {
      const a = ayahs.find((x) => x.n === initAyah)
      if (a) { if (pinned.current) pinned.current.p = a.p; setPage(a.p) }
    })
  }, [])

  useEffect(() => { setBitrates(st.bitrates); setReciter(st.reciter) }, [st.reciter, st.bitrates])
  useEffect(() => { setSurahCounts(surahs) }, [surahs])
  useEffect(() => { setMediaTitle((k) => { const [s, a] = k.split(':'); return `${surahs[+s - 1].name}, аят ${a}` }) }, [surahs])

  const mode = st.mode
  const markPage = st.markPage
  usePageReadTimer(page, markPage)
  // на одной странице бывает несколько сур (напр. 604: 112–114) — если открытая сура есть на странице, показываем её
  const opened = surahs[surahId - 1]
  const pageSurah = opened.pages[0] <= page && page <= opened.pages[1] ? opened : surahByPage(surahs, page)
  const surah = mode === 'sura' ? surahs[surahId - 1] : pageSurah

  const { saveLast, fromLink } = useLastRead(search.get('from') === 'link')

  useEffect(() => {
    if (mode === 'sura') return
    const pin = pinned.current
    if (pin && pin.p === page) { topAyah.current = pin.a; saveLast(pin.s, pin.a, page); return }
    if (pin && !pin.p) return // страница нужного аята ещё открывается
    pinned.current = null
    loadMushafPage(page).then((mp) => {
      const first = Object.keys(mp.lines).map(Number).sort((a, b) => a - b)[0]
      const [s, a] = mp.lines[first][0][1].split(':').map(Number)
      topAyah.current = a
      saveLast(s, a, page)
    })
  }, [page, mode, saveLast])

  // открыли окно аята (перевод и тафсир) — запоминаем именно этот аят: «Продолжить чтение» откроет его
  const tafsirAt = overlay && typeof overlay === 'object' ? overlay.tafsir : null
  const tafsirKey = tafsirAt ? `${tafsirAt[0]}:${tafsirAt[1]}` : ''
  useEffect(() => {
    if (!tafsirKey) return
    const [s, a] = tafsirKey.split(':').map(Number)
    let alive = true
    loadSurah(s).then((ayahs) => { const x = ayahs.find((y) => y.n === a); if (alive && x) { pinned.current = { s, a, p: x.p }; saveLast(s, a, x.p) } })
    return () => { alive = false }
  }, [tafsirKey, saveLast])

  // «Продолжить чтение»: аят, на котором остановились, на пару секунд подсвечивается
  useFlashAyah(!!search.get('hl'), mode, initSurah, initAyah, appScrollUntil)

  const onTop = useCallback((ayah: number, p: number) => {
    topAyah.current = ayah
    setPage(p)
    saveLast(surahId, ayah, p)
  }, [surahId, saveLast])

  // ----- навигация -----
  const goPage = useCallback(async (p: number) => {
    setOverlay(null)
    fromLink.current = false
    if (mode !== 'sura') { setPage(p); return }
    const s = surahByPage(surahs, p)
    const ayahs = await loadSurah(s.id)
    const a = ayahs.find((x) => x.p >= p) ?? ayahs[0]
    setSurahId(s.id)
    setTarget((t) => ({ ayah: a.n, nonce: t.nonce + 1 }))
    setPage(p)
  }, [mode, surahs])

  const goSurah = useCallback((s: Surah, ayah = 1) => {
    setOverlay(null)
    fromLink.current = false
    if (mode === 'sura') { setSurahId(s.id); setTarget((t) => ({ ayah, nonce: t.nonce + 1 })); setPage(s.pages[0]) }
    else {
      setSurahId(s.id)
      if (ayah === 1) setPage(s.pages[0])
      else loadSurah(s.id).then((ayahs) => setPage(ayahs.find((x) => x.n === ayah)?.p ?? s.pages[0]))
    }
  }, [mode])

  function switchMode(m: ReadMode) {
    setOverlay(null)
    haptic.tap()
    if (m === 'sura' && mode !== 'sura') {
      // в «Суру» — открываем суру текущей страницы на первом аяте этой страницы
      // сура из заголовка (та, что начинается на этой странице или раньше) и её первый аят на странице
      const sid = pageSurah.id
      loadMushafPage(page).then((mp) => {
        const keys = Object.keys(mp.lines).map(Number).sort((a, b) => a - b).flatMap((n) => mp.lines[n].map((w) => w[1]))
        const key = keys.find((k) => k.startsWith(sid + ':'))
        setSurahId(sid)
        setTarget((t) => ({ ayah: key ? Number(key.split(':')[1]) : 1, nonce: t.nonce + 1 }))
      })
    }
    st.set({ mode: m })
  }

  // ----- аудио -----
  const keysOf = (s: Surah, from: number, to = s.ayahs) => Array.from({ length: to - from + 1 }, (_, i) => `${s.id}:${from + i}`)
  const playFrom = useCallback((sid: number, ayah: number) => {
    haptic.tap()
    usePlayer.getState().play(keysOf(surahs[sid - 1], ayah), 0)
  }, [surahs])

  function onFab() {
    if (player.status !== 'idle') return player.toggle()
    if (mode === 'sura') return playFrom(surahId, topAyah.current)
    loadMushafPage(page).then((mp) => {
      const first = Object.keys(mp.lines).map(Number).sort((a, b) => a - b)[0]
      const [s, a] = mp.lines[first][0][1].split(':').map(Number)
      playFrom(s, a)
    })
  }

  // в постраничных режимах — перелистывать вслед за чтецом
  useEffect(() => {
    if (!player.current || mode === 'sura' || !st.plFollow) return
    const [s, a] = player.current.split(':').map(Number)
    loadSurah(s).then((ayahs) => { const p = ayahs.find((x) => x.n === a)?.p; if (p && p !== page) setPage(p) })
  }, [player.current, mode])

  function startMemo(from: number, to: number, opts: MemoOptions) {
    setOverlay(null)
    haptic.success()
    st.markTask('memo', true)
    usePlayer.getState().play(keysOf(surah, from, to), 0, opts)
  }

  const act: AyahActions = useMemo(() => ({
    playing: player.current,
    sounding: player.status === 'playing' || player.status === 'loading',
    onToggle: () => { haptic.tap(); usePlayer.getState().toggle() },
    hidden: (k) => !!player.memo?.hideText && player.queue.includes(k),
    bookmarked: (k) => st.bookmarks.includes(k),
    onPlay: playFrom,
    onInfo: (s, a) => setOverlay({ tafsir: [s, a] }),
    onBookmark: (k) => { haptic.tap(); st.toggleBookmark(k) },
  }), [player.current, player.status, player.memo, player.queue, st, playFrom])

  const opts = useMemo(() => ({ tajweed: st.tajweed, translation: st.translation, wbw: st.wbw }), [st.tajweed, st.translation, st.wbw])
  const renderPage = useCallback((p: number) => <PageAyahs page={p} surahs={surahs} opts={opts} act={act} />, [surahs, opts, act])
  const onAyahHold = useCallback((key: string) => { const [s, a] = key.split(':').map(Number); setOverlay({ tafsir: [s, a] }) }, [])
  const renderMushaf = useCallback((p: number) => <MushafView page={p} tajweed={st.tajweed} playing={player.current} onAyahHold={onAyahHold} />, [st.tajweed, player.current, onAyahHold])

  // тап по тексту — показать/спрятать панели; прокрутка пальцем — спрятать
  const onViewDown = (e: RPE) => {
    gesture.current = { ...gesture.current, x: e.clientX, y: e.clientY, t: e.timeStamp, lastTouch: Date.now() }
  }
  const onViewUp = (e: RPE) => {
    const g = gesture.current
    const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y)
    if (moved > 8 || e.timeStamp - g.t > 350) return
    if ((e.target as HTMLElement).closest('button, a, input, .a-act')) return
    // мусхаф: на слове панели переключаются с небольшой задержкой — двойное нажатие (перевод слова) их не дёргает
    if (mode === 'mushaf' && (e.target as HTMLElement).closest('.mushaf .ln.w span[data-k]:not([data-e])')) {
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = undefined; return }
      tapTimer.current = setTimeout(() => { tapTimer.current = undefined; setBare((b) => !b) }, 320)
      return
    }
    setBare((b) => !b)
  }
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pageTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onViewScroll = (e: RUE) => {
    const el = e.target as Element
    // окна поверх читалки (например, «История суры») — не её прокрутка
    if (!e.currentTarget.contains(el)) return
    // «Страница»: запоминаем не первый аят страницы, а тот, что сейчас вверху экрана
    // (только когда прокручивает сам человек, а не само приложение при подсветке аята)
    // (на телефоне инерция длится дольше касания, поэтому судим не по касанию, а по тому, что прокрутку начало не приложение;
    // запоминаем, когда прокрутка закончилась)
    if (mode === 'page' && el.classList.contains('pscroll') && Date.now() > appScrollUntil.current) {
      pinned.current = null
      clearTimeout(pageTimer.current)
      pageTimer.current = setTimeout(() => {
        const top = el.getBoundingClientRect().top + 90
        for (const b of el.querySelectorAll<HTMLElement>('[data-key]')) {
          if (b.getBoundingClientRect().bottom > top) {
            const [bs, ba] = b.dataset.key!.split(':').map(Number)
            topAyah.current = ba
            saveLast(bs, ba, Number(b.dataset.page) || page)
            break
          }
        }
      }, 350)
    }
    const prev = lastScroll.current.get(el)
    const cur = { top: el.scrollTop, left: el.scrollLeft }
    lastScroll.current.set(el, cur)
    // только если прокручивает сам человек (касание/колесо за последние 1,5 с), а не чтец
    if (!prev || Date.now() - gesture.current.lastTouch > 1500) return
    if (Math.abs(cur.top - prev.top) > 6 || Math.abs(cur.left - prev.left) > 20) setBare(true)
  }
  useEffect(() => { if (overlay) setBare(false) }, [overlay])

  // окно выбора режима закрывается, как только касаемся чего-то другого (листаем страницу, колесо и т.п.)
  useEffect(() => {
    if (overlay !== 'pop') return
    const close = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!t.closest('.pop, .modebtn')) setOverlay(null) }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [overlay])
  const juz = (p: number) => juzByPage(juzPages, p)
  // листают тафсир по аятам — текст под окном идёт следом: страница мусхафа/«Страницы» или прокрутка суры
  const followAyah = useCallback((s: number, a: number, p: number) => {
    if (mode === 'sura') { if (s === surahId) setTarget((t) => ({ ayah: a, nonce: t.nonce + 1 })) }
    else setPage(p)
  }, [mode, surahId])
  const memo = player.memo

  return (
    <div className={'reader' + (bare ? ' bare' : '') + (mode === 'mushaf' ? ' m-mushaf' : '')} style={{ ['--ar-size' as string]: st.arSize + 'px', ['--tr-size' as string]: st.trSize + 'px' }}>
      <div className="view" onPointerDown={onViewDown} onPointerUp={onViewUp} onScrollCapture={onViewScroll}
        onWheel={() => { gesture.current.lastTouch = Date.now() }}>
        {mode === 'sura' && (
          <SuraView key={`${surahId}-${target.nonce}`} surah={surahs[surahId - 1]} scrollTo={target.ayah} opts={opts} act={act} onTop={onTop}
            prevName={surahId > 1 ? surahs[surahId - 2].name : null} nextName={surahId < 114 ? surahs[surahId].name : null}
            enter={enter} onSwipe={(dir) => { setEnter(dir === 1 ? 'from-left' : 'from-right'); goSurah(surahs[surahId - 1 + dir]) }} />
        )}
        {mode === 'page' && <Pager page={page} onChange={setPage} render={renderPage} />}
        {mode === 'mushaf' && <Pager page={page} onChange={setPage} render={renderMushaf} />}
      </div>

      <div className="rtop">
        <button className="sq glass" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="rtitle glass">
          <div className="t"><b>{surah.name}</b><span>Сура {surah.id} · {surah.mk ? 'Мекканская' : 'Мединская'} · {surah.ayahs} аятов</span></div>
          <span className="sname">{surahGlyph(surah.id)}</span>
        </div>
      </div>

      {memo ? <MemoBar onOpen={() => setOverlay('memo')} /> : (
        player.status === 'idle' ? <button className="fab" onClick={onFab} aria-label="Слушать"><Icon id="play" /></button> : null
      )}
      {player.error && <div className="memobar glass" style={{ bottom: 'calc(var(--safe-bottom) + 170px)' }}><div className="t"><span>{player.error}</span></div></div>}

      <div className="rbar">
        <button className={'rcircle glass modebtn' + (overlay === 'pop' ? ' open' : '')} onClick={() => setOverlay(overlay === 'pop' ? null : 'pop')} aria-label={'Режим: ' + MODES[mode].label}>
          <Icon id={MODES[mode].icon} />
        </button>
        <Dial page={page} juz={juz} onChange={goPage} onOpenPicker={() => setOverlay('picker')} />
        <button className="rcircle glass" onClick={() => setOverlay('menu')} aria-label="Меню"><Icon id="grid" /></button>
      </div>

      {overlay === 'pop' && <ModePop mode={mode} onPick={switchMode} />}
      {overlay === 'menu' && (
        <MenuPanel
          sub={`${surah.name} · стр. ${page}`} tajweed={st.tajweed} mode={mode}
          onClose={() => setOverlay(null)}
          onPlay={() => { setOverlay(null); onFab() }}
          onBookmarks={() => setOverlay('bookmarks')}
          onSearch={() => setOverlay('search')}
          onMemo={() => setOverlay('memo')}
          onTajweed={() => { haptic.tap(); st.set({ tajweed: !st.tajweed }) }}
          wbw={st.wbw} onWbw={() => { haptic.tap(); st.set({ wbw: !st.wbw }) }}
          onSettings={() => setOverlay('settings')}
          onGlossary={kulievIx ? () => nav('/glossary', { state: { from: { id: surah.id, name: surah.name, sub: `стр. ${page}` } } }) : undefined}
          onSajda={kulievIx ? () => nav('/sajda', { state: { from: { id: surah.id, name: surah.name, sub: `стр. ${page}` } } }) : undefined}
        />
      )}
      {(overlay === 'picker' || overlay === 'search') && (
        <PickerSheet surahs={surahs} juzPages={juzPages} currentSurah={surah.id} focusSearch={overlay === 'search'}
          onClose={() => setOverlay(null)} onSurah={(s) => goSurah(s)} onPage={goPage} />
      )}
      {overlay === 'memo' && (
        <MemoSheet surah={memo && player.queue[0] ? surahs[+player.queue[0].split(':')[0] - 1] : surah} startAyah={surah.id === surahId || mode !== 'sura' ? Math.min(topAyah.current, surah.ayahs) : 1}
          initial={memo && player.queue[0] ? { from: +player.queue[0].split(':')[1], to: +player.queue[player.queue.length - 1].split(':')[1], opts: { repeatEach: memo.repeatEach, repeatRange: memo.repeatRange, pause: memo.pause, hideText: memo.hideText } } : undefined}
          reciterName={(RECITERS[st.reciter] ?? RECITERS.alafasy).name} onClose={() => setOverlay(null)} onStart={startMemo} />
      )}
      {overlay === 'bookmarks' && (
        <BookmarksSheet bookmarks={st.bookmarks} surahs={surahs} onClose={() => setOverlay(null)}
          onOpen={(s, a) => goSurah(surahs[s - 1], a)} onRemove={st.toggleBookmark} />
      )}
      {overlay === 'settings' && <ReaderSettingsSheet onClose={() => setOverlay(null)} />}
      {overlay && typeof overlay === 'object' && (
        <AyahSheet surah={surahs[overlay.tafsir[0] - 1]} ayah={overlay.tafsir[1]} onAyah={followAyah} onClose={() => setOverlay(null)} onPlay={(s, a) => { setOverlay(null); playFrom(s, a) }} />
      )}
      {!overlay && <Tour id="reader" scroll={false} steps={readerTour(mode)} />}
    </div>
  )
}
