import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import { ReciterList } from '../../../components/ReciterList'
import { RECITERS } from '../../../store/player'
import { useStore } from '../../../store/settings'
import type { Translation } from '../../../types/settings'
import { TRANSLATIONS } from './translations'

/** Настройки чтения — окном поверх текста, без перехода на другой экран */
export function ReaderSettingsSheet({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const [open, setOpen] = useState<null | 'tr' | 'rec'>(null)
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={open === 'tr' ? 'Перевод смыслов' : open === 'rec' ? 'Чтец' : 'Настройки чтения'} onClose={open ? () => setOpen(null) : onClose} />
      <div className="body">
        {open === 'tr' && (Object.keys(TRANSLATIONS) as Translation[]).map((k) => (
          <button key={k} className="opt-row" onClick={() => { st.set({ translation: k }); setOpen(null) }}>
            <span>{TRANSLATIONS[k]}</span>{st.translation === k && <Icon id="check" />}
          </button>
        ))}
        {open === 'rec' && <ReciterList onDone={() => setOpen(null)} />}
        {!open && (
          <>
            <button className="srow2" onClick={() => setOpen('tr')}><div>Перевод<span>{TRANSLATIONS[st.translation]}</span></div><Icon id="right" className="icon" /></button>
            <button className="srow2" onClick={() => setOpen('rec')}><div>Чтец<span>{(RECITERS[st.reciter] ?? RECITERS.alafasy).name}</span></div><Icon id="right" className="icon" /></button>
            <button className="srow2" onClick={() => st.set({ tajweed: !st.tajweed })}><div>Цветной таджвид<span>Как в печатном мусхафе с таджвидом</span></div><span className={'switch' + (st.tajweed ? ' on' : '')} /></button>
            {/* в «Мусхафе» размер текста подстраивается под страницу сам — эти настройки там ни на что не влияют */}
            {st.mode !== 'mushaf' && <>
            <div className="fld" style={{ marginTop: 6 }}><label>Размер арабского текста</label>
              <div className="stepper"><small>{st.arSize}</small><button onClick={() => st.set({ arSize: Math.max(20, st.arSize - 2) })}>−</button><button onClick={() => st.set({ arSize: Math.min(44, st.arSize + 2) })}>+</button></div>
            </div>
            <div className="fld"><label>Размер перевода</label>
              <div className="stepper"><small>{st.trSize}</small><button onClick={() => st.set({ trSize: Math.max(12, st.trSize - 1) })}>−</button><button onClick={() => st.set({ trSize: Math.min(24, st.trSize + 1) })}>+</button></div>
            </div>
            </>}
          </>
        )}
      </div>
    </Sheet>
  )
}
