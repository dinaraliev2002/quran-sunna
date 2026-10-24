import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Tour } from '../../components/Tour'
import { plural, Sheet, SheetHead } from '../../components/ui'
import { baseOf, bodyWords, dayNum, inDays, LEARNED_STAGE, loadHifzSet, MAX_NEW, partsOf, SETS, type HifzCard, type HifzItem } from '../../lib/hifz'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { HadithBody, StageDots, useHifzToday, WarnSheet } from './parts'
import { SplitControl } from './SplitEditor'

// Раздел «Заучивание»: что на сегодня (повтор по всем наборам и новые по плану), выбор набора, план, список хадисов
export default function Hifz() {
  const nav = useNavigate()
  const st = useStore()
  const { due, newLeft, learnedToday, started, learned, total, set, anyStarted, allStarted } = useHifzToday()
  const [items, setItems] = useState<HifzItem[] | null>(null)
  useEffect(() => { setItems(null); loadHifzSet(set.id, st.myHifz).then(setItems).catch(() => setItems([])) }, [set.id, st.myHifz])
  const [warn, setWarn] = useState<null | (() => void)>(null)
  const [open, setOpen] = useState<HifzItem | null>(null)

  /** учить ещё: сверх плана; больше 5 за день — сначала предупреждение */
  const learnMore = () => {
    const go = () => nav('/hifz/learn?n=1')
    if (learnedToday >= MAX_NEW) setWarn(() => go)
    else go()
  }
  const setPlan = (n: number) => {
    haptic.tick()
    if (n > MAX_NEW && st.hzPerDay <= MAX_NEW) setWarn(() => () => st.set({ hzPerDay: n }))
    else st.set({ hzPerDay: Math.max(1, Math.min(20, n)) })
  }
  const allDone = due.length === 0 && newLeft === 0
  const emptyMy = set.id === 'my' && total === 0

  return (
    <div className="screen hz">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Заучивание</b><span>Хадисы</span></div>
        <span className="icon-btn ghost"><Icon id="brain" /></span>
      </div>

      {/* ===== сегодня ===== */}
      <section className="hz-hero">
        <div className="hz-hero-ar">{set.ar}</div>
        <span className="hz-hero-l">Сегодня</span>
        {allDone ? (
          <>
            <b className="hz-hero-t">{anyStarted ? 'На сегодня всё — машаАллах!' : emptyMy ? 'Добавьте хадисы в свой набор' : 'Начните с первого хадиса'}</b>
            <p>{anyStarted ? (!allStarted ? 'Повторения сделаны, новые по плану выучены. Хадисы сами вернутся на повтор.' : 'Все хадисы набора уже в повторении. Выберите другой набор, чтобы учить новые.') : ''}</p>
          </>
        ) : (
          <>
            <b className="hz-hero-t">
              {[due.length ? `${due.length} на повтор` : '', newLeft ? `${newLeft} ${plural(newLeft, 'новый', 'новых', 'новых')}` : ''].filter(Boolean).join(' · ')}
            </b>
            <p>{due.length ? 'Сначала повторите выученное, потом — новое.' : 'Прочитайте хадис, затем расскажите его по памяти.'}</p>
          </>
        )}
        <div className="hz-hero-btns">
          {due.length > 0 && <button className="gold" onClick={() => nav('/hifz/review')}><Icon id="repeat" />Повторить · {due.length}</button>}
          {newLeft > 0 && <button className={due.length ? '' : 'gold'} onClick={() => nav('/hifz/learn')}><Icon id="plus" />{due.length ? 'Новый' : `Выучить ${newLeft > 1 ? newLeft + ' ' + plural(newLeft, 'хадис', 'хадиса', 'хадисов') : 'хадис'}`}</button>}
          {allDone && anyStarted && !allStarted && <button onClick={learnMore}><Icon id="plus" />Выучить ещё один</button>}
        </div>
        {!emptyMy && (
          <div className="hz-hero-stat">
            <span><b>{learned}</b> выучено</span>
            <span><b>{started - learned}</b> в повторении</span>
            <span><b>{total - started}</b> впереди</span>
          </div>
        )}
      </section>

      {/* ===== набор ===== */}
      <div className="group-t">Что учить</div>
      <div className="hz-sets">
        {SETS.map((s) => (
          <button key={s.id} className={s.id === set.id ? 'on' : ''} onClick={() => { haptic.tick(); st.set({ hzSet: s.id }) }}>
            <span className="hz-sets-ar">{s.ar}</span>
            <b>{s.short}</b>
            <small>{s.id === 'my' ? (st.myHifz.length ? `${st.myHifz.length} ${plural(st.myHifz.length, 'хадис', 'хадиса', 'хадисов')}` : 'Свои хадисы') : `${s.size} ${plural(s.size!, 'хадис', 'хадиса', 'хадисов')}`}</small>
          </button>
        ))}
      </div>
      <p className="hz-how">Новые хадисы берутся из выбранного набора, а на повтор приходят выученные из всех наборов.</p>

      {/* ===== план ===== */}
      <div className="group-t">План</div>
      <div className="group">
        <div className="sitem">
          <span className="si" style={{ background: 'var(--emerald)' }}><Icon id="star" /></span>
          <span className="t">Новых хадисов в день<small className="hz-sub">Можно выучить и больше — кнопкой «ещё»</small></span>
          <span className="hz-step">
            <button onClick={() => setPlan(st.hzPerDay - 1)} disabled={st.hzPerDay <= 1} aria-label="Меньше"><Icon id="minus" /></button>
            <b>{st.hzPerDay}</b>
            <button onClick={() => setPlan(st.hzPerDay + 1)} disabled={st.hzPerDay >= 20} aria-label="Больше"><Icon id="plus" /></button>
          </span>
        </div>
        <button className="sitem" onClick={() => st.set({ hzDrills: !st.hzDrills })}>
          <span className="si" style={{ background: '#C98A2B' }}><Icon id="words" /></span>
          <span className="t">Упражнения при заучивании<small className="hz-sub">Пропуски слов, первые буквы, сборка из кусочков</small></span>
          <span className={'switch' + (st.hzDrills ? ' on' : '')} />
        </button>
        <button className="sitem" onClick={() => st.set({ hzAr: !st.hzAr })}>
          <span className="si" style={{ background: '#3E7CB1' }}><Icon id="font" /></span>
          <span className="t">Арабский текст</span>
          <span className={'switch' + (st.hzAr ? ' on' : '')} />
        </button>
      </div>
      <p className="hz-how">
        Как это работает: прочитайте и послушайте хадис, потом по подсказке «Расскажи хадис о…» перескажите его по памяти и откройте текст, чтобы проверить себя.
        Выученный хадис будет периодически возвращаться на повтор: чем лучше вы его помните, тем реже он будет появляться.
      </p>

      <div className="hz-soon">
        <span className="hz-soon-ic"><Icon id="mic" /></span>
        <div className="t"><b>Сдача голосом с проверкой ИИ</b><span>Рассказываете хадис — приложение показывает, что сказано верно, а что пропущено. Скоро.</span></div>
      </div>

      {/* ===== хадисы набора ===== */}
      <div className="section-h"><h2>{set.name}</h2>{!emptyMy && <span className="hz-count">{started} из {total}</span>}</div>
      {emptyMy ? (
        <div className="hz-empty">
          <Icon id="brain" />
          <b>Соберите свой набор</b>
          <p>Откройте любой хадис в сборниках или темах и нажмите на значок <Icon id="brain" className="icon inl" /> — хадис появится здесь.</p>
          <button className="bigbtn" onClick={() => nav('/hadith')}><Icon id="scroll" />Открыть хадисы</button>
        </div>
      ) : !items ? <div className="loading">Загрузка…</div> : items.map((it, k) => {
        const { c, status } = rowStatus(it.key, st.hifz, partsOf(st.hzSplit[it.key]))
        const left = c ? c.d - dayNum() : 0
        return (
          <button key={it.key} className={'hz-row' + (c && left <= 0 ? ' due' : '')} onClick={() => setOpen(it)}>
            <div className="num-badge"><span>{set.id === 'nawawi' ? it.id : k + 1}</span></div>
            <div className="t"><b>{set.id === 'nawawi' ? it.t : it.q.replace(/^о /, 'О ').replace(/^об /, 'Об ')}</b><span>{status}</span></div>
            <StageDots s={c?.s ?? 0} started={!!c} />
          </button>
        )
      })}
      <div style={{ height: 24 }} />

      {open && <ItemSheet item={open} onClose={() => setOpen(null)} />}
      {warn && <WarnSheet onOk={warn} onClose={() => setWarn(null)} />}
      <Tour id="hifz" ready={!!items} steps={[
        { el: '.hz-hero', title: 'Сегодня', text: 'Сколько хадисов ждёт повторения и сколько новых по плану. Сначала повторите выученное, потом учите новое.' },
        { title: 'Как проходит заучивание', text: 'Прочитайте хадис, потом расскажите его по памяти и честно оцените себя: «Плохо», «Средне» или «Хорошо». Чем увереннее помните, тем позже хадис вернётся на повтор — через 1, 3, 7, 14, 30, а потом 60 дней. «Плохо» — повтор уже завтра.' },
        { el: '.hz-sets', title: 'Что учить', text: '40 хадисов ан-Навави, главное из «Рияд ас-Салихин» или свой набор — хадисы, которые вы добавили значком мозга.' },
        { el: '.hz-step', title: 'План', text: 'Сколько новых хадисов учить в день. Можно выучить и больше — кнопкой «ещё».' },
      ]} />
    </div>
  )
}

/** Состояние хадиса в списке; у разбитого на части — по самой «срочной» части */
function rowStatus(key: string, hifz: Record<string, HifzCard>, parts: number) {
  const own = Object.entries(hifz).filter(([k]) => baseOf(k) === key).map(([, c]) => c)
  if (!own.length) return { c: undefined, status: parts > 1 ? `Не начат · ${parts} части` : 'Не начат' }
  const c = { s: Math.min(...own.map((x) => x.s)), d: Math.min(...own.map((x) => x.d)) }
  const left = c.d - dayNum()
  const pre = parts > 1 ? `${own.length} из ${parts} частей · ` : ''
  const all = own.length >= parts && c.s >= LEARNED_STAGE
  return { c, status: pre + (left <= 0 ? 'повтор сегодня' : all ? `выучен · повтор ${inDays(left)}` : `повтор ${inDays(left)}`).replace(/^./, (x) => (pre ? x : x.toUpperCase())) }
}

/** Хадис из списка: текст, состояние и действия */
function ItemSheet({ item, onClose }: { item: HifzItem; onClose: () => void }) {
  const nav = useNavigate()
  const hifz = useStore((s) => s.hifz)
  const parts = partsOf(useStore((s) => s.hzSplit[item.key]))
  const { c: card, status } = rowStatus(item.key, hifz, parts)
  const fresh = parts > Object.keys(hifz).filter((k) => baseOf(k) === item.key).length
  const reset = useStore((s) => s.hifzReset)
  const showAr = useStore((s) => s.hzAr)
  const my = useStore((s) => s.myHifz.find((m) => 'u' + m.id === item.key))
  const editMy = useStore((s) => s.myHifzEdit)
  const removeMy = useStore((s) => s.myHifzRemove)
  const [confirm, setConfirm] = useState(false)
  const [q, setQ] = useState(item.q)
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title={item.src} sub={status} onClose={onClose} />
      <div className="body">
        {my ? (
          <div className="hz-add-in">
            <span>Расскажи хадис</span>
            <textarea rows={2} value={q} maxLength={90} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() && editMy(my.id, q)} />
          </div>
        ) : <p className="hz-q-s">Расскажи хадис <b>{item.q}</b></p>}
        <HadithBody item={item} ar={showAr} />
      </div>
      <div className="hz-sheet-btns">
        {(parts > 1 || bodyWords(item) >= 15) && (
          <div className="hz-split in-sheet">
            <span>Учить</span>
            <SplitControl item={item} />
          </div>
        )}
        {fresh && <button className="bigbtn" onClick={() => nav(`/hifz/learn?key=${item.key}`)}><Icon id="plus" />{card ? 'Учить следующую часть' : 'Учить этот хадис'}</button>}
        {card && <button className={fresh ? 'hz-again' : 'bigbtn'} onClick={() => nav(`/hifz/review?key=${item.key}`)}><Icon id="repeat" />Повторить сейчас</button>}
        {card && (confirm
          ? <button className="hz-warn-go danger" onClick={() => { reset(item.key); setConfirm(false) }}>Точно? Прогресс по хадису удалится</button>
          : <button className="hz-warn-go" onClick={() => setConfirm(true)}>Начать заново</button>)}
        {my && <button className="hz-warn-go danger" onClick={() => { removeMy(my.r); onClose() }}>Убрать из моего набора</button>}
      </div>
    </Sheet>
  )
}
