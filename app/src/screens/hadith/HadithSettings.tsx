import { Sheet, SheetHead } from '../../components/ui'
import { ARABIC_FONTS } from '../../lib/azkar'
import { useStore } from '../../store/settings'

/** Настройки текста хадисов: шрифт (общий с азкарами), размеры, показ арабского */
export function HadithSettings({ onClose }: { onClose: () => void }) {
  const st = useStore()
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Настройки текста" onClose={onClose} />
      <div className="body">
        <button className="srow2" onClick={() => st.set({ hdShowAr: !st.hdShowAr })}><div>Арабский текст</div><span className={'switch' + (st.hdShowAr ? ' on' : '')} /></button>
        {st.hdShowAr && (
          <>
            <div className="fld"><label>Шрифт арабского текста</label>
              <div className="az-fonts">
                {(Object.keys(ARABIC_FONTS) as (keyof typeof ARABIC_FONTS)[]).map((k) => (
                  <button key={k} className={(st.azFont ?? 'sch') === k ? 'on' : ''} onClick={() => st.set({ azFont: k })}>
                    <span style={{ fontFamily: ARABIC_FONTS[k].css }}>قَالَ النَّبِيُّ ﷺ</span>
                    <b>{ARABIC_FONTS[k].name}</b>
                  </button>
                ))}
              </div>
            </div>
            <div className="fld"><label>Размер арабского текста</label>
              <div className="stepper"><small>{st.hdArSize}</small><button onClick={() => st.set({ hdArSize: Math.max(16, st.hdArSize - 2) })}>−</button><button onClick={() => st.set({ hdArSize: Math.min(40, st.hdArSize + 2) })}>+</button></div>
            </div>
          </>
        )}
        <div className="fld"><label>Размер перевода</label>
          <div className="stepper"><small>{st.hdTrSize}</small><button onClick={() => st.set({ hdTrSize: Math.max(13, st.hdTrSize - 1) })}>−</button><button onClick={() => st.set({ hdTrSize: Math.min(26, st.hdTrSize + 1) })}>+</button></div>
        </div>
      </div>
    </Sheet>
  )
}
