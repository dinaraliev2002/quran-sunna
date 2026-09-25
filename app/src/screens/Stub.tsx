import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { TabBar } from '../components/ui'

// Разделы, которые ещё в работе
export default function Stub({ title, icon, text }: { title: string; icon: string; text: string }) {
  const nav = useNavigate()
  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{title}</b></div>
        <span style={{ width: 44 }} />
      </div>
      <div className="stub">
        <Icon id={icon} />
        <b>{title}</b>
        <p>{text}</p>
      </div>
      <TabBar />
    </div>
  )
}
