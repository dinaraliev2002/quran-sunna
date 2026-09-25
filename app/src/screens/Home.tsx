import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { TabBar, useQuranMeta } from '../components/ui'
import { useStore } from '../store/settings'
import { tgUser } from '../lib/telegram'

function hijriToday() {
  try {
    const parts = new Intl.DateTimeFormat('ru-RU-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(new Date())
    const get = (t: string) => parts.find((p) => p.type === t)?.value
    return `${get('day')} ${get('month')} ${get('year')} г. х.`
  } catch {
    return ''
  }
}

export default function Home() {
  const nav = useNavigate()
  const meta = useQuranMeta()
  const { lastRead, streak } = useStore()
  const user = tgUser()
  const last = lastRead && meta ? meta.surahs[lastRead.s - 1] : null

  return (
    <div className="screen">
      <div className="hello">
        <button className="avatar" onClick={() => nav('/profile')} aria-label="Профиль">
          {user?.photo_url ? <img src={user.photo_url} alt="" /> : (user?.first_name?.[0] ?? 'А')}
        </button>
        <div className="who">
          <b>Ас-саляму алейкум{user?.first_name ? `, ${user.first_name}` : ''}</b>
          <span>{hijriToday()}</span>
        </div>
        <div className="streak" title="Дней подряд с чтением"><Icon id="flame" />{streak}</div>
        <button className="icon-btn" onClick={() => nav('/notifications')} aria-label="Уведомления"><Icon id="bell" /></button>
      </div>

      <div className="bento">
        <button className="tile quran" onClick={() => nav('/quran')}>
          <svg className="ornament" viewBox="0 0 24 24"><use href="#i-ornament" /></svg>
          <div className="ib"><Icon id="book" /></div>
          <div className="label">Читать и слушать</div>
          <div className="big">Коран</div>
          <div className="cont" onClick={(e) => { if (last && lastRead) { e.stopPropagation(); nav(`/read/${lastRead.s}?a=${lastRead.a}`) } }}>
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

      <div className="section-h"><h2>Аят дня</h2></div>
      <div className="ayah-day">
        <div className="ar">قُلْ هُوَ ٱللَّهُ أَحَدٌ</div>
        <p>Скажи: «Он — Аллах Единый».</p>
        <div className="ref">Аль-Ихлас, 112:1</div>
      </div>
      <TabBar />
    </div>
  )
}
