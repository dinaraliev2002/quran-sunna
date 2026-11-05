import { useState } from 'react'
import { Sheet, SheetHead } from '../../components/ui'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { Onboarding } from './Onboarding'

/** Показывает опросник: новым пользователям сразу, тем, кто уже пользуется, предложением (один раз) */
export function OnboardingGate() {
  const st = useStore()
  const [open, setOpen] = useState(false)
  const existing = !!st.lastRead || st.streak > 0 || Object.keys(st.hifz).length > 0 || st.bookmarks.length > 0
  if (open || (!st.obSeen && !st.obDone && !existing)) return <Onboarding onClose={() => setOpen(false)} />
  if (st.obSeen || st.obDone) return null
  return (
    <Sheet onClose={() => st.set({ obSeen: true })}>
      <SheetHead title="Личный план обучения" sub="Новое" onClose={() => st.set({ obSeen: true })} />
      <div className="body">
        <p style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 14 }}>Ответьте на несколько вопросов, и мы подскажем, с чего начать и что учить по очереди. Это займёт минуту, пропустить можно в любой момент.</p>
        <button className="bigbtn" onClick={() => { haptic.tap(); setOpen(true) }}>Настроить план</button>
        <button className="bigbtn ghost" style={{ marginTop: 8 }} onClick={() => st.set({ obSeen: true })}>Позже</button>
      </div>
    </Sheet>
  )
}
