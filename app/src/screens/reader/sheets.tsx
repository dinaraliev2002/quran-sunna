import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead, SurahRow } from '../../components/ui'
import { loadSurah, loadTafsir, tafsirFor, TOTAL_PAGES, type Surah } from '../../lib/data'
import { RECITERS, type MemoOptions, type PauseMode } from '../../store/player'
import { useStore, type ReadMode, type Translation } from '../../store/settings'

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
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="panel">
        <div className="ph"><div><h3>Меню</h3><span>{sub}</span></div><button className="xbtn" onClick={onClose}><Icon id="close" /></button></div>
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
    </>
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

export function TafsirSheet({ surah, ayah, onClose }: { surah: Surah; ayah: number; onClose: () => void }) {
  const [t, setT] = useState<{ text: string; from: number; to: number } | null | undefined>(undefined)
  useEffect(() => {
    loadTafsir(surah.id).then((tf) => setT(tafsirFor(tf, ayah, surah.ayahs))).catch(() => setT(null))
  }, [surah, ayah])
  const range = t ? (t.from === t.to ? `аят ${t.from}` : `аяты ${t.from}–${t.to}`) : `аят ${ayah}`
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Тафсир ас-Саади" sub={`${surah.name}, ${range}`} onClose={onClose} />
      <div className="body">
        {t === undefined && <div className="loading">Загрузка…</div>}
        {t === null && <div className="empty">Для этого аята тафсир не найден</div>}
        {t && <div className="tafsir">{t.text}</div>}
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

const TRANSLATIONS: Record<Translation, string> = { ku: 'Эльмир Кулиев', aa: 'Абу Адель' }

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
            <div className="fld" style={{ marginTop: 6 }}><label>Размер арабского текста</label>
              <div className="stepper"><small>{st.arSize}</small><button onClick={() => st.set({ arSize: Math.max(20, st.arSize - 2) })}>−</button><button onClick={() => st.set({ arSize: Math.min(44, st.arSize + 2) })}>+</button></div>
            </div>
            <div className="fld"><label>Размер перевода</label>
              <div className="stepper"><small>{st.trSize}</small><button onClick={() => st.set({ trSize: Math.max(12, st.trSize - 1) })}>−</button><button onClick={() => st.set({ trSize: Math.min(24, st.trSize + 1) })}>+</button></div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
