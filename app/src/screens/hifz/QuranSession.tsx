import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural, useQuranMeta } from '../../components/ui'
import { loadSurah } from '../../lib/data'
import { dayNum, inDays, nextInterval, type Grade } from '../../lib/hifz'
import { coveredAyahs, loadQItem, nextStart, passageFrom, qKey, type QItem } from '../../lib/hifzQuran'
import { haptic } from '../../lib/telegram'
import { setBitrates, setReciter, usePlayer } from '../../store/player'
import { useStore } from '../../store/settings'
import { AyahWords } from '../reader/views'
import { useQhToday } from './Quran'

type Step = 'read' | 'show2' | 'show3' | 'tell'
const STEP_NAME: Record<Step, string> = {
  read: 'Слушать и читать', show2: 'Видно слово через одно', show3: 'Видно слово через два', tell: 'Прочитай по памяти',
}
/** В повторении за раз — не больше стольких отрывков (самые давние); остальные подождут до завтра */
const REVIEW_MAX = 10

// Урок заучивания отрывка Корана (learn) и повторение (review).
//  learn:  слушать и читать → [видно слово через одно → через два] → по памяти (виден перевод) → «Запомнил»
//  review: по памяти (виден перевод, арабский размыт; нажатие — открыть и послушать) → Плохо / Средне / Хорошо
export default function QuranSessionRoute({ mode }: { mode: 'learn' | 'review' }) {
  return <QuranSession key={useLocation().key} mode={mode} />
}

function QuranSession({ mode }: { mode: 'learn' | 'review' }) {
  const nav = useNavigate()
  const [search] = useSearchParams()
  const surahs = useQuranMeta()?.surahs
  const [queue, setQueue] = useState<QItem[] | null>(null)
  const [done, setDone] = useState(0)

  useEffect(() => {
    const st = useStore.getState()
    setReciter(st.reciter)
    setBitrates(st.bitrates)
    return () => usePlayer.getState().stop()
  }, [])

  // очередь собирается один раз при открытии
  useEffect(() => {
    if (!surahs) return
    const st = useStore.getState()
    const cards = st.qhifz
    let p: Promise<QItem[]>
    if (mode === 'review') {
      const s = Number(search.get('s'))
      const d = dayNum()
      const keys = Object.entries(cards).filter(([k, c]) => (s ? k.startsWith(s + ':') : c.d <= d)).sort((a, b) => a[1].d - b[1].d).slice(0, REVIEW_MAX).map(([k]) => k)
      p = Promise.all(keys.map(loadQItem)).then((l) => l.filter((x): x is QItem => !!x).sort((a, b) => b.s - a.s || a.a - b.a))
    } else {
      // с выбранного аята (из читалки) или откуда учим дальше
      const s0 = Number(search.get('s')), a0 = Number(search.get('a'))
      if (s0 && a0) st.set({ qhPos: { s: s0, a: a0 } })
      const start = s0 && a0 ? { s: s0, a: a0 } : nextStart(cards, st.qhPos, (s) => surahs[s - 1].ayahs)
      const left = Math.max(0, st.qhPerDay - (st.today.qa ?? 0))
      const n = Number(search.get('n')) || left || st.qhPerDay
      p = !start ? Promise.resolve([]) : loadSurah(start.s).then((ay) => {
        const ps = passageFrom(ay, cards, start.s, start.a, n)
        // аят из читалки уже учится — повторяем его отрывок
        return coveredAyahs(cards, ps.s).has(ps.a) ? [] : [{ key: qKey(ps.s, ps.a, ps.b), s: ps.s, a: ps.a, b: ps.b, ayahs: ay.slice(ps.a - 1, ps.b) }]
      })
    }
    p.then(setQueue).catch(() => setQueue([]))
  }, [mode, search, surahs])

  const item = queue?.[0]
  const next = () => { usePlayer.getState().stop(); setQueue((q) => q!.slice(1)); setDone((n) => n + 1) }
  const name = (s: number) => surahs?.[s - 1]?.name ?? ''

  return (
    <div className="nml hz-s">
      <div className="azc-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="close" /></button>
        <div className="ttl"><b>{mode === 'learn' ? 'Новый отрывок' : 'Повторение'}</b><span>{queue && item ? `${name(item.s)} · ${item.a === item.b ? `аят ${item.a}` : `${item.a}–${item.b}`}${mode === 'review' ? ` · ${done + 1} из ${done + queue.length}` : ''}` : 'Коран'}</span></div>
        <span style={{ width: 44 }} />
      </div>
      {!queue ? <div className="loading">Загрузка…</div>
        : !item ? <Finish mode={mode} count={done} />
          : mode === 'learn' ? <LearnItem key={item.key} item={item} onDone={next} />
            : <ReviewItem key={item.key} item={item} onDone={next} />}
    </div>
  )
}

// ===== заучивание нового =====

function LearnItem({ item, onDone }: { item: QItem; onDone: () => void }) {
  const drills = useStore((s) => s.qhDrills)
  const learn = useStore((s) => s.qhLearn)
  const steps: Step[] = useMemo(() => ['read', ...(drills ? ['show2', 'show3'] as Step[] : []), 'tell'], [drills])
  const [i, setI] = useState(0)
  const step = steps[i]
  const go = (k: number) => { haptic.tap(); usePlayer.getState().stop(); setI(k); document.querySelector('.hz-s .nml-body')?.scrollTo(0, 0) }

  return (
    <div className="nml-body">
      <div className="hz-steps">{steps.map((s, k) => <i key={s} className={k < i ? 'done' : k === i ? 'on' : ''} />)}</div>
      <div className="hz-step-name">{STEP_NAME[step]}</div>

      {step === 'read' && (
        <>
          <div className="hz-card"><Ayahs item={item} /></div>
          <Listen item={item} />
          <div className="hz-act">
            <button className="bigbtn" onClick={() => go(1)}><Icon id="check" />Прочитал</button>
          </div>
        </>
      )}

      {(step === 'show2' || step === 'show3') && (
        <>
          <div className="hz-card"><Ayahs key={step} item={item} every={step === 'show2' ? 2 : 3} /></div>
          <p className="hz-tip">Прочитайте отрывок, подставляя скрытые слова. Нажмите на рамку, чтобы подсмотреть слово.</p>
          <div className="hz-act">
            <button className="hz-skip" onClick={() => go(steps.indexOf('tell'))}>Пропустить упражнения</button>
            <button className="bigbtn" onClick={() => go(i + 1)}>Дальше<Icon id="right" /></button>
          </div>
        </>
      )}

      {step === 'tell' && (
        <Tell item={item}>
          <div className="hz-act two">
            <button className="hz-again" onClick={() => go(0)}><Icon id="repeat" />Прочитать ещё</button>
            <button className="bigbtn" onClick={() => { learn(item.key); haptic.success(); onDone() }}><Icon id="check" />Запомнил</button>
          </div>
        </Tell>
      )}
    </div>
  )
}

// ===== повторение =====

function ReviewItem({ item, onDone }: { item: QItem; onDone: () => void }) {
  const card = useStore((s) => s.qhifz[item.key])
  const grade = useStore((s) => s.qhGrade)
  const rate = (g: Grade) => { grade(item.key, g); if (g === 'good') haptic.success(); else haptic.tap(); onDone() }
  const btn = (g: Grade, label: string) => (
    <button className={'hz-grade ' + g} onClick={() => rate(g)}>
      <b>{label}</b><span>{inDays(nextInterval(card, g))}</span>
    </button>
  )
  return (
    <div className="nml-body">
      <Tell item={item} review>
        <div className="hz-grades">
          {btn('bad', 'Плохо')}
          {btn('mid', 'Средне')}
          {btn('good', 'Хорошо')}
        </div>
        <p className="hz-tip">«Плохо» — запинался или забыл: отрывок начнётся сначала. «Средне» — с ошибками: тот же срок ещё раз.</p>
      </Tell>
    </div>
  )
}

// ===== части урока =====

/** Аяты отрывка с переводом; every — видно только каждое every-е слово (остальные скрыты, нажатие — подсмотреть) */
function Ayahs({ item, every }: { item: QItem; every?: number }) {
  const tajweed = useStore((s) => s.tajweed)
  const tr = useStore((s) => s.translation)
  const current = usePlayer((s) => s.current)
  const [shown, setShown] = useState<Set<string>>(new Set())
  const peek = (id: string) => { haptic.tick(); setShown((s) => new Set(s).add(id)) }
  return (
    <>
      {item.ayahs.map((a) => (
        <div key={a.n} className={'qh-ayah' + (current === `${item.s}:${a.n}` ? ' playing' : '')}>
          <AyahWords a={a} tajweed={tajweed} hide={every ? (i) => i % every !== 0 && !shown.has(`${a.n}.${i}`) : undefined} onPeek={(i) => peek(`${a.n}.${i}`)} />
          <div className="qh-tr"><b>{a.n}</b>{tr === 'aa' ? a.aa : a.ku}</div>
        </div>
      ))}
    </>
  )
}

/** Прослушивание отрывка: чтец повторяет каждый аят N раз */
function Listen({ item }: { item: QItem }) {
  const rep = useStore((s) => s.qhRepeat)
  const set = useStore((s) => s.set)
  const status = usePlayer((s) => s.status)
  const playing = status === 'playing' || status === 'loading'
  const error = usePlayer((s) => s.error)
  const play = () => {
    haptic.tap()
    const p = usePlayer.getState()
    if (playing) return p.stop()
    p.play(item.ayahs.map((a) => `${item.s}:${a.n}`), 0, { repeatEach: rep, repeatRange: 1, pause: 0, hideText: false })
  }
  return (
    <div className="hz-card">
      <button className="bigbtn" onClick={play}><Icon id={playing ? 'pause' : 'play'} />{playing ? 'Остановить' : 'Слушать отрывок'}</button>
      <div className="qh-rep">
        <span>Каждый аят</span>
        {[1, 3, 5].map((n) => <button key={n} className={rep === n ? 'on' : ''} onClick={() => { haptic.tick(); set({ qhRepeat: n }) }}>{n}×</button>)}
      </div>
      {error && <p className="hz-tip">{error}</p>}
    </div>
  )
}

/** По памяти: виден перевод, арабский размыт; нажатие на аят — открыть и послушать; «Проверить себя» — открыть всё */
function Tell({ item, review, children }: { item: QItem; review?: boolean; children: ReactNode }) {
  const tajweed = useStore((s) => s.tajweed)
  const tr = useStore((s) => s.translation)
  const current = usePlayer((s) => s.current)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const all = open.size === item.ayahs.length
  const reveal = (n: number) => {
    haptic.tick()
    setOpen((s) => new Set(s).add(n))
    usePlayer.getState().play([`${item.s}:${n}`])
  }
  return (
    <>
      <div className="hz-card">
        <p className="hz-tip" style={{ marginTop: 0 }}>Прочитайте отрывок по памяти{review ? '' : ' — вслух или про себя'}. Подсказка — перевод. Нажмите на аят, чтобы проверить себя и послушать.</p>
        {item.ayahs.map((a) => (
          <div key={a.n} className={'qh-ayah' + (current === `${item.s}:${a.n}` ? ' playing' : '')}>
            <div className="qh-tr"><b>{a.n}</b>{tr === 'aa' ? a.aa : a.ku}</div>
            {open.has(a.n)
              ? <AyahWords a={a} tajweed={tajweed} />
              : <div className="qh-hid" onClick={() => reveal(a.n)}><div className="qh-blur"><AyahWords a={a} tajweed={tajweed} /></div><span className="qh-reveal-l">Нажмите, чтобы открыть</span></div>}
          </div>
        ))}
      </div>
      {all ? children : (
        <div className="hz-act">
          <button className="bigbtn" onClick={() => { haptic.tap(); setOpen(new Set(item.ayahs.map((a) => a.n))) }}><Icon id="open" />Проверить себя</button>
        </div>
      )}
    </>
  )
}

// ===== итог =====

function Finish({ mode, count }: { mode: 'learn' | 'review'; count: number }) {
  const nav = useNavigate()
  const { due, newLeft } = useQhToday()
  const markTask = useStore((s) => s.markTask)
  const nothingLeft = due.length === 0 && newLeft === 0
  useEffect(() => { if (nothingLeft && count) markTask('memo', true) }, [nothingLeft, count, markTask])
  return (
    <div className="nml-body nml-done">
      <div className="hz-done-ic"><Icon id="check" /></div>
      <b>{count === 0 ? (mode === 'review' ? 'Сегодня повторять нечего' : 'Этот отрывок уже учится') : mode === 'learn'
        ? 'Отрывок выучен — машаАллах!'
        : `Повторено ${count} ${plural(count, 'отрывок', 'отрывка', 'отрывков')}`}</b>
      <span>{mode === 'learn' && count ? 'Первый повтор — завтра. Приложение само напомнит в блоке «Сегодня».' : nothingLeft ? 'На сегодня всё. Следующие повторы появятся сами.' : ''}</span>
      {due.length > 0 && <button className="bigbtn" onClick={() => nav('/hifz/quran/review', { replace: true })}><Icon id="repeat" />Повторить · {due.length}</button>}
      {due.length === 0 && newLeft > 0 && <button className="bigbtn" onClick={() => nav('/hifz/quran/learn', { replace: true })}><Icon id="plus" />Учить дальше</button>}
      {nothingLeft && <button className="hz-again" onClick={() => nav('/hifz/quran/learn?n=' + useStore.getState().qhPerDay, { replace: true })}><Icon id="plus" />Выучить ещё</button>}
      <button className="hz-skip" onClick={() => nav('/hifz/quran', { replace: true })}>Готово</button>
    </div>
  )
}
