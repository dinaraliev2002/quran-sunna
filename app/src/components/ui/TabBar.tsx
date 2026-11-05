import { NavLink } from 'react-router-dom'
import { Icon } from '../Icon'

export function TabBar() {
  const tabs = [
    { to: '/', icon: 'home', end: true },
    { to: '/quran', icon: 'book' },
    { to: '/azkar', icon: 'hands' },
    { to: '/hadith', icon: 'scroll' },
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
