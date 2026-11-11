import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { plural } from '../../lib/plural'
import type { GlossaryItem } from '../../types/quran'

/** Термин в словаре: закрытым — строка (термин и арабское написание), открытым — карточка с пояснением и аятами */
export function TermItem({ x, open, onToggle }: { x: GlossaryItem; open: boolean; onToggle: () => void }) {
  const nav = useNavigate()
  const [refs, setRefs] = useState(false)
  return (
    <div className={'gl-item' + (open ? ' open' : '')}>
      <button className="gl-head" onClick={onToggle} aria-expanded={open}>
        <b>{x.tr}</b>
        <span className="gl-ar">{x.ar}</span>
        <Icon id="right" className="icon chev-s" />
      </button>
      {open && (
        <div className="gl-card">
          {/* название и арабское написание — в одной строке; длинное арабское слово переносится, а не налезает на русское */}
          <div className="gl-top"><div className="gl-big" dir="rtl">{x.ar}</div><b className="gl-name">{x.tr}</b></div>
          <span className="gl-tag">ТЕРМИН</span>
          <p className="gl-mean">{x.mean}</p>
          {!!x.n && (
            <button className={'gl-chip' + (refs ? ' on' : '')} onClick={() => setRefs((v) => !v)}>
              Упоминается в Коране: {x.n} {plural(x.n, 'аят', 'аята', 'аятов')}
            </button>
          )}
          {refs && x.h && (
            <div className="wd-refs">
              {x.h.map((k) => <button key={k} onClick={() => { const [s, a] = k.split(':'); nav(`/read/${s}?a=${a}&from=link`) }}>{k}</button>)}
              {(x.n ?? 0) > x.h.length && <span className="gl-more">и ещё {(x.n ?? 0) - x.h.length}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
