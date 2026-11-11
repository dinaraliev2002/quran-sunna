import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { Sheet } from '../../components/ui'
import { keepHyphen } from '../../lib/nobreak'
import type { GlossaryItem } from '../../types/quran'

/** Какой термин сейчас открыт в маленьком окошке (null — закрыто) */
export const useTermPop = create<{ item: GlossaryItem | null; open: (i: GlossaryItem) => void; close: () => void }>((set) => ({
  item: null,
  open: (item) => set({ item }),
  close: () => set({ item: null }),
}))

const SHORT = 260
/** Краткое пояснение: целиком или первое предложение, не длиннее SHORT знаков */
const brief = (s: string) => {
  if (s.length <= SHORT) return s
  const cut = s.slice(0, SHORT)
  const dot = cut.lastIndexOf('. ')
  return (dot > 80 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…')
}

/** Окошко с кратким пояснением подсвеченного термина и кнопкой «Подробнее» → словарь */
export function TermPop() {
  const item = useTermPop((s) => s.item)
  const close = useTermPop((s) => s.close)
  const nav = useNavigate()
  if (!item) return null
  return (
    <Sheet onClose={close}>
      <div className="term-pop">
        <div className="gl-big" dir="rtl">{item.ar}</div>
        <b className="gl-name">{keepHyphen(item.tr)}</b>
        <span className="gl-tag">ТЕРМИН</span>
        <p className="gl-mean">{brief(item.mean)}</p>
        <button className="wd-more" onClick={() => { close(); nav('/glossary', { state: { open: item.tr } }) }}>Подробнее в словаре</button>
      </div>
    </Sheet>
  )
}
