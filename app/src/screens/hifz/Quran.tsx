import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Tour } from '../../components/Tour'
import { plural } from '../../lib/plural'
import { useQuranMeta } from '../../hooks/useQuranMeta'
import { type Surah } from '../../types/quran'
import { dayNum, inDays } from '../../lib/hifz'
import { linesOf, MAX_AYAHS, myEntry, orderedSets, parseQKey, qSet, surahProgress } from '../../lib/hifzQuran'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { HifzTabs, StageDots } from './parts'
import { GearSheet } from './session/GearSheet'
import { useQhToday, useNextPassage } from '../../hooks/useQuranHifz'
import { setSize, drillText, rowText } from './quran/text'
import { Goal } from './quran/Goal'
import { GoalSheet } from './quran/GoalSheet'
import { TuneSets } from './quran/TuneSets'
import { MySetSheet } from './quran/MySetSheet'
import { PickSheet } from './quran/PickSheet'
import { SurahSheet } from './quran/SurahSheet'

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
  const [myEdit, setMyEdit] = useState(false)
  const [myAdd, setMyAdd] = useState(false)
  const [tune, setTune] = useState(false)
  const [open, setOpen] = useState<Surah | null>(null)
  const name = (s: number) => surahs?.[s - 1]?.name ?? ''

  const setPlan = (n: number) => { haptic.tick(); st.set({ qhPerDay: Math.max(1, Math.min(30, n)) }) }
  const learned = Object.entries(st.qhifz).reduce((a, [k, c]) => { const m = k.match(/:(\d+)-(\d+)$/)!; return a + (c.s >= 4 ? +m[2] - +m[1] + 1 : 0) }, 0)
  const inWork = Object.keys(st.qhifz).reduce((a, k) => { const m = k.match(/:(\d+)-(\d+)$/)!; return a + +m[2] - +m[1] + 1 }, 0)
  // суры: сначала начатые и выбранная, потом остальные из 30-го джуза
  const mine = [...new Set([...(st.qhPos ? [st.qhPos.s] : []), ...Object.keys(st.qhifz).map((k) => +k.split(':')[0])])]
  const set = qSet(st.qhSet, st.qhMy)
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
      <div className="hz-sets qh-sets">
        {[qSet('my', st.qhMy), ...orderedSets(st.qhOrder, st.qhHide)].map((q) => {
          const mine = q.id === 'my'
          return (
            <button key={q.id} className={!bySurah && st.qhSet === q.id ? 'on' : ''} onClick={() => {
              haptic.tick()
              const sel = !bySurah && st.qhSet === q.id
              if (!sel) st.set({ qhSet: q.id, qhPos: null })
              if (mine && (sel || !st.qhMy.length)) setMyEdit(true) // «Мой набор»: повторное нажатие или пустой набор — правка
            }}>
              <span className="hz-sets-ar">{q.ar}</span>
              <b>{q.short}</b>
              <small>{surahs ? (mine && !st.qhMy.length ? 'пока пусто' : setSize(q, surahs)) : ' '}</small>
            </button>
          )
        })}
        <button className={bySurah ? 'on' : ''} onClick={() => { haptic.tick(); setPick(true) }}>
          <span className="hz-sets-ar">سورة</span>
          <b>{bySurah ? name(st.qhPos!.s) : 'Другая сура'}</b>
          <small>{bySurah ? 'выбрана' : 'любая из 114'}</small>
        </button>
        <button onClick={() => { haptic.tick(); setTune(true) }}>
          <span className="hz-sets-ar">إعدادات</span>
          <b>Настроить наборы</b>
          <small>убрать, вернуть, порядок</small>
        </button>
      </div>
      <p className="hz-how">
        {next ? `Дальше: ${name(next.s)}, ${next.a === next.b ? `аят ${next.a}` : `аяты ${next.a}–${next.b}`}. ` : set.id === 'my' && !st.qhMy.length ? 'Соберите свой набор: добавьте суры или аяты. ' : 'Всё выбранное уже в заучивании — выберите другое. '}
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
      <Tour id="hifz-quran" ready={!!surahs} steps={[
        { el: '.hz-hero', title: 'Сегодня', text: 'Сколько отрывков ждёт повторения и сколько новых аятов по плану. Сначала повторите выученное, потом учите новое.' },
        { title: 'Как проходит заучивание', text: 'Послушайте отрывок, прочитайте его, затем читайте с частично скрытыми словами и в конце — по памяти: виден только перевод. Оцените себя: «Плохо», «Средне» или «Хорошо» — от этого зависит, когда отрывок вернётся на повтор.' },
        { el: '.qh-sets', title: 'Что учить', text: 'Листайте карточки вбок: подборки, «Мой набор» (свои суры и аяты) или любая сура. Последняя карточка — «Настроить наборы»: убрать ненужные и поменять порядок.' },
        { el: '.hz-step', title: 'План', text: 'Сколько новых аятов в день. Рядом написано, сколько это строк мусхафа. Цель («выучить за месяц») посчитает норму сама.' },
      ]} />
      {tune && <TuneSets onClose={() => setTune(false)} onMy={() => { setTune(false); setMyEdit(true) }} />}
      {myEdit && surahs && <MySetSheet surahs={surahs} onClose={() => setMyEdit(false)} onAdd={() => setMyAdd(true)} />}
      {myAdd && surahs && <PickSheet surahs={surahs} title="Добавить суру в набор" onClose={() => setMyAdd(false)} onPick={(n) => { const e = myEntry(n); if (!st.qhMy.includes(e)) st.set({ qhMy: [...st.qhMy, e] }) }} />}
      {gear && <GearSheet onClose={() => setGear(false)} />}
      {goal && surahs && <GoalSheet surahs={surahs} onClose={() => setGoal(false)} />}
      {open && <SurahSheet sr={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

