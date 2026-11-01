import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Tour } from '../components/Tour'
import { plural } from '../components/ui'
import { dayNum, hadithProgress, SETS } from '../lib/hifz'
import { haptic, tgUser } from '../lib/telegram'
import { useStore, type Activity } from '../store/settings'
import { useHifzToday } from './hifz/parts'

const WEEKS = 18
const DAY_MS = 864e5
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
/** Номер дня → дата (полдень по местному времени, чтобы не перескочить сутки) */
const dateOf = (d: number) => { const t = new Date(d * DAY_MS); return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 12) }
const fmt = (d: number) => { const t = dateOf(d); return `${t.getDate()} ${MONTHS[t.getMonth()]}` }

const TIPS = [
  'Новый хадис сначала послушайте несколько раз, потом расскажите его вслух, не глядя в текст.',
  'Повторяйте выученное в пути, в очереди, перед сном — короткие повторы закрепляют лучше одного длинного.',
  'Рассказывайте выученный хадис близким: объясняя другому, запоминаешь крепче.',
  'Лучше один хадис каждый день, чем десять раз в неделю — постоянство важнее количества.',
  'Перед заучиванием прочитайте объяснение хадиса: понятый смысл запоминается легче.',
  'Выученные аяты читайте в намазе — так они закрепляются быстрее.',
]

// Профиль: имя и фото из Telegram, статистика, активность по дням, план заучивания, хатм
export default function Profile() {
  const nav = useNavigate()
  const st = useStore()
  const user = tgUser()
  const today = dayNum()
  const hz = useHifzToday()
  const days = Math.max(1, today - (st.since || today) + 1)

  const cards = Object.entries(st.hifz)
  const setStat = (prefix: string) => hadithProgress(st.hifz, prefix, st.hzSplit)
  const all = SETS.map((s) => setStat(s.prefix)).reduce((a, x) => ({ started: a.started + x.started, learned: a.learned + x.learned }), { started: 0, learned: 0 })
  const learnedAll = all.learned
  const cur = setStat(hz.set.prefix)
  const left = hz.total - cur.started
  const paceDays = left > 0 ? Math.ceil(left / st.hzPerDay) : 0
  const page = st.lastRead?.p ?? 0

  return (
    <div className="screen pf">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Профиль</b></div>
        <button className="icon-btn" onClick={() => nav('/settings')} aria-label="Настройки"><Icon id="gear" /></button>
      </div>

      <div className="pf-head">
        <div className="pf-ava">{user?.photo_url ? <img src={user.photo_url} alt="" /> : (user?.first_name?.[0] ?? 'А')}</div>
        <b>{user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : 'Гость'}</b>
        <span>{user?.username ? `@${user.username} · ` : ''}с нами {days} {plural(days, 'день', 'дня', 'дней')}</span>
      </div>

      <div className="pf-stats">
        <div><Icon id="flame" /><b>{st.streak}</b><span>{plural(st.streak, 'день', 'дня', 'дней')} подряд</span>{st.bestStreak > st.streak && <small>рекорд {st.bestStreak}</small>}</div>
        <div><Icon id="scroll" /><b>{learnedAll}</b><span>{plural(learnedAll, 'хадис выучен', 'хадиса выучено', 'хадисов выучено')}</span>{all.started > learnedAll && <small>{all.started - learnedAll} в повторении</small>}</div>
        <div><Icon id="book" /><b>{st.totalPages}</b><span>{plural(st.totalPages, 'страница', 'страницы', 'страниц')} прочитано</span></div>
      </div>

      <Heatmap act={st.act} today={today} />

      {/* ===== план заучивания ===== */}
      <section className="pf-card">
        <div className="pf-ch"><b>Мой план заучивания</b><button onClick={() => nav('/hifz')}>Изменить</button></div>
        <div className="pf-small">Хадисы · {hz.set.name}</div>
        <Progress2 a={cur.learned} b={cur.started} total={hz.total} />
        <div className="pf-small">
          {hz.total ? `${cur.learned} выучено · ${cur.started - cur.learned} в повторении · из ${hz.total}` : 'В наборе пока нет хадисов'}
          {paceDays > 0 && ` · в этом темпе ≈ ${pace(paceDays)}`}
        </div>
        <div className="pf-kv"><span>Новое в день</span><b>{st.hzPerDay} {plural(st.hzPerDay, 'хадис', 'хадиса', 'хадисов')}</b></div>
        <div className="pf-kv"><span>Сегодня</span><b>{hz.due.length + hz.newLeft === 0 ? 'всё сделано' : [hz.due.length ? `${hz.due.length} на повтор` : '', hz.newLeft ? `${hz.newLeft} ${plural(hz.newLeft, 'новый', 'новых', 'новых')}` : ''].filter(Boolean).join(' · ')}</b></div>
        <button className="pf-go" onClick={() => nav('/hifz')}><Icon id="brain" />Открыть заучивание<Icon id="right" /></button>
      </section>

      {cards.length > 0 && <Forecast today={today} />}

      {/* ===== наборы ===== */}
      {cards.length > 0 && (
        <section className="pf-card">
          <div className="pf-ch"><b>Хадисы по наборам</b></div>
          {SETS.map((s) => {
            const x = setStat(s.prefix)
            const total = s.size ?? st.myHifz.length
            if (!total) return null
            return (
              <div key={s.id} className="pf-set">
                <div className="pf-set-h"><span>{s.name}</span><b>{x.learned}<small> / {total}</small></b></div>
                <Progress2 a={x.learned} b={x.started} total={total} />
              </div>
            )
          })}
          <div className="pf-legend"><span><i className="a" />выучено</span><span><i className="b" />в повторении</span></div>
        </section>
      )}

      {/* ===== хатм ===== */}
      <section className="pf-card">
        <div className="pf-ch"><b>Хатм — чтение Корана целиком</b><button onClick={() => nav(st.lastRead ? `/read/${st.lastRead.s}?a=${st.lastRead.a}&hl=1` : '/read/1')}>Читать</button></div>
        <div className="pf-bar gold"><i style={{ width: `${(page / 604) * 100}%` }} /></div>
        <div className="pf-small">{page ? `Страница ${page} из 604 · ${Math.round((page / 604) * 100)}%` : 'Ещё не начато'}</div>
      </section>

      <section className="pf-card">
        <div className="pf-ch"><b>Ещё</b></div>
        <button className="pf-kv link" onClick={() => nav('/names')}><span>99 имён Аллаха</span><b>{st.learned.length} из 99<Icon id="right" /></b></button>
        <button className="pf-kv link" onClick={() => nav('/hadith')}><span>Избранные хадисы</span><b>{st.hfav.length}<Icon id="right" /></b></button>
        <button className="pf-kv link" onClick={() => nav('/quran')}><span>Закладки в Коране</span><b>{st.bookmarks.length}<Icon id="right" /></b></button>
      </section>

      <div className="pf-tip">
        <Icon id="star" />
        <div><b>Совет дня</b><p>{TIPS[today % TIPS.length]}</p></div>
      </div>
      <div style={{ height: 24 }} />
      <Tour id="profile" steps={[
        { el: '.pf-stats', title: 'Статистика', text: 'Серия дней, прочитанные страницы и выученное.' },
        { el: '.pf-card', title: 'План заучивания', text: 'Сколько учить в день и что на сегодня. «Изменить» — открыть заучивание.' },
        { el: '.topbar [aria-label="Настройки"]', title: 'Настройки', text: 'Тема, чтец и другое. Там же можно снова показать эти подсказки.' },
      ]} />
    </div>
  )
}

const pace = (d: number) => (d < 14 ? `${d} ${plural(d, 'день', 'дня', 'дней')}` : d < 60 ? `${Math.round(d / 7)} ${plural(Math.round(d / 7), 'неделя', 'недели', 'недель')}` : `${Math.round(d / 30)} ${plural(Math.round(d / 30), 'месяц', 'месяца', 'месяцев')}`)

/** Полоса из двух частей: выучено (сплошная) и в повторении (светлее) */
function Progress2({ a, b, total }: { a: number; b: number; total: number }) {
  const pa = total ? (a / total) * 100 : 0
  const pb = total ? ((b - a) / total) * 100 : 0
  return <div className="pf-bar two"><i className="a" style={{ width: `${pa}%` }} />{pb > 0 && <i className="b" style={{ width: `${pb}%` }} />}</div>
}

/** Сколько дел за день — для цвета клетки: 0 … 4 */
const level = (v?: [number, number, number]) => {
  if (!v) return 0
  const score = v[0] + v[1] * 2 + v[2]
  return score === 0 ? 0 : score <= 2 ? 1 : score <= 5 ? 2 : score <= 9 ? 3 : 4
}
function describe(v?: [number, number, number]) {
  if (!v || v[0] + v[1] + v[2] === 0) return 'занятий не было'
  return [
    v[0] ? `${v[0]} ${plural(v[0], 'страница', 'страницы', 'страниц')} Корана` : '',
    v[1] ? `${v[1]} ${plural(v[1], 'новый хадис', 'новых хадиса', 'новых хадисов')}` : '',
    v[2] ? `${v[2]} ${plural(v[2], 'повтор', 'повтора', 'повторов')}` : '',
  ].filter(Boolean).join(' · ')
}

/** Активность: клетка — день, столбец — неделя (как в GitHub); нажатие показывает, что было в этот день */
function Heatmap({ act, today }: { act: Activity; today: number }) {
  const [sel, setSel] = useState(today)
  // понедельник текущей недели
  const wd = (dateOf(today).getDay() + 6) % 7
  const first = today - wd - (WEEKS - 1) * 7
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => first + w * 7 + d))
  // подпись месяца — над неделей, где он начинается (и не ближе 3 недель к предыдущей подписи)
  let lastLabel = -9
  const labels = weeks.map((w, wi) => {
    const start = w.find((d) => dateOf(d).getDate() === 1)
    if ((start === undefined && wi > 0) || wi - lastLabel < 3) return ''
    lastLabel = wi
    return MONTHS[dateOf(start ?? w[0]).getMonth()]
  })
  const last30 = Array.from({ length: 30 }, (_, i) => act[today - i]).filter((v) => v && v[0] + v[1] + v[2] > 0).length
  return (
    <section className="pf-card">
      <div className="pf-ch"><b>Активность</b><span className="pf-sub">{last30} из 30 дней</span></div>
      <div className="pf-heat-wrap">
        <div className="pf-heat-wd">{WD.map((d, i) => <span key={d}>{i % 2 === 0 ? d : ''}</span>)}</div>
        <div className="pf-heat" role="grid" aria-label="Активность по дням">
          {weeks.map((w, wi) => {
            return (
              <div key={wi} className="pf-heat-col">
                <span className="pf-heat-m">{labels[wi]}</span>
                {w.map((d) => d > today ? <i key={d} className="future" /> : (
                  <button key={d} className={`l${level(act[d])}${d === sel ? ' sel' : ''}${d === today ? ' today' : ''}`}
                    onClick={() => { haptic.tick(); setSel(d) }} aria-label={`${fmt(d)}: ${describe(act[d])}`} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div className="pf-heat-foot">
        <span className="pf-heat-tip"><b>{sel === today ? 'Сегодня' : fmt(sel)}</b> · {describe(act[sel])}</span>
        <span className="pf-heat-scale">меньше{[0, 1, 2, 3, 4].map((l) => <i key={l} className={'l' + l} />)}больше</span>
      </div>
    </section>
  )
}

/** Повторения на 7 дней вперёд: столбик — день; нажатие показывает число */
function Forecast({ today }: { today: number }) {
  const hifz = useStore((s) => s.hifz)
  const days = Array.from({ length: 7 }, (_, i) => today + i)
  // просроченные — тоже на сегодня
  const counts = days.map((d, i) => Object.values(hifz).filter((c) => (i === 0 ? c.d <= d : c.d === d)).length)
  const max = Math.max(1, ...counts)
  const [sel, setSel] = useState(0)
  const name = (i: number) => (i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : `${WD[(dateOf(days[i]).getDay() + 6) % 7]}, ${fmt(days[i])}`)
  return (
    <section className="pf-card">
      <div className="pf-ch"><b>Повторения на неделю</b><span className="pf-sub">{counts.reduce((a, b) => a + b, 0)} всего</span></div>
      <div className="pf-fc" role="list">
        {counts.map((c, i) => (
          <button key={i} role="listitem" className={i === sel ? 'sel' : ''} onClick={() => { haptic.tick(); setSel(i) }} aria-label={`${name(i)}: ${c}`}>
            <span className="pf-fc-v">{i === sel ? c : ''}</span>
            <span className="pf-fc-bar"><i style={{ height: `${(c / max) * 100}%` }} className={c ? '' : 'zero'} /></span>
            <span className="pf-fc-d">{i === 0 ? 'сег' : WD[(dateOf(days[i]).getDay() + 6) % 7].toLowerCase()}</span>
          </button>
        ))}
      </div>
      <div className="pf-small">{name(sel)}: {counts[sel] ? `${counts[sel]} ${plural(counts[sel], 'хадис', 'хадиса', 'хадисов')} на повтор` : 'повторов нет'}</div>
    </section>
  )
}
