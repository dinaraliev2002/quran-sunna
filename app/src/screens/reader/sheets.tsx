import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead, SurahRow } from '../../components/ui'
import { loadSurah, loadTafsir, tafsirFor, TOTAL_PAGES, type Ayah, type Surah } from '../../lib/data'
import { haptic } from '../../lib/telegram'
import { QpcText } from './views'
import { TafsirText } from './TafsirText'
import { RECITERS, type MemoOptions, type PauseMode } from '../../store/player'
import { useStore, type ReadMode, type Translation } from '../../store/settings'

const TRANSLATIONS: Record<Translation, string> = { ku: 'Эльмир Кулиев', aa: 'Абу Адель' }

export const MODES: Record<ReadMode, { label: string; icon: string; desc: string }> = {
  mushaf: { label: 'Мусхаф', icon: 'open', desc: 'Печатные страницы' },
  page: { label: 'Страница', icon: 'page', desc: 'Аяты страницы, свайп вбок' },
  sura: { label: 'Сура', icon: 'rows', desc: 'Вся сура, вниз' },
}

export function ModePop({ mode, onPick }: { mode: ReadMode; onPick: (m: ReadMode) => void }) {
  return (
    <div className="pop glass">
      <h4>Режим чтения</h4>
      <div className="opts">
        {(Object.keys(MODES) as ReadMode[]).map((m) => (
          <button key={m} className={m === mode ? 'on' : ''} onClick={() => onPick(m)}>
            <span className="ic"><Icon id={MODES[m].icon} /></span>
            <b>{MODES[m].label}</b>
            <span>{MODES[m].desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function MenuPanel({ sub, tajweed, onClose, onPlay, onBookmarks, onSearch, onMemo, onTajweed, onSettings }: {
  sub: string; tajweed: boolean; mode: ReadMode
  onClose: () => void; onPlay: () => void; onBookmarks: () => void; onSearch: () => void; onMemo: () => void; onTajweed: () => void; onSettings: () => void
}) {
  // окно снизу — закрывается свайпом вниз, как и остальные
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Меню" sub={sub} onClose={onClose} />
      <div className="menu-body">
        <div className="quick">
          <button onClick={onPlay}><Icon id="play" />Слушать</button>
          <button onClick={onBookmarks}><Icon id="bookmark" />Закладки</button>
          <button onClick={onSearch}><Icon id="search" />Поиск</button>
        </div>
        <button className="mrow" onClick={onMemo}>
          <span className="mi"><Icon id="repeat" /></span>
          <div className="t"><b>Заучивание</b><span>Отрывок, повторы, скрытие текста</span></div>
          <Icon id="right" className="icon chev" />
        </button>
        <button className="mrow" disabled style={{ opacity: .55 }}>
          <span className="mi"><Icon id="words" /></span>
          <div className="t"><b>Пословный перевод</b><span>Скоро: готовим русский перевод слов</span></div>
          <span className="switch" />
        </button>
        <button className="mrow" onClick={onTajweed}>
          <span className="mi"><Icon id="eye" /></span>
          <div className="t"><b>Таджвид</b><span>Цветная подсветка правил чтения</span></div>
          <span className={'switch' + (tajweed ? ' on' : '')} />
        </button>
        <button className="mrow" onClick={onSettings}>
          <span className="mi">Aa</span>
          <div className="t"><b>Настройки</b><span>Перевод · чтец · шрифт</span></div>
          <Icon id="right" className="icon chev" />
        </button>
      </div>
    </Sheet>
  )
}

export function PickerSheet({ surahs, juzPages, currentSurah, focusSearch, onClose, onSurah, onPage }: {
  surahs: Surah[]; juzPages: number[]; currentSurah: number; focusSearch?: boolean
  onClose: () => void; onSurah: (s: Surah) => void; onPage: (p: number) => void
}) {
  const [tab, setTab] = useState<'s' | 'j' | 'p'>('s')
  const [q, setQ] = useState('')
  const [pageInput, setPageInput] = useState('')
  const list = useMemo(() => {
    const n = q.trim().toLowerCase().replace(/[-\s]/g, '')
    if (!n) return surahs
    return surahs.filter((s) => String(s.id) === n || s.name.toLowerCase().replace(/[-\s]/g, '').includes(n) || s.meaning.toLowerCase().includes(n))
  }, [q, surahs])

  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Перейти" onClose={onClose} />
      <div className="sortseg">
        <button className={tab === 's' ? 'on' : ''} onClick={() => setTab('s')}>Суры</button>
        <button className={tab === 'j' ? 'on' : ''} onClick={() => setTab('j')}>Джузы</button>
        <button className={tab === 'p' ? 'on' : ''} onClick={() => setTab('p')}>Страница</button>
      </div>
      {tab === 's' && (
        <>
          <div className="search"><Icon id="search" /><input autoFocus={focusSearch} placeholder="Название или номер суры" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="body">
            {list.map((s) => <SurahRow key={s.id} s={s} current={s.id === currentSurah} onClick={() => onSurah(s)} />)}
            {list.length === 0 && <div className="empty">Ничего не найдено</div>}
          </div>
        </>
      )}
      {tab === 'j' && (
        <div className="body">
          {juzPages.map((p, i) => {
            const s = [...surahs].reverse().find((x) => x.pages[0] <= p)!
            return (
              <button key={i} className="jrow" onClick={() => onPage(p)}>
                <div className="num-badge"><span>{i + 1}</span></div>
                <b>Джуз {i + 1}</b><span>{s.name} · стр. {p}</span>
              </button>
            )
          })}
        </div>
      )}
      {tab === 'p' && (
        <div className="body">
          <div className="gopage">
            <input inputMode="numeric" placeholder={`1–${TOTAL_PAGES}`} value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            <button className="bigbtn" onClick={() => { const p = Number(pageInput); if (p >= 1 && p <= TOTAL_PAGES) onPage(p) }}>Открыть</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

export function MemoSheet({ surah, startAyah, reciterName, onClose, onStart }: {
  surah: Surah; startAyah: number; reciterName: string; onClose: () => void
  onStart: (from: number, to: number, opts: MemoOptions) => void
}) {
  const [from, setFrom] = useState(startAyah)
  const [to, setTo] = useState(Math.min(surah.ayahs, startAyah + 4))
  const [each, setEach] = useState(3)
  const [range, setRange] = useState(2)
  const [pause, setPause] = useState<PauseMode>(0)
  const [hide, setHide] = useState(false)
  const clamp = (v: number) => Math.max(1, Math.min(surah.ayahs, v))

  const Pills = <T,>({ items, value, set }: { items: [T, string][]; value: T; set: (v: T) => void }) => (
    <div className="pills">{items.map(([v, l]) => <button key={l} className={v === value ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>
  )

  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Заучивание" sub={`${surah.name} · ${reciterName}`} onClose={onClose} />
      <div className="body">
        <div className="fld"><label>Отрывок</label>
          <div className="range">
            <div className="stepper"><small>с аята</small><button onClick={() => { const v = clamp(from - 1); setFrom(v) }}>−</button><b>{from}</b><button onClick={() => { const v = clamp(from + 1); setFrom(v); if (v > to) setTo(v) }}>+</button></div>
            <div className="stepper"><small>по аят</small><button onClick={() => { const v = clamp(to - 1); setTo(v); if (v < from) setFrom(v) }}>−</button><b>{to}</b><button onClick={() => setTo(clamp(to + 1))}>+</button></div>
          </div>
        </div>
        <div className="fld"><label>Повтор каждого аята</label><Pills items={[[1, '1×'], [3, '3×'], [5, '5×'], [7, '7×'], [10, '10×']]} value={each} set={setEach} /></div>
        <div className="fld"><label>Повтор всего отрывка</label><Pills items={[[1, '1×'], [2, '2×'], [3, '3×'], [0, '∞']]} value={range} set={setRange} /></div>
        <div className="fld"><label>Пауза между повторами</label><Pills<PauseMode> items={[[0, 'нет'], [2000, '2 с'], [5000, '5 с'], ['len', '= длине аята']]} value={pause} set={setPause} /></div>
        <button className="srow2" onClick={() => setHide(!hide)}><div>Скрывать текст аята<span>Проверить себя по памяти</span></div><span className={'switch' + (hide ? ' on' : '')} /></button>
        <button className="bigbtn" onClick={() => onStart(from, to, { repeatEach: each, repeatRange: range, pause, hideText: hide })}><Icon id="play" />Начать заучивание</button>
      </div>
    </Sheet>
  )
}

/** Окно аята: арабский текст, перевод, тафсир ас-Саади. Листается свайпом влево/вправо по аятам. */
export function AyahSheet({ surah, ayah, onClose, onPlay, onAyah }: {
  surah: Surah; ayah: number; onClose: () => void; onPlay: (s: number, a: number) => void
  /** аят сменился (листают тафсир) — чтобы страница под окном перелистнулась следом */
  onAyah?: (s: number, a: number, page: number) => void
}) {
  const st = useStore()
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null)
  const [tf, setTf] = useState<Record<string, string> | null | undefined>(undefined)
  const [cur, setCur] = useState(ayah)
  const [slide, setSlide] = useState<'' | 'l' | 'r'>('')
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    loadSurah(surah.id).then(setAyahs)
    loadTafsir(surah.id).then(setTf).catch(() => setTf(null))
  }, [surah])

  const a = ayahs?.[cur - 1]
  const t = tf ? tafsirFor(tf, cur, surah.ayahs) : null
  // перешли на другую страницу мусхафа — заметная вибрация и перелистывание страницы под окном
  const lastPage = useRef<number | null>(null)
  useEffect(() => {
    if (!a) return
    const first = lastPage.current === null
    if (!first && lastPage.current !== a.p) haptic.page()
    lastPage.current = a.p
    if (!first) onAyah?.(surah.id, cur, a.p) // при открытии окна текст под ним не двигаем
  }, [a])
  const key = `${surah.id}:${cur}`
  const marked = st.bookmarks.includes(key)
  const go = (n: number, dir: 'l' | 'r') => {
    if (n < 1 || n > surah.ayahs) return
    haptic.tick()
    setSlide(dir); setCur(n)
    bodyRef.current?.scrollTo({ top: 0 })
    setTimeout(() => setSlide(''), 250)
  }
  const goRef = useRef({ next: () => {}, prev: () => {} })
  goRef.current = { next: () => go(cur + 1, 'l'), prev: () => go(cur - 1, 'r') }

  // свайп влево — следующий аят, вправо — предыдущий
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    let x = 0, y = 0
    const s = (e: TouchEvent) => { x = e.touches[0].clientX; y = e.touches[0].clientY }
    const end = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - x, dy = e.changedTouches[0].clientY - y
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? goRef.current.next() : goRef.current.prev())
    }
    el.addEventListener('touchstart', s, { passive: true })
    el.addEventListener('touchend', end)
    return () => { el.removeEventListener('touchstart', s); el.removeEventListener('touchend', end) }
  }, [])

  const range = t ? (t.from === t.to ? `аят ${t.from}` : `аяты ${t.from}–${t.to}`) : ''
  return (
    <Sheet onClose={onClose} tall>
      <div className="sh">
        <div><h3>{surah.name}, аят {cur}</h3><span>{surah.meaning} · {cur} из {surah.ayahs}{a ? ` · стр. ${a.p}` : ''}</span></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="xbtn" disabled={cur <= 1} style={{ opacity: cur > 1 ? 1 : .35 }} onClick={() => go(cur - 1, 'r')} aria-label="Предыдущий аят"><Icon id="back" /></button>
          <button className="xbtn" disabled={cur >= surah.ayahs} style={{ opacity: cur < surah.ayahs ? 1 : .35 }} onClick={() => go(cur + 1, 'l')} aria-label="Следующий аят"><Icon id="right" /></button>
          <button className="xbtn" onClick={onClose} aria-label="Закрыть"><Icon id="close" /></button>
        </div>
      </div>
      <div className="body" ref={bodyRef}>
        {!a && <div className="loading">Загрузка…</div>}
        {a && (
          <div key={cur} className={'ayah-sheet' + (slide ? ' slide-' + slide : '')}>
            <QpcText page={a.p} glyphs={a.g} tajweed={st.tajweed} className="as-ar" />
            <div className="as-actions">
              <button onClick={() => onPlay(surah.id, cur)}><Icon id="play" />Слушать</button>
              <button className={marked ? 'on' : ''} onClick={() => { haptic.tap(); st.toggleBookmark(key) }}><Icon id="bookmark" />{marked ? 'В закладках' : 'В закладки'}</button>
            </div>
            <div className="as-label">Перевод · {TRANSLATIONS[st.translation]}</div>
            <div className="as-tr">{st.translation === 'aa' ? a.aa : a.ku}</div>
            <div className="as-label">Тафсир ас-Саади{range ? ` · ${range}` : ''}</div>
            {tf === undefined && <div className="loading" style={{ height: 80 }}>Загрузка…</div>}
            {tf !== undefined && !t && <div className="empty">Для этого аята тафсир не найден</div>}
            {t && <TafsirText text={t.text} />}
            <div className="tafsir-hint">Свайп влево — следующий аят, вправо — предыдущий</div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

export function BookmarksSheet({ bookmarks, surahs, onClose, onOpen, onRemove }: {
  bookmarks: string[]; surahs: Surah[]; onClose: () => void; onOpen: (s: number, a: number) => void; onRemove: (k: string) => void
}) {
  const [texts, setTexts] = useState<Record<string, string>>({})
  useEffect(() => {
    const sids = [...new Set(bookmarks.map((k) => Number(k.split(':')[0])))]
    Promise.all(sids.map((s) => loadSurah(s).then((a) => [s, a] as const))).then((all) => {
      const t: Record<string, string> = {}
      for (const [s, ayahs] of all) for (const a of ayahs) if (bookmarks.includes(`${s}:${a.n}`)) t[`${s}:${a.n}`] = a.ku
      setTexts(t)
    })
  }, [bookmarks])
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Закладки" sub={bookmarks.length ? `${bookmarks.length}` : undefined} onClose={onClose} />
      <div className="body">
        {bookmarks.length === 0 && <div className="empty">Пока пусто. Нажмите 🔖 у аята, чтобы добавить.</div>}
        {bookmarks.map((k) => {
          const [s, a] = k.split(':').map(Number)
          return (
            <div key={k} className="opt-row">
              <Icon id="bookmark" />
              <span onClick={() => onOpen(s, a)} style={{ cursor: 'pointer' }}>
                {surahs[s - 1].name}, аят {a}
                <small>{(texts[k] ?? '').slice(0, 90)}{(texts[k]?.length ?? 0) > 90 ? '…' : ''}</small>
              </span>
              <button className="xbtn" onClick={() => onRemove(k)} aria-label="Удалить"><Icon id="close" /></button>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}


/** Настройки чтения — окном поверх текста, без перехода на другой экран */
export function ReaderSettingsSheet({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const [open, setOpen] = useState<null | 'tr' | 'rec'>(null)
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={open === 'tr' ? 'Перевод смыслов' : open === 'rec' ? 'Чтец' : 'Настройки чтения'} onClose={open ? () => setOpen(null) : onClose} />
      <div className="body">
        {open === 'tr' && (Object.keys(TRANSLATIONS) as Translation[]).map((k) => (
          <button key={k} className="opt-row" onClick={() => { st.set({ translation: k }); setOpen(null) }}>
            <span>{TRANSLATIONS[k]}</span>{st.translation === k && <Icon id="check" />}
          </button>
        ))}
        {open === 'rec' && Object.entries(RECITERS).map(([k, r]) => (
          <button key={k} className="opt-row" onClick={() => { st.set({ reciter: k }); setOpen(null) }}>
            <span>{r.name}</span>{st.reciter === k && <Icon id="check" />}
          </button>
        ))}
        {!open && (
          <>
            <button className="srow2" onClick={() => setOpen('tr')}><div>Перевод<span>{TRANSLATIONS[st.translation]}</span></div><Icon id="right" className="icon" /></button>
            <button className="srow2" onClick={() => setOpen('rec')}><div>Чтец<span>{(RECITERS[st.reciter] ?? RECITERS.alafasy).name}</span></div><Icon id="right" className="icon" /></button>
            <button className="srow2" onClick={() => st.set({ tajweed: !st.tajweed })}><div>Цветной таджвид<span>Как в печатном мусхафе с таджвидом</span></div><span className={'switch' + (st.tajweed ? ' on' : '')} /></button>
            {/* в «Мусхафе» размер текста подстраивается под страницу сам — эти настройки там ни на что не влияют */}
            {st.mode !== 'mushaf' && <>
            <div className="fld" style={{ marginTop: 6 }}><label>Размер арабского текста</label>
              <div className="stepper"><small>{st.arSize}</small><button onClick={() => st.set({ arSize: Math.max(20, st.arSize - 2) })}>−</button><button onClick={() => st.set({ arSize: Math.min(44, st.arSize + 2) })}>+</button></div>
            </div>
            <div className="fld"><label>Размер перевода</label>
              <div className="stepper"><small>{st.trSize}</small><button onClick={() => st.set({ trSize: Math.max(12, st.trSize - 1) })}>−</button><button onClick={() => st.set({ trSize: Math.min(24, st.trSize + 1) })}>+</button></div>
            </div>
            </>}
          </>
        )}
      </div>
    </Sheet>
  )
}
