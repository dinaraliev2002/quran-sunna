import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { useQuranMeta } from '../../components/ui'
import { juzByPage, loadMushafPage, loadSurah, surahByPage, type Surah } from '../../lib/data'
import { haptic } from '../../lib/telegram'
import { RECITERS, setMediaTitle, setReciter, usePlayer, type MemoOptions } from '../../store/player'
import { useStore, type ReadMode } from '../../store/settings'
import { Dial } from './Dial'
import { Pager } from './Pager'
import { BookmarksSheet, MemoSheet, MenuPanel, MODES, ModePop, PickerSheet, ReaderSettingsSheet, TafsirSheet } from './sheets'
import { MushafView, PageAyahs, SuraView, type AyahActions } from './views'

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
  const params = useParams()
  const [search] = useSearchParams()
  const st = useStore()
  const player = usePlayer()

  const initSurah = Math.min(114, Math.max(1, Number(params.surah) || 1))
  const initAyah = Number(search.get('a')) || 1
  const [surahId, setSurahId] = useState(initSurah)
  const [target, setTarget] = useState({ ayah: initAyah, nonce: 0 }) // куда прокрутить в режиме «Сура»
  const [page, setPage] = useState(Number(search.get('p')) || surahs[initSurah - 1].pages[0])
  const [overlay, setOverlay] = useState<Overlay>(null)
  const topAyah = useRef(initAyah)

  // точная страница стартового аята
  useEffect(() => {
    if (search.get('p')) return
    loadSurah(initSurah).then((ayahs) => { const a = ayahs.find((x) => x.n === initAyah); if (a) setPage(a.p) })
  }, [])

  useEffect(() => { setReciter(st.reciter) }, [st.reciter])
  useEffect(() => { setMediaTitle((k) => { const [s, a] = k.split(':'); return `${surahs[+s - 1].name}, аят ${a}` }) }, [surahs])

  const mode = st.mode
  const markPage = st.markPage
  // каждая открытая страница засчитывается в «Сегодня» на главной и в серию дней
  useEffect(() => { const t = setTimeout(() => markPage(page), 1500); return () => clearTimeout(t) }, [page, markPage])
  const pageSurah = surahByPage(surahs, page)
  const surah = mode === 'sura' ? surahs[surahId - 1] : pageSurah

  // ----- последнее место чтения -----
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saveLast = useCallback((s: number, a: number, p: number) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => st.setLastRead({ s, a, p }), 800)
  }, [st])

  useEffect(() => {
    if (mode === 'sura') return
    loadMushafPage(page).then((mp) => {
      const first = Object.keys(mp.lines).map(Number).sort((a, b) => a - b)[0]
      const [s, a] = mp.lines[first][0][1].split(':').map(Number)
      topAyah.current = a
      saveLast(s, a, page)
    })
  }, [page, mode, saveLast])

  const onTop = useCallback((ayah: number, p: number) => {
    topAyah.current = ayah
    setPage(p)
    saveLast(surahId, ayah, p)
  }, [surahId, saveLast])

  // ----- навигация -----
  const goPage = useCallback(async (p: number) => {
    setOverlay(null)
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
    if (mode === 'sura') { setSurahId(s.id); setTarget((t) => ({ ayah, nonce: t.nonce + 1 })); setPage(s.pages[0]) }
    else if (ayah === 1) setPage(s.pages[0])
    else loadSurah(s.id).then((ayahs) => setPage(ayahs.find((x) => x.n === ayah)?.p ?? s.pages[0]))
  }, [mode])

  function switchMode(m: ReadMode) {
    setOverlay(null)
    haptic.tap()
    if (m === 'sura' && mode !== 'sura') {
      // в «Суру» — открываем суру текущей страницы на первом аяте этой страницы
      loadMushafPage(page).then((mp) => {
        const first = Object.keys(mp.lines).map(Number).sort((a, b) => a - b)[0]
        const [s, a] = mp.lines[first][0][1].split(':').map(Number)
        setSurahId(s)
        setTarget((t) => ({ ayah: a, nonce: t.nonce + 1 }))
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
    if (!player.current || mode === 'sura') return
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
    hidden: (k) => !!player.memo?.hideText && player.queue.includes(k),
    bookmarked: (k) => st.bookmarks.includes(k),
    onPlay: playFrom,
    onTafsir: (s, a) => setOverlay({ tafsir: [s, a] }),
    onBookmark: (k) => { haptic.tap(); st.toggleBookmark(k) },
  }), [player.current, player.memo, player.queue, st, playFrom])

  const opts = useMemo(() => ({ tajweed: st.tajweed, translation: st.translation }), [st.tajweed, st.translation])
  const renderPage = useCallback((p: number) => <PageAyahs page={p} surahs={surahs} opts={opts} act={act} />, [surahs, opts, act])
  const renderMushaf = useCallback((p: number) => <MushafView page={p} tajweed={st.tajweed} playing={player.current} />, [st.tajweed, player.current])

  // окно выбора режима закрывается, как только касаемся чего-то другого (листаем страницу, колесо и т.п.)
  useEffect(() => {
    if (overlay !== 'pop') return
    const close = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!t.closest('.pop, .modebtn')) setOverlay(null) }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [overlay])
  const juz = (p: number) => juzByPage(juzPages, p)
  const memo = player.memo
  const playing = player.status === 'playing' || player.status === 'loading'

  return (
    <div className="reader" style={{ ['--ar-size' as string]: st.arSize + 'px', ['--tr-size' as string]: st.trSize + 'px' }}>
      <div className="view">
        {mode === 'sura' && <SuraView key={`${surahId}-${target.nonce}`} surah={surahs[surahId - 1]} scrollTo={target.ayah} opts={opts} act={act} onTop={onTop} />}
        {mode === 'page' && <Pager page={page} onChange={setPage} render={renderPage} />}
        {mode === 'mushaf' && <Pager page={page} onChange={setPage} render={renderMushaf} />}
      </div>

      <div className="rtop">
        <button className="sq glass" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="rtitle glass">
          <div className="t"><b>{surah.name}</b><span>Сура {surah.id} · {surah.mk ? 'Мекканская' : 'Мединская'} · {surah.ayahs} аятов</span></div>
          <span className="ar">{surah.ar}</span>
        </div>
      </div>

      {memo ? (
        <div className="memobar glass">
          <div className="ic"><Icon id="repeat" /></div>
          <div className="t">
            <b>Заучивание · {player.queue[0]}–{player.queue[player.queue.length - 1]?.split(':')[1]}</b>
            <span>Аят {player.current?.split(':')[1]} · повтор {memo.each} из {memo.repeatEach} · круг {memo.round}{memo.repeatRange ? ` из ${memo.repeatRange}` : ''}</span>
            <div className="bar"><i style={{ width: `${((player.index + 1) / player.queue.length) * 100}%` }} /></div>
          </div>
          <button onClick={player.toggle} aria-label="Пауза"><Icon id={playing ? 'pause' : 'play'} /></button>
          <button onClick={player.stop} aria-label="Стоп"><Icon id="close" /></button>
        </div>
      ) : (
        mode !== 'mushaf' || player.status !== 'idle' ? (
          <button className="fab" onClick={onFab} aria-label="Слушать"><Icon id={playing ? 'pause' : 'play'} /></button>
        ) : null
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
          onSettings={() => setOverlay('settings')}
        />
      )}
      {(overlay === 'picker' || overlay === 'search') && (
        <PickerSheet surahs={surahs} juzPages={juzPages} currentSurah={surah.id} focusSearch={overlay === 'search'}
          onClose={() => setOverlay(null)} onSurah={(s) => goSurah(s)} onPage={goPage} />
      )}
      {overlay === 'memo' && (
        <MemoSheet surah={surah} startAyah={surah.id === surahId || mode !== 'sura' ? Math.min(topAyah.current, surah.ayahs) : 1}
          reciterName={(RECITERS[st.reciter] ?? RECITERS.alafasy).name} onClose={() => setOverlay(null)} onStart={startMemo} />
      )}
      {overlay === 'bookmarks' && (
        <BookmarksSheet bookmarks={st.bookmarks} surahs={surahs} onClose={() => setOverlay(null)}
          onOpen={(s, a) => goSurah(surahs[s - 1], a)} onRemove={st.toggleBookmark} />
      )}
      {overlay === 'settings' && <ReaderSettingsSheet onClose={() => setOverlay(null)} />}
      {overlay && typeof overlay === 'object' && (
        <TafsirSheet surah={surahs[overlay.tafsir[0] - 1]} ayah={overlay.tafsir[1]} onClose={() => setOverlay(null)} />
      )}
    </div>
  )
}
