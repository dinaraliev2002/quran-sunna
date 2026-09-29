import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { plural, useQuranMeta } from '../components/ui'
import { loadSurah, type Ayah } from '../lib/data'
import { QpcText } from './reader/views'
import { haptic, tgUser } from '../lib/telegram'
import { useStore, type TaskId } from '../store/settings'

function hijriToday() {
  try {
    const parts = new Intl.DateTimeFormat('ru-RU-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(new Date())
    const get = (t: string) => parts.find((p) => p.type === t)?.value
    return `${get('day')} ${get('month')} ${get('year')} г. х.`
  } catch {
    return ''
  }
}

// Аят дня — меняется каждый день (короткие известные аяты из небольших сур)
const DAILY = ['13:28', '20:114', '29:69', '39:53', '40:60', '55:13', '65:3', '93:5', '94:5', '49:13', '25:63', '112:1', '17:24', '65:2']

function useAyahOfDay() {
  const [data, setData] = useState<{ key: string; a: Ayah } | null>(null)
  useEffect(() => {
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5)
    const key = DAILY[day % DAILY.length]
    const [s, n] = key.split(':').map(Number)
    loadSurah(s).then((ayahs) => setData({ key, a: ayahs[n - 1] }))
  }, [])
  return data
}

export default function Home() {
  const nav = useNavigate()
  const meta = useQuranMeta()
  const { lastRead, recent, streak, today, markTask, tajweed, rollDay } = useStore()
  useEffect(() => { rollDay() }, [rollDay]) // открыли главную — убедиться, что «Сегодня» за сегодня
  const user = tgUser()
  const last = lastRead && meta ? meta.surahs[lastRead.s - 1] : null
  const aod = useAyahOfDay()

  const continueReading = () => (lastRead ? nav(`/read/${lastRead.s}?a=${lastRead.a}`) : nav('/read/1'))
  const pagesToday = today.pages.length
  const tasks: { id: TaskId; title: string; sub: string; action?: () => void; actionLabel?: string }[] = [
    { id: 'read', title: 'Прочитать страницу Корана', sub: pagesToday ? `Сегодня: ${pagesToday} ${plural(pagesToday, 'страница', 'страницы', 'страниц')}` : 'Отметится само, когда почитаете', action: continueReading, actionLabel: 'Читать' },
    { id: 'morning', title: 'Утренние азкары', sub: 'После утреннего намаза' },
    { id: 'evening', title: 'Вечерние азкары', sub: 'После послеполуденного намаза' },
    { id: 'memo', title: 'Повторить выученное', sub: 'Меню чтения → «Заучивание»', action: continueReading, actionLabel: 'Начать' },
  ]
  const doneCount = tasks.filter((t) => today.done.includes(t.id)).length

  return (
    <div className="screen">
      <div className="hello">
        <button className="avatar" onClick={() => nav('/settings')} aria-label="Профиль и настройки">
          {user?.photo_url ? <img src={user.photo_url} alt="" /> : (user?.first_name?.[0] ?? 'А')}
        </button>
        <div className="who">
          <b>Ас-саляму алейкум{user?.first_name ? `, ${user.first_name}` : ''}</b>
          <span>{hijriToday()}</span>
        </div>
        <div className="streak" title="Дней подряд с чтением Корана"><Icon id="flame" />{streak}</div>
        <button className="icon-btn" onClick={() => nav('/notifications')} aria-label="Уведомления"><Icon id="bell" /></button>
      </div>

      <div className="bento">
        <button className="tile quran" onClick={() => nav('/quran')}>
          <svg className="ornament" viewBox="0 0 24 24"><use href="#i-ornament" /></svg>
          <div className="ib"><Icon id="book" /></div>
          <div className="label">Читать и слушать</div>
          <div className="big">Коран</div>
          <div className="cont" onClick={(e) => { e.stopPropagation(); continueReading() }}>
            <Icon id="play" />{last && lastRead ? `${last.name}, ${lastRead.a}` : 'Аль-Фатиха, 1'}
          </div>
        </button>
        <button className="tile hadith" onClick={() => nav('/hadith')}>
          <div className="row"><div className="ib"><Icon id="scroll" /></div><div className="num">3 сборника</div></div>
          <div className="big">Хадисы</div>
        </button>
        <button className="tile azkar" onClick={() => nav('/azkar')}>
          <div className="row"><div className="ib"><Icon id="hands" /></div></div>
          <div className="label">Крепость мусульманина</div>
          <div className="big" style={{ fontSize: 24 }}>Азкары</div>
        </button>
        <button className="tile names" onClick={() => nav('/names')}>
          <div className="row"><div className="ib"><Icon id="star" /></div></div>
          <div className="big">99 имён</div>
        </button>
      </div>

      <div className="today">
        <div className="th"><b>Сегодня</b><span>{doneCount} из {tasks.length}</span></div>
        {tasks.map((t) => {
          const done = today.done.includes(t.id)
          return (
            <div key={t.id} className={'task' + (done ? ' done' : '')}>
              <button className={'ck' + (done ? ' on' : '')} onClick={() => { haptic.tap(); markTask(t.id) }} aria-label={done ? 'Снять отметку' : 'Отметить'}>
                {done && <Icon id="check" />}
              </button>
              <div className="t"><b>{t.title}</b><span>{t.sub}</span></div>
              {t.action && !done && <button className="go" onClick={t.action}>{t.actionLabel}</button>}
            </div>
          )
        })}
      </div>

      {recent.length > 0 && meta && (
        <>
          <div className="section-h"><h2>Недавнее</h2></div>
          {recent.slice(0, 3).map((r) => {
            const s = meta.surahs[r.s - 1]
            return (
              <button key={r.s} className="list-item" onClick={() => nav(`/read/${r.s}?a=${r.a}`)}>
                <div className="ib"><Icon id="book" /></div>
                <div className="t"><b>Сура {s.name}</b><span>Аят {r.a} из {s.ayahs} · стр. {r.p}</span></div>
                <Icon id="right" className="icon" style={{ color: 'var(--text-2)', width: 18, height: 18 }} />
              </button>
            )
          })}
        </>
      )}

      <div className="section-h"><h2>Аят дня</h2></div>
      {aod && meta && (
        <button className="ayah-day" onClick={() => nav(`/read/${aod.key.split(':')[0]}?a=${aod.a.n}`)}>
          <QpcText page={aod.a.p} glyphs={aod.a.g} tajweed={tajweed} className="ar" />
          <p>{aod.a.ku}</p>
          <div className="ref">{meta.surahs[Number(aod.key.split(':')[0]) - 1].name}, {aod.key}</div>
        </button>
      )}
    </div>
  )
}
