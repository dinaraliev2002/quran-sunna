import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { loadMeta, loadSurahs, type Surah } from '../lib/data'

export function TabBar() {
  const tabs = [
    { to: '/', icon: 'home', end: true },
    { to: '/quran', icon: 'book' },
    { to: '/azkar', icon: 'hands' },
    { to: '/settings', icon: 'more' },
  ]
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'on' : '')}>
          <Icon id={t.icon} />
        </NavLink>
      ))}
    </nav>
  )
}

export function SurahRow({ s, sort, current, onClick }: { s: Surah; sort?: 'mushaf' | 'rev'; current?: boolean; onClick: () => void }) {
  return (
    <button className={'srow' + (current ? ' cur' : '')} onClick={onClick}>
      <div className="num-badge"><span>{s.id}</span></div>
      <div className="t">
        <b>{s.name}</b>
        <span>{sort === 'rev' ? `${s.rev}-я по ниспосланию` : s.meaning} · {s.ayahs} {plural(s.ayahs, 'аят', 'аята', 'аятов')}</span>
      </div>
      <div className="r">
        <span className="an">{s.ar}</span>
        <span className={'tag ' + (s.mk ? 'mk' : 'md')}>{s.mk ? 'Мекканская' : 'Мединская'}</span>
      </div>
    </button>
  )
}

export function Sheet({ onClose, children, tall }: { onClose: () => void; children: ReactNode; tall?: boolean }) {
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className={'sheet' + (tall ? ' tall' : '')}>
        <div className="handle" />
        {children}
      </div>
    </>
  )
}

export function SheetHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="sh">
      <div><h3>{title}</h3>{sub && <span>{sub}</span>}</div>
      <button className="xbtn" onClick={onClose}><Icon id="close" /></button>
    </div>
  )
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** Список сур + таблица начала джузов (загружаются один раз) */
export function useQuranMeta() {
  const [data, setData] = useState<{ surahs: Surah[]; juzPages: number[] } | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadSurahs(), loadMeta()]).then(([surahs, meta]) => alive && setData({ surahs, juzPages: meta.juzPages }))
    return () => { alive = false }
  }, [])
  return data
}
