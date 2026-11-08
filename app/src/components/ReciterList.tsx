import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { RECITERS } from '../store/player'
import { useStore } from '../store/settings'
import { loadReciteIndex } from '../lib/recite'
import type { ReciteIndex } from '../types/player'

/** Список чтецов. Под именем — подсвечиваются ли слова и сколько весит весь Коран (для загрузки) */
export function ReciterList({ onDone, current, onPick }: { onDone?: () => void; /** какого чтеца отметить (по умолчанию — слушаемого) */ current?: string; /** выбор не для прослушивания (например, для загрузки): слушаемый чтец не меняется */ onPick?: (id: string) => void }) {
  const st = useStore()
  const sel = current ?? st.reciter
  const [ix, setIx] = useState<ReciteIndex | null>(null)
  useEffect(() => { loadReciteIndex().then(setIx).catch(() => {}) }, [])
  const pick = (id: string) => {
    if (onPick) return onPick(id)
    st.set({ reciter: id })
    onDone?.()
  }
  return (
    <>
      {Object.entries(RECITERS).map(([id, r]) => {
        const e = ix?.[id]
        const gb = e ? (e.b.reduce((a, b) => a + b, 0) / 1e9).toFixed(1).replace('.', ',') : null
        return (
          <div key={id} className="opt-row rec-row" role="button" tabIndex={0} onClick={() => pick(id)}>
            <span>{r.name}{e && <small>{e.w ? 'подсветка аятов и слов' : e.n.length >= 114 ? 'без подсветки аятов' : 'подсветка аятов'}{onPick && gb ? ` · весь Коран ≈ ${gb} ГБ` : ''}</small>}</span>
            {sel === id && <Icon id="check" />}
          </div>
        )
      })}
    </>
  )
}
