import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { buildPlan, perDay } from '../lib/plan'
import { haptic } from '../lib/telegram'
import { useStore } from '../store/settings'

/** Настройки → Личный план: ваши шаги по очереди и кнопка «Пройти опрос заново» */
export default function Plan() {
  const nav = useNavigate()
  const st = useStore()
  const plan = st.plan ? buildPlan(st.plan) : []
  const n = st.plan ? perDay(st.plan.minutes) : 0
  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Личный план</b></div>
        <span style={{ width: 44 }} />
      </div>
      {!st.plan && <div className="empty">План ещё не составлен. Пройдите короткий опрос.</div>}
      {st.plan && <p className="hint" style={{ marginBottom: 14 }}>Идём по очереди. Примерно {n} {n === 1 ? 'новый аят или хадис' : 'новых аята или хадиса'} в день.</p>}
      <div className="group">
        {plan.map((p, i) => (
          <button key={i} className="sitem" onClick={() => { haptic.tap(); nav(p.to) }}>
            <span className="si" style={{ background: i === 0 ? '#D9A441' : '#13704B' }}>{i + 1}</span>
            <span className="t">{p.title}</span><span className="v">{p.sub}</span><Icon id="right" className="icon chev" />
          </button>
        ))}
      </div>
      <button className="bigbtn" style={{ marginTop: 18 }} onClick={() => { haptic.tap(); st.set({ obDone: false, obSeen: false }) }}>{st.plan ? 'Пройти опрос заново' : 'Пройти опрос'}</button>
    </div>
  )
}
