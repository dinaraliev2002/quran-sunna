import { Icon } from './Icon'
import { bitrateOf, RECITERS, setBitrates } from '../store/player'
import { useStore } from '../store/settings'

/** Список чтецов. Если у чтеца есть несколько вариантов качества (кбит/с) — рядом с именем маленький выбор: 64 — вдвое легче, 128 — чуть чище. */
export function ReciterList({ onDone, current, onPick }: { onDone?: () => void; /** какого чтеца отметить (по умолчанию — слушаемого) */ current?: string; /** выбор не для прослушивания (например, для загрузки): слушаемый чтец не меняется */ onPick?: (id: string) => void }) {
  const st = useStore()
  const sel = current ?? st.reciter
  const pick = (id: string, kbps?: number) => {
    const bitrates = kbps ? { ...st.bitrates, [id]: kbps } : st.bitrates
    setBitrates(bitrates)
    if (onPick) { if (kbps) st.set({ bitrates }); onPick(id); return }
    st.set({ reciter: id, bitrates })
    if (!kbps) onDone?.()
  }
  return (
    <>
      {Object.entries(RECITERS).map(([id, r]) => {
        const opts = Object.keys(r.folders).map(Number).sort((a, b) => a - b)
        const cur = bitrateOf(id, st.bitrates)
        return (
          <div key={id} className="opt-row rec-row" role="button" tabIndex={0} onClick={() => pick(id)}>
            <span>{r.name}</span>
            {opts.length === 1 && <small className="rec-only">только {opts[0]} кбит/с</small>}
            {opts.length > 1 && (
              <div className="rec-q" onClick={(e) => e.stopPropagation()}>
                {opts.map((k) => (
                  <button key={k} className={sel === id && cur === k ? 'on' : ''} onClick={() => pick(id, k)}>{k}</button>
                ))}
              </div>
            )}
            {sel === id && <Icon id="check" />}
          </div>
        )
      })}
    </>
  )
}
