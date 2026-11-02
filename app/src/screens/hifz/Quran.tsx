import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural, Sheet, SheetHead, useQuranMeta } from '../../components/ui'
import { loadSurah, surahGlyph, type Surah } from '../../lib/data'
import { dayNum, inDays } from '../../lib/hifz'
import { linesOf, MAX_AYAHS, nextStart, pagesText, parseQKey, passageFrom, QSETS, qSet, remainingWords, setProgress, surahProgress, type QSet } from '../../lib/hifzQuran'
import { haptic } from '../../lib/telegram'
import { dayStr, useStore } from '../../store/settings'
import { HifzTabs, StageDots } from './parts'
import { GearSheet } from './QuranSession'

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
  const setId = useStore((s) => s.qhSet)
  const [p, setP] = useState<{ s: number; a: number; b: number; words: number } | null>(null)
  const start = surahs ? nextStart(cards, pos, (s) => surahs[s - 1].ayahs, qSet(setId)) : null
  useEffect(() => {
    if (!start) { setP(null); return }
    let alive = true
    loadSurah(start.s).then((ay) => alive && setP(passageFrom(ay, cards, start.s, start.a, Math.max(1, n), start.end)))
    return () => { alive = false }
  }, [start?.s, start?.a, start?.end, n, cards])
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
  const [gear, setGear] = useState(false)
  const [goal, setGoal] = useState(false)
  const [open, setOpen] = useState<Surah | null>(null)
  const name = (s: number) => surahs?.[s - 1]?.name ?? ''

  const setPlan = (n: number) => { haptic.tick(); st.set({ qhPerDay: Math.max(1, Math.min(30, n)) }) }
  const learned = Object.entries(st.qhifz).reduce((a, [k, c]) => { const m = k.match(/:(\d+)-(\d+)$/)!; return a + (c.s >= 4 ? +m[2] - +m[1] + 1 : 0) }, 0)
  const inWork = Object.keys(st.qhifz).reduce((a, k) => { const m = k.match(/:(\d+)-(\d+)$/)!; return a + +m[2] - +m[1] + 1 }, 0)
  // суры: сначала начатые и выбранная, потом остальные из 30-го джуза
  const mine = [...new Set([...(st.qhPos ? [st.qhPos.s] : []), ...Object.keys(st.qhifz).map((k) => +k.split(':')[0])])]
  const set = qSet(st.qhSet)
  const inSet = [...new Set(set.ranges.map((r) => r.s))]
  const list = [...mine.filter((s) => !inSet.includes(s)).sort((a, b) => a - b), ...inSet]
  // что учим сейчас: выбранная сура (пока в ней есть невыученное) или подборка
  const bySurah = !!st.qhPos && next?.s === st.qhPos.s && !inSet.includes(st.qhPos.s)
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

      {st.qhRecent.length > 0 && surahs && (
        <>
          <div className="group-t">Недавно учили</div>
          <div className="qh-recent">
            {st.qhRecent.filter((k) => st.qhifz[k]).map((k) => {
              const p = parseQKey(k)!, c = st.qhifz[k]
              const left = c.d - dayNum()
              return (
                <button key={k} onClick={() => { haptic.tap(); nav('/hifz/quran/review?k=' + k) }}>
                  <b>{name(p.s)}</b>
                  <span>{p.a === p.b ? `аят ${p.a}` : `аяты ${p.a}–${p.b}`}</span>
                  {st.qhWeak.includes(k) ? <span className="weak">слабое место</span> : <span>{left <= 0 ? 'повтор сегодня' : `повтор ${inDays(left)}`}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
      {st.qhWeak.filter((k) => st.qhifz[k]).length > 0 && (
        <button className="qh-cur" style={{ marginTop: 8 }} onClick={() => nav('/hifz/quran/review?weak=1')}>
          <span className="si" style={{ background: '#C0563B', width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', color: '#fff' }}><Icon id="flame" /></span>
          <div className="t">
            <b>Слабые места · {st.qhWeak.filter((k) => st.qhifz[k]).length}</b>
            <span>Отрывки, где в последний раз было «Плохо» или «Средне». Повторить их ещё раз</span>
          </div>
          <Icon id="right" />
        </button>
      )}

      <div className="group-t">Что учить</div>
      <div className="hz-sets">
        {QSETS.map((q) => (
          <button key={q.id} className={!bySurah && st.qhSet === q.id ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ qhSet: q.id, qhPos: null }) }}>
            <span className="hz-sets-ar">{q.ar}</span>
            <b>{q.short}</b>
            <small>{surahs ? setSize(q, surahs) : ' '}</small>
          </button>
        ))}
        <button className={bySurah ? 'on' : ''} onClick={() => { haptic.tick(); setPick(true) }}>
          <span className="hz-sets-ar">سورة</span>
          <b>{bySurah ? name(st.qhPos!.s) : 'Другая сура'}</b>
          <small>{bySurah ? 'выбрана' : 'любая из 114'}</small>
        </button>
      </div>
      <p className="hz-how">
        {next ? `Дальше: ${name(next.s)}, ${next.a === next.b ? `аят ${next.a}` : `аяты ${next.a}–${next.b}`}. ` : 'Всё выбранное уже в заучивании — выберите другое. '}
        {!bySurah && set.why}
      </p>
      {surahs && <Goal surahs={surahs} onEdit={() => setGoal(true)} />}

      <div className="group-t">План</div>
      <div className="group">
        <div className="sitem">
          <span className="si" style={{ background: 'var(--emerald)' }}><Icon id="sunrise" /></span>
          <span className="t">Новых аятов в день<small className="hz-sub">{next ? `Сейчас это ≈ ${linesOf(next.words)} ${plural(linesOf(next.words), 'строка', 'строки', 'строк')} мусхафа` : 'Длинные аяты делятся на отрывки поменьше'}</small></span>
          <span className="hz-step">
            <button onClick={() => setPlan(plan - 1)} disabled={plan <= 1} aria-label="Меньше"><Icon id="minus" /></button>
            <b>{plan}</b>
            <button onClick={() => setPlan(plan + 1)} disabled={plan >= 30} aria-label="Больше"><Icon id="plus" /></button>
          </span>
        </div>
        {plan > MAX_AYAHS && <p className="hz-how" style={{ margin: '0 14px 10px' }}>Больше {MAX_AYAHS} аятов в день — много: повторов быстро станет слишком много. Лучше меньше, но каждый день.</p>}
        <button className="sitem" onClick={() => setGear(true)}>
          <span className="si" style={{ background: '#C98A2B' }}><Icon id="gear" /></span>
          <span className="t">Настройки урока<small className="hz-sub">{drillText(st.qhDrill)} · {st.qhWbw ? 'пословный перевод' : 'обычный перевод'} · чтец {String(st.qhRate).replace('.', ',')}×</small></span>
          <Icon id="right" />
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
      {gear && <GearSheet onClose={() => setGear(false)} />}
      {goal && surahs && <GoalSheet surahs={surahs} onClose={() => setGoal(false)} />}
      {open && <SurahSheet sr={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** Сколько аятов в подборке */
const setSize = (q: QSet, surahs: Surah[]) => {
  const n = q.ranges.reduce((a, r) => a + (r.b ? r.b - (r.a ?? 1) + 1 : surahs[r.s - 1].ayahs - (r.a ?? 1) + 1), 0)
  return `${n} ${plural(n, 'аят', 'аята', 'аятов')}`
}
const amount = (words: number, ayahs: number) => `${pagesText(words)} (${ayahs} ${plural(ayahs, 'аят', 'аята', 'аятов')})`

/** Слова по аятам для сур (грузим по мере надобности) — чтобы считать объём в страницах */
function useWordsOf(ids: number[]) {
  const [m, setM] = useState<Record<number, number[]>>({})
  const key = ids.join()
  useEffect(() => {
    let alive = true
    const need = ids.filter((s) => !m[s])
    if (need.length) Promise.all(need.map((s) => loadSurah(s).then((a) => [s, a.map((x) => x.w.length)] as const))).then((r) => alive && setM((o) => ({ ...o, ...Object.fromEntries(r) })))
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (s: number) => m[s]
}

const drillText = (d: number) => (d === 3 ? 'видно слово через два' : d === 2 ? 'видно слово через одно' : d === 23 ? 'через одно, потом через два' : 'без упражнений')

/** Что сейчас учим целиком: выбранная сура или подборка — для цели */
function useTarget(surahs: Surah[]) {
  const st = useStore()
  const count = (s: number) => surahs[s - 1].ayahs
  const t = st.qhGoal?.t ?? (st.qhPos && !qSet(st.qhSet).ranges.some((r) => r.s === st.qhPos!.s) ? 's:' + st.qhPos.s : 'set:' + st.qhSet)
  const set: QSet = t.startsWith('s:') ? { id: t, name: 'Сура ' + surahs[+t.slice(2) - 1].name, ar: '', short: '', sub: '', ranges: [{ s: +t.slice(2) }] } : qSet(t.slice(4))
  const wordsOf = useWordsOf([...new Set(set.ranges.map((r) => r.s))])
  return { t, set, ...setProgress(st.qhifz, set, count), rem: remainingWords(st.qhifz, set, wordsOf) }
}

/** Цель: выучить подборку или суру к дате → сколько аятов в день */
function Goal({ surahs, onEdit }: { surahs: Surah[]; onEdit: () => void }) {
  const g = useStore((s) => s.qhGoal)
  const plan = useStore((s) => s.qhPerDay)
  const set = useStore((s) => s.set)
  const tg = useTarget(surahs)
  if (!g) return (
    <button className="qh-cur" style={{ marginTop: 8 }} onClick={onEdit}>
      <span className="si" style={{ background: '#3E7CB1', width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', color: '#fff' }}><Icon id="compass" /></span>
      <div className="t"><b>Поставить цель</b><span>Например, выучить «{tg.set.name}» к определённой дате</span></div>
      <Icon id="right" />
    </button>
  )
  const days = Math.max(1, g.by - dayNum())
  const left = tg.total - tg.done
  const need = Math.ceil(left / days)
  const rem = tg.rem
  return (
    <div className="qh-cur qh-goal" style={{ marginTop: 8, display: 'block' }} onClick={onEdit}>
      <b>Цель: {tg.set.name}</b>
      <div className="bar"><i style={{ width: `${tg.total ? (tg.done / tg.total) * 100 : 0}%` }} /></div>
      {left === 0 ? <p>Цель достигнута — машаАллах!</p> : !rem ? <p>Считаем…</p> : (
        <>
          <p>Осталось {amount(rem.words, rem.ayahs)}</p>
          <p>{g.by < dayNum() ? 'Срок прошёл' : `${days} ${plural(days, 'день', 'дня', 'дней')} · нужно ${amount(rem.words / days, need)} в день`}</p>
        </>
      )}
      {left > 0 && g.by >= dayNum() && need !== plan && (
        <button className="hz-again" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); haptic.tap(); set({ qhPerDay: Math.min(30, need) }) }}>Поставить {Math.min(30, need)} {plural(Math.min(30, need), 'аят', 'аята', 'аятов')} в день</button>
      )}
    </div>
  )
}

function GoalSheet({ surahs, onClose }: { surahs: Surah[]; onClose: () => void }) {
  const g = useStore((s) => s.qhGoal)
  const set = useStore((s) => s.set)
  const tg = useTarget(surahs)
  const left = tg.total - tg.done
  const rem = tg.rem
  const choose = (weeks: number) => { haptic.tick(); set({ qhGoal: { t: tg.t, by: dayNum() + weeks * 7 } }); onClose() }
  const label = (w: number) => (w < 4 ? `${w} ${plural(w, 'неделя', 'недели', 'недель')}` : w === 52 ? 'Год' : w === 26 ? 'Полгода' : `${w / 4} ${plural(w / 4, 'месяц', 'месяца', 'месяцев')}`)
  const opts = rem ? [1, 2, 4, 8, 12, 26, 52].map((w) => ({ w, text: amount(rem.words / (w * 7), Math.ceil(left / (w * 7))) })).filter((o, k, all) => !k || o.text !== all[k - 1].text) : []
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Цель" sub={rem ? `${tg.set.name} · осталось ${amount(rem.words, rem.ayahs)}` : tg.set.name} onClose={onClose} />
      <div className="hz-sheet-btns">
        <p className="hz-how" style={{ margin: 0 }}>За какой срок выучить? Приложение посчитает, сколько нужно в день (объём в страницах примерный). Цель — то, что сейчас выбрано в «Что учить».</p>
        {!rem && <div className="loading">Считаем…</div>}
        {opts.map((o) => <button key={o.w} className="hz-again" onClick={() => choose(o.w)}>{label(o.w)} · {o.text} в день</button>)}
        {g && <button className="hz-warn-go" onClick={() => { set({ qhGoal: null }); onClose() }}>Убрать цель</button>}
      </div>
    </Sheet>
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
      <SheetHead title="Выберите суру" sub="Новые аяты будут браться отсюда, с первого аята" onClose={onClose} />
      <div className="body qh-pick">
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
