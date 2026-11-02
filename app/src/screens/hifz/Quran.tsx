import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural, Sheet, SheetHead, useQuranMeta } from '../../components/ui'
import { loadSurah, surahGlyph, type Surah } from '../../lib/data'
import { dayNum, inDays } from '../../lib/hifz'
import { JUZ30, linesOf, MAX_AYAHS, nextStart, passageFrom, surahProgress } from '../../lib/hifzQuran'
import { haptic } from '../../lib/telegram'
import { dayStr, useStore } from '../../store/settings'
import { HifzTabs, StageDots } from './parts'

/** Что на сегодня в Коране: отрывки на повтор и сколько новых аятов осталось по плану */
export function useQhToday() {
  const cards = useStore((s) => s.qhifz)
  const plan = useStore((s) => s.qhPerDay)
  const today = useStore((s) => s.today)
  const d = dayNum()
  const due = Object.entries(cards).filter(([, c]) => c.d <= d).map(([k]) => k)
  const learnedToday = today.d === dayStr() ? (today.qa ?? 0) : 0
  return { due, learnedToday, plan, newLeft: Math.max(0, plan - learnedToday), started: Object.keys(cards).length > 0 }
}

/** Следующий новый отрывок (по плану на сегодня) */
export function useNextPassage(surahs: Surah[] | undefined, n: number) {
  const cards = useStore((s) => s.qhifz)
  const pos = useStore((s) => s.qhPos)
  const [p, setP] = useState<{ s: number; a: number; b: number; words: number } | null>(null)
  const start = surahs ? nextStart(cards, pos, (s) => surahs[s - 1].ayahs) : null
  useEffect(() => {
    if (!start) { setP(null); return }
    let alive = true
    loadSurah(start.s).then((ay) => alive && setP(passageFrom(ay, cards, start.s, start.a, Math.max(1, n))))
    return () => { alive = false }
  }, [start?.s, start?.a, n, cards])
  return p
}

// Раздел «Заучивание» → «Коран»: что на сегодня, откуда учить, план, суры с прогрессом
export default function QuranHifz() {
  const nav = useNavigate()
  const st = useStore()
  const surahs = useQuranMeta()?.surahs
  const { due, newLeft, learnedToday, plan, started } = useQhToday()
  const next = useNextPassage(surahs, newLeft || plan)
  const [pick, setPick] = useState(false)
  const [open, setOpen] = useState<Surah | null>(null)
  const name = (s: number) => surahs?.[s - 1]?.name ?? ''

  const setPlan = (n: number) => { haptic.tick(); st.set({ qhPerDay: Math.max(1, Math.min(30, n)) }) }
  const learned = Object.entries(st.qhifz).reduce((a, [k, c]) => { const m = k.match(/:(\d+)-(\d+)$/)!; return a + (c.s >= 4 ? +m[2] - +m[1] + 1 : 0) }, 0)
  const inWork = Object.keys(st.qhifz).reduce((a, k) => { const m = k.match(/:(\d+)-(\d+)$/)!; return a + +m[2] - +m[1] + 1 }, 0)
  // суры: сначала начатые и выбранная, потом остальные из 30-го джуза
  const mine = [...new Set([...(st.qhPos ? [st.qhPos.s] : []), ...Object.keys(st.qhifz).map((k) => +k.split(':')[0])])]
  const list = [...mine.filter((s) => !JUZ30.includes(s)).sort((a, b) => a - b), ...JUZ30]
  const learnNew = (more?: boolean) => nav(more ? '/hifz/quran/learn?n=' + plan : '/hifz/quran/learn')

  return (
    <div className="screen hz">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Заучивание</b><span>Коран</span></div>
        <span className="icon-btn ghost"><Icon id="brain" /></span>
      </div>
      <HifzTabs on="quran" />

      <section className="hz-hero">
        <div className="hz-hero-ar">القرآن الكريم</div>
        <span className="hz-hero-l">Сегодня</span>
        {due.length === 0 && newLeft === 0 ? (
          <>
            <b className="hz-hero-t">На сегодня всё — машаАллах!</b>
            <p>Выучено {learnedToday} {plural(learnedToday, 'аят', 'аята', 'аятов')}. Отрывки сами вернутся на повтор.</p>
          </>
        ) : (
          <>
            <b className="hz-hero-t">{[due.length ? `${due.length} на повтор` : '', newLeft ? `${newLeft} ${plural(newLeft, 'новый аят', 'новых аята', 'новых аятов')}` : ''].filter(Boolean).join(' · ')}</b>
            <p>{due.length ? 'Сначала повторите выученное, потом — новое.' : next ? `${name(next.s)}, ${next.a === next.b ? `аят ${next.a}` : `аяты ${next.a}–${next.b}`} · ≈ ${linesOf(next.words)} ${plural(linesOf(next.words), 'строка', 'строки', 'строк')}` : ''}</p>
          </>
        )}
        <div className="hz-hero-btns">
          {due.length > 0 && <button className="gold" onClick={() => nav('/hifz/quran/review')}><Icon id="repeat" />Повторить · {due.length}</button>}
          {newLeft > 0 && next && <button className={due.length ? '' : 'gold'} onClick={() => learnNew()}><Icon id="plus" />{due.length ? 'Новое' : 'Учить'}</button>}
          {newLeft === 0 && due.length === 0 && next && <button onClick={() => learnNew(true)}><Icon id="plus" />Выучить ещё</button>}
        </div>
        {started && (
          <div className="hz-hero-stat">
            <span><b>{learned}</b> выучено</span>
            <span><b>{inWork - learned}</b> в повторении</span>
            <span><b>{mine.length}</b> {plural(mine.length, 'сура', 'суры', 'сур')}</span>
          </div>
        )}
      </section>

      <div className="group-t">Что учить</div>
      <button className="qh-cur" onClick={() => setPick(true)}>
        <div className="num-badge"><span>{st.qhPos ? st.qhPos.s : 30}</span></div>
        <div className="t">
          <b>{st.qhPos && next?.s === st.qhPos.s ? `Сура ${name(st.qhPos.s)}` : '30-й джуз · с конца'}</b>
          <span>{next ? `Дальше: ${name(next.s)}, с аята ${next.a}` : 'Всё выбранное уже в заучивании'}</span>
        </div>
        <span className="hz-count">Выбрать</span>
      </button>

      <div className="group-t">План</div>
      <div className="group">
        <div className="sitem">
          <span className="si" style={{ background: 'var(--emerald)' }}><Icon id="star" /></span>
          <span className="t">Новых аятов в день<small className="hz-sub">{next ? `Сейчас это ≈ ${linesOf(next.words)} ${plural(linesOf(next.words), 'строка', 'строки', 'строк')} мусхафа` : 'Длинные аяты делятся на отрывки поменьше'}</small></span>
          <span className="hz-step">
            <button onClick={() => setPlan(plan - 1)} disabled={plan <= 1} aria-label="Меньше"><Icon id="minus" /></button>
            <b>{plan}</b>
            <button onClick={() => setPlan(plan + 1)} disabled={plan >= 30} aria-label="Больше"><Icon id="plus" /></button>
          </span>
        </div>
        {plan > MAX_AYAHS && <p className="hz-how" style={{ margin: '0 14px 10px' }}>Больше {MAX_AYAHS} аятов в день — много: повторов быстро станет слишком много. Лучше меньше, но каждый день.</p>}
        <button className="sitem" onClick={() => st.set({ qhDrills: !st.qhDrills })}>
          <span className="si" style={{ background: '#C98A2B' }}><Icon id="words" /></span>
          <span className="t">Упражнения при заучивании<small className="hz-sub">Видно слово через одно, потом через два</small></span>
          <span className={'switch' + (st.qhDrills ? ' on' : '')} />
        </button>
      </div>
      <p className="hz-how">
        Как это работает: послушайте отрывок (чтец повторяет каждый аят), прочитайте его, потом прочитайте по памяти — видно только перевод.
        Выученный отрывок будет периодически возвращаться на повтор: чем лучше вы его помните, тем реже.
      </p>

      <div className="section-h"><h2>Суры</h2></div>
      {!surahs ? <div className="loading">Загрузка…</div> : list.map((s) => {
        const sr = surahs[s - 1]
        const pr = surahProgress(st.qhifz, s)
        return (
          <button key={s} className={'hz-row' + (pr.due !== null && pr.due <= 0 ? ' due' : '')} onClick={() => setOpen(sr)}>
            <div className="num-badge"><span>{s}</span></div>
            <div className="t"><b>{sr.name}</b><span>{rowText(pr, sr.ayahs)}</span></div>
            <StageDots s={pr.stage} started={pr.started > 0} />
          </button>
        )
      })}
      <div style={{ height: 24 }} />

      {pick && surahs && <PickSheet surahs={surahs} onClose={() => setPick(false)} />}
      {open && <SurahSheet sr={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function rowText(pr: ReturnType<typeof surahProgress>, total: number) {
  if (!pr.started) return `Не начата · ${total} ${plural(total, 'аят', 'аята', 'аятов')}`
  const head = pr.learned >= total ? 'Выучена' : `${pr.started} из ${total} ${plural(total, 'аята', 'аятов', 'аятов')}`
  return `${head} · ${pr.due !== null && pr.due <= 0 ? 'повтор сегодня' : `повтор ${inDays(pr.due ?? 0)}`}`
}

/** Выбор, откуда учить: 30-й джуз с конца или любая сура */
function PickSheet({ surahs, onClose }: { surahs: Surah[]; onClose: () => void }) {
  const set = useStore((s) => s.set)
  const choose = (pos: { s: number; a: number } | null) => { haptic.tick(); set({ qhPos: pos }); onClose() }
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Что учить" sub="Новые аяты будут браться отсюда" onClose={onClose} />
      <div className="body qh-pick">
        <button className="list-item" onClick={() => choose(null)}>
          <div className="ib"><Icon id="book" /></div>
          <div className="t"><b>30-й джуз · с конца</b><span>ан-Нас, аль-Фаляк, аль-Ихлас … ан-Наба</span></div>
        </button>
        {surahs.map((s) => (
          <button key={s.id} className="srow" onClick={() => choose({ s: s.id, a: 1 })}>
            <div className="num-badge"><span>{s.id}</span></div>
            <div className="t"><b>{s.name}</b><span>{s.meaning} · {s.ayahs} {plural(s.ayahs, 'аят', 'аята', 'аятов')}</span></div>
            <div className="r"><span className="sname">{surahGlyph(s.id)}</span></div>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** Сура из списка: прогресс и действия */
function SurahSheet({ sr, onClose }: { sr: Surah; onClose: () => void }) {
  const nav = useNavigate()
  const cards = useStore((s) => s.qhifz)
  const set = useStore((s) => s.set)
  const reset = useStore((s) => s.qhReset)
  const pr = surahProgress(cards, sr.id)
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={`Сура ${sr.name}`} sub={rowText(pr, sr.ayahs)} onClose={onClose} />
      <div className="hz-sheet-btns">
        {pr.started < sr.ayahs && <button className="bigbtn" onClick={() => { set({ qhPos: { s: sr.id, a: 1 } }); nav('/hifz/quran/learn') }}><Icon id="plus" />{pr.started ? 'Учить дальше' : 'Учить эту суру'}</button>}
        {pr.started > 0 && <button className={pr.started < sr.ayahs ? 'hz-again' : 'bigbtn'} onClick={() => nav(`/hifz/quran/review?s=${sr.id}`)}><Icon id="repeat" />Повторить сейчас</button>}
        <button className="hz-again" onClick={() => nav(`/read/${sr.id}`)}><Icon id="book" />Открыть в читалке</button>
        {pr.started > 0 && (confirm
          ? <button className="hz-warn-go danger" onClick={() => { reset(sr.id); setConfirm(false) }}>Точно? Прогресс по суре удалится</button>
          : <button className="hz-warn-go" onClick={() => setConfirm(true)}>Начать заново</button>)}
      </div>
    </Sheet>
  )
}
