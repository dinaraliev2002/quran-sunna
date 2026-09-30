import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { plural, useQuranMeta } from '../components/ui'
import { EVENING, loadAzkar, MORNING, nowIsMorning, type AzkarData } from '../lib/azkar'
import { loadSurah, surahGlyph, TOTAL_PAGES, type Ayah } from '../lib/data'
import { hadithOfDay, type EncHadith } from '../lib/hadith'
import { haptic, shareText, tgUser } from '../lib/telegram'
import { useStore, type TaskId } from '../store/settings'
import { useChapterProgress } from './azkar/Azkar'
import { QpcText } from './reader/views'

function hijriToday() {
  try {
    const parts = new Intl.DateTimeFormat('ru-RU-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(new Date())
    const get = (t: string) => parts.find((p) => p.type === t)?.value
    return `${get('day')} ${get('month')} ${get('year')} г. х.`
  } catch {
    return ''
  }
}
const gregToday = () => new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

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

/** Орнамент из восьмиконечных звёзд — фактура шапки и плиток */
function Pattern({ id, opacity = 0.14 }: { id: string; opacity?: number }) {
  return (
    <svg className="h-pattern" aria-hidden>
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1" opacity={opacity}>
            <rect x="16" y="16" width="24" height="24" />
            <rect x="16" y="16" width="24" height="24" transform="rotate(45 28 28)" />
            <circle cx="28" cy="28" r="5" />
            <path d="M0 28h11M45 28h11M28 0v11M28 45v11" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

function Ring({ value, total, size = 52, stroke = 5 }: { value: number; total: number; size?: number; stroke?: number }) {
  const r = size / 2 - stroke, len = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="h-ring">
      <circle cx={size / 2} cy={size / 2} r={r} className="bg" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} className="fg" strokeWidth={stroke} strokeDasharray={len}
        strokeDashoffset={len * (1 - (total ? value / total : 0))} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

const TASK_ICON: Record<TaskId, string> = { read: 'book', morning: 'sun', evening: 'moon', memo: 'repeat' }

export default function Home() {
  const nav = useNavigate()
  const meta = useQuranMeta()
  const { lastRead, recent, streak, today, markTask, tajweed, rollDay } = useStore()
  useEffect(() => { rollDay() }, [rollDay]) // открыли главную — убедиться, что «Сегодня» за сегодня
  const user = tgUser()
  const last = lastRead && meta ? meta.surahs[lastRead.s - 1] : null
  const aod = useAyahOfDay()
  const [hod, setHod] = useState<EncHadith | null>(null)
  useEffect(() => { hadithOfDay().then(setHod).catch(() => {}) }, [])

  // азкары: прогресс утренних/вечерних
  const [azkar, setAzkar] = useState<AzkarData | null>(null)
  useEffect(() => { loadAzkar().then(setAzkar).catch(() => {}) }, [])
  const azProgress = useChapterProgress(azkar)
  const azSub = (ch: number, fallback: string) => { const p = azProgress(ch); return p.done ? `Прочитано ${p.done} из ${p.total}` : fallback }
  const azNow = nowIsMorning() ? MORNING : EVENING
  const azNowP = azProgress(azNow)

  const continueReading = () => (lastRead ? nav(`/read/${lastRead.s}?a=${lastRead.a}`) : nav('/read/1'))
  const pagesToday = today.pages.length
  const tasks: { id: TaskId; title: string; sub: string; action?: () => void }[] = [
    { id: 'read', title: 'Прочитать страницу Корана', sub: pagesToday ? `Сегодня: ${pagesToday} ${plural(pagesToday, 'страница', 'страницы', 'страниц')}` : 'Отметится само, когда почитаете', action: continueReading },
    { id: 'morning', title: 'Утренние азкары', sub: azSub(MORNING, 'После утреннего намаза'), action: () => nav(`/azkar/ch/${MORNING}`) },
    { id: 'evening', title: 'Вечерние азкары', sub: azSub(EVENING, 'После послеполуденного намаза'), action: () => nav(`/azkar/ch/${EVENING}`) },
    { id: 'memo', title: 'Повторить выученное', sub: 'Меню чтения → «Заучивание»', action: continueReading },
  ]
  const doneCount = tasks.filter((t) => today.done.includes(t.id)).length

  return (
    <div className="screen home">
      {/* ===== шапка-обложка ===== */}
      <header className="h-hero">
        <Pattern id="hp" />
        <div className="h-glow" />
        <div className="h-top">
          <button className="h-avatar" onClick={() => nav('/settings')} aria-label="Профиль и настройки">
            {user?.photo_url ? <img src={user.photo_url} alt="" /> : (user?.first_name?.[0] ?? 'А')}
          </button>
          <div className="h-top-r">
            <div className="h-pill" title="Дней подряд с чтением Корана"><Icon id="flame" />{streak} {plural(streak, 'день', 'дня', 'дней')}</div>
            <button className="h-pill round" onClick={() => nav('/notifications')} aria-label="Уведомления"><Icon id="bell" /></button>
          </div>
        </div>
        <div className="h-greet">
          <div className="h-salam">السَّلَامُ عَلَيْكُمْ</div>
          {user?.first_name && <h1>{user.first_name}</h1>}
          <p><span className="h-cap">{gregToday()}</span> · {hijriToday()}</p>
        </div>
        <button className="h-continue" onClick={continueReading}>
          <div className="t">
            <span>{last ? 'Продолжить чтение' : 'Начать чтение Корана'}</span>
            <b>{last && lastRead ? `${last.name}, аят ${lastRead.a}` : 'Аль-Фатиха'}</b>
            <div className="h-bar"><i style={{ width: `${((lastRead?.p ?? 0) / TOTAL_PAGES) * 100}%` }} /></div>
            <small>Страница {lastRead?.p ?? 1} из {TOTAL_PAGES} · {Math.round(((lastRead?.p ?? 0) / TOTAL_PAGES) * 100)}% Корана</small>
          </div>
          <div className="h-play"><Icon id="play" /></div>
        </button>
      </header>

      {/* ===== разделы ===== */}
      <div className="h-bento">
        <button className="h-tile quran" onClick={() => nav('/quran')}>
          <Pattern id="tq" opacity={0.18} />
          <div className="ib"><Icon id="book" /></div>
          <div className="h-tile-b">
            <span>Читать и слушать</span>
            <b>Коран</b>
            <small>114 сур · 3 режима чтения</small>
          </div>
        </button>
        <button className="h-tile hadith" onClick={() => nav('/hadith')}>
          <div className="ib"><Icon id="scroll" /></div>
          <div className="h-tile-b"><b>Хадисы</b><small>Сборники и темы</small></div>
        </button>
        <button className="h-tile azkar" onClick={() => nav('/azkar')}>
          <Pattern id="ta" opacity={0.16} />
          <div className="h-az-ring">
            <Ring value={azNowP.done} total={azNowP.total || 1} size={62} stroke={6} />
            <span>{azNowP.total ? `${azNowP.done}/${azNowP.total}` : <Icon id="hands" />}</span>
          </div>
          <div className="h-tile-b">
            <span>{azNow === MORNING ? 'Утренние' : 'Вечерние'}</span>
            <b>Азкары</b>
            <small>Крепость мусульманина</small>
          </div>
        </button>
        <button className="h-tile names" onClick={() => nav('/names')}>
          <div className="ib"><Icon id="star" /></div>
          <div className="h-tile-b"><b>99 имён</b><small className="soon">Скоро</small></div>
        </button>
      </div>

      {/* ===== сегодня ===== */}
      <section className="h-card h-today">
        <div className="h-today-head">
          <div className="h-az-ring small">
            <Ring value={doneCount} total={tasks.length} size={48} stroke={5} />
            <span>{doneCount}/{tasks.length}</span>
          </div>
          <div className="t"><b>Сегодня</b><span>{doneCount === tasks.length ? 'Всё выполнено — машаАллах!' : 'Маленькие дела каждый день'}</span></div>
        </div>
        {tasks.map((t) => {
          const done = today.done.includes(t.id)
          return (
            <div key={t.id} className={'h-task' + (done ? ' done' : '')}>
              <span className="h-task-ic"><Icon id={TASK_ICON[t.id]} /></span>
              <button className="t" onClick={t.action}><b>{t.title}</b><span>{t.sub}</span></button>
              <button className={'h-check' + (done ? ' on' : '')} onClick={() => { haptic.tap(); markTask(t.id) }} aria-label={done ? 'Снять отметку' : 'Отметить'}>
                <Icon id="check" />
              </button>
            </div>
          )
        })}
      </section>

      {/* ===== недавнее ===== */}
      {recent.length > 0 && meta && (
        <>
          <div className="h-sec"><h2>Недавнее</h2><button onClick={() => nav('/quran')}>Все суры</button></div>
          <div className="h-recent">
            {recent.map((r) => {
              const s = meta.surahs[r.s - 1]
              return (
                <button key={r.s} className="h-rc" onClick={() => nav(`/read/${r.s}?a=${r.a}`)}>
                  <span className="h-rc-name">{surahGlyph(s.id)}</span>
                  <b>{s.name}</b>
                  <small>Аят {r.a} · стр. {r.p}</small>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ===== аят дня ===== */}
      {aod && meta && (
        <section className="h-card h-aod">
          <i className="h-corner tl" /><i className="h-corner tr" /><i className="h-corner bl" /><i className="h-corner br" />
          <div className="h-aod-label">۞ Аят дня ۞</div>
          <QpcText page={aod.a.p} glyphs={aod.a.g} tajweed={tajweed} className="h-aod-ar" />
          <p className="h-aod-tr">{aod.a.ku}</p>
          <div className="h-aod-ref">{meta.surahs[Number(aod.key.split(':')[0]) - 1].name} · {aod.key}</div>
          <div className="h-aod-act">
            <button onClick={() => nav(`/read/${aod.key.split(':')[0]}?a=${aod.a.n}`)}><Icon id="book" />Открыть</button>
            <button onClick={() => shareText(`${aod.a.ku}\n— ${meta.surahs[Number(aod.key.split(':')[0]) - 1].name}, ${aod.key}`)}><Icon id="share" />Поделиться</button>
          </div>
        </section>
      )}
      {/* ===== хадис дня ===== */}
      {hod && (
        <section className="h-card h-hod">
          <div className="h-aod-label">۞ Хадис дня ۞</div>
          {hod.in && <p className="h-hod-in">{hod.in}</p>}
          <p className="h-hod-q">{hod.in ? hod.ru.slice(hod.in.length).trim() : hod.ru}</p>
          <div className="h-aod-ref">{hod.src}{hod.grade ? ` · ${hod.grade}` : ''}</div>
          <div className="h-aod-act">
            <button onClick={() => nav(`/hadith/e/${hod.id}`)}><Icon id="info" />Объяснение</button>
            <button onClick={() => shareText(`${hod.ru}
— ${hod.src}`)}><Icon id="share" />Поделиться</button>
          </div>
        </section>
      )}
      <div className="h-foot">Коран и Сунна</div>
    </div>
  )
}
