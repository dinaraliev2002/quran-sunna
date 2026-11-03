import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural } from '../../lib/plural'
import { baseOf, bodyWords, dayNum, expand, firstLetter, hiddenMask, inDays, loadByKeys, loadHifzSet, LONG_WORDS, MAX_NEW, nextInterval, setOf, shuffled, toChunks, toWords, type Grade, type HifzItem } from '../../lib/hifz'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { HadithBody, ListenBtn, useHifzToday, WarnSheet } from './parts'
import { SplitBtn } from './SplitEditor'


type Step = 'read' | 'gap3' | 'gap2' | 'gap1' | 'letters' | 'build' | 'tell'
const DRILLS: Step[] = ['gap3', 'gap2', 'gap1', 'letters', 'build']
const STEP_NAME: Record<Step, string> = {
  read: 'Чтение', gap3: 'Пропуски · каждое третье слово', gap2: 'Пропуски · половина слов', gap1: 'Пропуски · все слова',
  letters: 'Первые буквы', build: 'Собери хадис', tell: 'Расскажи по памяти',
}

// Урок заучивания (mode = learn) и повторение (mode = review).
//  learn:  чтение → [упражнения, если включены] → «Расскажи хадис о…» → открыть и проверить → «Запомнил» / «Прочитать ещё»
//  review: в случайном порядке «Расскажи хадис о…» → открыть → Плохо / Средне / Хорошо
export default function SessionRoute({ mode }: { mode: 'learn' | 'review' }) {
  // новый переход (например, «Выучить ещё один») — новая очередь
  return <Session key={useLocation().key} mode={mode} />
}

function Session({ mode }: { mode: 'learn' | 'review' }) {
  const nav = useNavigate()
  const [search] = useSearchParams()
  const [queue, setQueue] = useState<HifzItem[] | null>(null)
  const [done, setDone] = useState(0)

  // очередь собирается один раз при открытии
  useEffect(() => {
    const st = useStore.getState()
    const only = search.get('key')
    const d = dayNum()
    const p = only
      // один хадис из списка: учить — первую невыученную часть, повторить — все начатые части
      ? loadHifzSet(setOf(only).id, st.myHifz).then((items) => expand(items, st.hzSplit)
        .filter((u) => baseOf(u.key) === only && (mode === 'learn' ? !st.hifz[u.key] : !!st.hifz[u.key])).slice(0, mode === 'learn' ? 1 : 9))
      : mode === 'review' ? loadByKeys(Object.entries(st.hifz).filter(([, c]) => c.d <= d).map(([k]) => k), st.myHifz, st.hzSplit).then(shuffled)
        : loadHifzSet(st.hzSet, st.myHifz).then((items) => {
          const today = st.today.hz?.length ?? 0
          const n = Number(search.get('n')) || Math.max(1, st.hzPerDay - today)
          return expand(items, st.hzSplit).filter((u) => !st.hifz[u.key]).slice(0, n)
        })
    p.then(setQueue).catch(() => setQueue([]))
  }, [mode, search])

  const item = queue?.[0]
  const next = () => { setQueue((q) => q!.slice(1)); setDone((n) => n + 1) }
  const title = mode === 'learn' ? 'Новый хадис' : 'Повторение'

  return (
    <div className="nml hz-s">
      <div className="azc-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="close" /></button>
        <div className="ttl"><b>{title}</b><span>{queue && item ? `${done + 1} из ${done + queue.length} · ${setOf(item.key).short}` : 'Хадисы'}</span></div>
        <span style={{ width: 44 }} />
      </div>
      {!queue ? <div className="loading">Загрузка…</div>
        : !item ? <Finish mode={mode} count={done} />
          : mode === 'learn' ? <LearnItem key={item.key} item={item} onDone={next} onSplit={(parts) => setQueue((q) => [parts[0], ...q!.slice(1).filter((x) => baseOf(x.key) !== baseOf(parts[0].key))])} />
            : <ReviewItem key={item.key} item={item} onDone={next} />}
    </div>
  )
}

// ===== заучивание нового =====

function LearnItem({ item, onDone, onSplit }: { item: HifzItem; onDone: () => void; onSplit: (parts: HifzItem[]) => void }) {
  const drills = useStore((s) => s.hzDrills)
  const long = !item.part && bodyWords(item) > LONG_WORDS
  // делить можно хадис от 15 слов (и любую его часть — меняется деление всего хадиса)
  const canSplit = !!item.part || bodyWords(item) >= 15
  const showAr = useStore((s) => s.hzAr)
  const learn = useStore((s) => s.hifzLearn)
  const steps: Step[] = useMemo(() => ['read', ...(drills ? DRILLS : []), 'tell'], [drills])
  const [i, setI] = useState(0)
  const step = steps[i]
  const go = (k: number) => { haptic.tap(); setI(k); document.querySelector('.hz-s .nml-body')?.scrollTo(0, 0) }

  return (
    <div className="nml-body">
      <div className="hz-steps">{steps.map((s, k) => <i key={s} className={k < i ? 'done' : k === i ? 'on' : ''} />)}</div>
      <div className="hz-step-name">{STEP_NAME[step]}</div>

      {step === 'read' && (
        <>
          <div className="hz-card">
            <div className="hz-card-h"><span className="hz-no">{setOf(item.key).short}{item.key[0] !== 'u' ? ` · ${item.id}` : ''}</span><span className="hz-by">{item.by}</span></div>
            <b className="hz-card-t">{item.t}</b>
            {item.part && <PartLabel part={item.part} />}
            <HadithBody item={item} ar={showAr} />
          </div>
          {long && <p className="hz-tip hz-tip-split">Длинный хадис — его можно учить по частям: кнопка слева от «Слушать».</p>}
          <div className="hz-act">
            {canSplit
              ? <ListenBtn src={item.audio} range={item.range} lead={<SplitBtn item={item} onChange={onSplit} />} />
              : <ListenBtn src={item.audio} range={item.range} />}
            <button className="bigbtn" onClick={() => go(1)}><Icon id="check" />Прочитал</button>
          </div>
        </>
      )}

      {(step === 'gap3' || step === 'gap2' || step === 'gap1' || step === 'letters') && (
        <>
          <div className="hz-card">
            <p className="hz-q-s">Хадис <b>{item.q}</b></p>
            <Drill key={step} item={item} kind={step} />
          </div>
          <p className="hz-tip">Проговорите хадис, подставляя скрытые слова. Нажмите на слово, чтобы подсмотреть.</p>
          <div className="hz-act">
            <button className="hz-skip" onClick={() => go(steps.indexOf('tell'))}>Пропустить упражнения</button>
            <button className="bigbtn" onClick={() => go(i + 1)}>Дальше<Icon id="right" /></button>
          </div>
        </>
      )}

      {step === 'build' && <Build item={item} onDone={() => go(i + 1)} onSkip={() => go(i + 1)} />}

      {step === 'tell' && (
        <Tell item={item} showAr={showAr}>
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

function ReviewItem({ item, onDone }: { item: HifzItem; onDone: () => void }) {
  const showAr = useStore((s) => s.hzAr)
  const key = item.key
  const card = useStore((s) => s.hifz[key])
  const grade = useStore((s) => s.hifzGrade)
  const rate = (g: Grade) => { grade(key, g); if (g === 'good') haptic.success(); else haptic.tap(); onDone() }
  const btn = (g: Grade, label: string) => (
    <button className={'hz-grade ' + g} onClick={() => rate(g)}>
      <b>{label}</b><span>{inDays(nextInterval(card, g))}</span>
    </button>
  )
  return (
    <div className="nml-body">
      <Tell item={item} showAr={showAr} review>
        <div className="hz-grades">
          {btn('bad', 'Плохо')}
          {btn('mid', 'Средне')}
          {btn('good', 'Хорошо')}
        </div>
        <p className="hz-tip">«Плохо» — запинался или забыл: хадис начнётся сначала. «Средне» — с ошибками: тот же срок ещё раз.</p>
      </Tell>
    </div>
  )
}

/** «Расскажи хадис о…»: текст закрыт; подсказка — первые буквы; «Проверить себя» открывает текст и кнопки оценки */
function Tell({ item, showAr, review, children }: { item: HifzItem; showAr: boolean; review?: boolean; children: ReactNode }) {
  const [hint, setHint] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className={'hz-card hz-tell' + (open ? ' open' : '')}>
        <span className="hz-tell-l">Расскажи хадис</span>
        <b className="hz-tell-q">{item.q}</b>
        {item.part && <PartLabel part={item.part} />}
        {!open && (
          <>
            <p className="hz-tip">Перескажите хадис вслух или про себя{review ? '' : ' — так близко к тексту, как сможете'}. Потом откройте текст и сравните.</p>
            {hint ? <div className="hz-hint"><span>Начало хадиса</span><b>«{item.hint}»</b></div>
              : <button className="hz-hint-btn" onClick={() => { haptic.tick(); setHint(true) }}><Icon id="eye" />Подсказка: начало хадиса</button>}
          </>
        )}
        {open && (
          <>
            <div className="hz-card-h"><span className="hz-no">{setOf(item.key).short}{item.key[0] !== 'u' ? ` · ${item.id}` : ''}</span><span className="hz-by">{item.by}</span></div>
            <HadithBody item={item} ar={showAr} />
            <ListenBtn src={item.audio} range={item.range} />
          </>
        )}
      </div>
      {open ? children : (
        <div className="hz-act">
          <button className="bigbtn" onClick={() => { haptic.tap(); setOpen(true) }}><Icon id="open" />Проверить себя</button>
        </div>
      )}
    </>
  )
}

/** Текст с пропусками или первыми буквами; нажатие на слово показывает его */
function Drill({ item, kind }: { item: HifzItem; kind: 'gap3' | 'gap2' | 'gap1' | 'letters' }) {
  const words = useMemo(() => toWords(item.ru, item.start), [item])
  const every = kind === 'gap3' ? 3 : kind === 'gap2' ? 2 : 1
  const mask = useMemo(() => hiddenMask(words, every, kind === 'gap2' ? 1 : 0), [words, every, kind])
  const [shown, setShown] = useState<Set<string>>(new Set())
  const [all, setAll] = useState(false)
  const peek = (id: string) => { haptic.tick(); setShown((s) => new Set(s).add(id)) }
  return (
    <div className="hz-drill">
      {words.map((p, pi) => (
        <p key={pi}>
          {p.map((w, wi) => {
            const id = `${pi}.${wi}`
            const hide = !all && !shown.has(id) && (kind === 'letters' ? w.letter && w.body : mask[pi][wi])
            if (!hide) return <span key={wi}>{w.w} </span>
            if (kind === 'letters') return <button key={wi} className="hz-fl" onClick={() => peek(id)}>{firstLetter(w.w)}</button>
            // пропуск: знаки препинания по краям остаются видны
            const m = w.w.match(/^([^a-zа-яё]*)(.*?)([^a-zа-яё]*)$/i)!
            return <span key={wi}>{m[1]}<button className="hz-gap" style={{ width: `${Math.max(2, m[2].length * 0.55)}em` }} onClick={() => peek(id)} aria-label="Показать слово" />{m[3]} </span>
          })}
        </p>
      ))}
      <button className="hz-all" onClick={() => { haptic.tick(); setAll(!all) }}>{all ? 'Скрыть снова' : 'Показать весь текст'}</button>
    </div>
  )
}

/** Сборка хадиса из перемешанных кусочков */
function Build({ item, onDone, onSkip }: { item: HifzItem; onDone: () => void; onSkip: () => void }) {
  // собираем только сам хадис — без «Я слышал, как Посланник Аллаха ﷺ сказал:»
  const chunks = useMemo(() => {
    const body = item.ru.map((p, i) => (i === item.start[0] ? p.split(/\s+/).filter(Boolean).slice(item.start[1]).join(' ') : p)).slice(item.start[0]).filter(Boolean)
    const n = body.join(' ').split(/\s+/).length
    return toChunks(body, Math.max(5, Math.ceil(n / 14)))
  }, [item])
  const [pool] = useState(() => shuffled(chunks.map((c, k) => ({ c, k }))))
  const [placed, setPlaced] = useState(0)
  const [bad, setBad] = useState<number | null>(null)
  const pick = (k: number) => {
    if (k === placed) { haptic.tick(); setPlaced(placed + 1); setBad(null) }
    else { haptic.tap(); setBad(k); setTimeout(() => setBad(null), 450) }
  }
  const finished = placed === chunks.length
  return (
    <>
      <div className="hz-card">
        <p className="hz-q-s">Хадис <b>{item.q}</b></p>
        <div className="hz-built">{placed ? chunks.slice(0, placed).join(' ') : <span className="hz-ph">Нажимайте кусочки по порядку…</span>}</div>
      </div>
      {!finished && (
        <div className="hz-pool">
          {pool.filter((p) => p.k >= placed).map((p) => (
            <button key={p.k} className={bad === p.k ? 'bad' : ''} onClick={() => pick(p.k)}>{p.c}</button>
          ))}
        </div>
      )}
      <div className="hz-act">
        {finished ? <button className="bigbtn" onClick={onDone}>Собрано — дальше<Icon id="right" /></button>
          : <button className="hz-skip" onClick={onSkip}>Пропустить</button>}
      </div>
    </>
  )
}

// ===== итог =====

function Finish({ mode, count }: { mode: 'learn' | 'review'; count: number }) {
  const nav = useNavigate()
  const { due, newLeft, learnedToday, started, allStarted } = useHifzToday()
  const markTask = useStore((s) => s.markTask)
  const [warn, setWarn] = useState(false)
  const nothingLeft = due.length === 0 && newLeft === 0
  useEffect(() => { if (nothingLeft && started) markTask('memo', true) }, [nothingLeft, started, markTask])

  const more = () => (learnedToday >= MAX_NEW ? setWarn(true) : nav('/hifz/learn?n=1', { replace: true }))
  return (
    <div className="nml-body nml-done">
      <div className="hz-done-ic"><Icon id="check" /></div>
      <b>{count === 0 ? (mode === 'review' ? 'Сегодня повторять нечего' : 'Все хадисы подборки уже начаты') : mode === 'learn'
        ? `${count === 1 ? 'Хадис выучен' : `Выучено ${count} ${plural(count, 'хадис', 'хадиса', 'хадисов')}`} — машаАллах!`
        : `Повторено ${count} ${plural(count, 'хадис', 'хадиса', 'хадисов')}`}</b>
      <span>{mode === 'learn' && count ? 'Первый повтор — завтра. Приложение само напомнит в блоке «Сегодня».' : nothingLeft ? 'На сегодня всё. Следующие повторы появятся сами.' : ''}</span>
      {due.length > 0 && <button className="bigbtn" onClick={() => nav('/hifz/review', { replace: true })}><Icon id="repeat" />Повторить · {due.length}</button>}
      {due.length === 0 && newLeft > 0 && <button className="bigbtn" onClick={() => nav('/hifz/learn', { replace: true })}><Icon id="plus" />Выучить {inDaysFree(newLeft)}</button>}
      {nothingLeft && !allStarted && <button className="hz-again" onClick={more}><Icon id="plus" />Выучить ещё один</button>}
      <button className="hz-skip" onClick={() => nav(-1)}>Готово</button>
      {warn && <WarnSheet onOk={() => nav('/hifz/learn?n=1', { replace: true })} onClose={() => setWarn(false)} />}
    </div>
  )
}

/** «Часть 2 из 3» с точками */
function PartLabel({ part: [k, n] }: { part: [number, number] }) {
  return <span className="hz-part">{Array.from({ length: n }, (_, i) => <i key={i} className={i + 1 === k ? 'on' : ''} />)}Часть {k} из {n}</span>
}

const inDaysFree = (n: number) => (n > 1 ? `${n} ${plural(n, 'новый', 'новых', 'новых')}` : 'новый хадис')
