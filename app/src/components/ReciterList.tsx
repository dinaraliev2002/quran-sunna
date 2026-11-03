import { Icon } from './Icon'
import { bitrateOf, RECITERS, setBitrates } from '../store/player'
import { useStore } from '../store/settings'

/** Список чтецов. Если у чтеца есть несколько вариантов качества (кбит/с) — рядом с именем маленький выбор: 64 — вдвое легче, 128 — чуть чище. */
export function ReciterList({ onDone }: { onDone?: () => void }) {
  const st = useStore()
  const pick = (id: string, kbps?: number) => {
    const bitrates = kbps ? { ...st.bitrates, [id]: kbps } : st.bitrates
    setBitrates(bitrates)
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
                  <button key={k} className={st.reciter === id && cur === k ? 'on' : ''} onClick={() => pick(id, k)}>{k}</button>
                ))}
              </div>
            )}
            {st.reciter === id && <Icon id="check" />}
          </div>
        )
      })}
    </>
  )
}
