import { Icon } from '../../../components/Icon'
import type { ReadMode } from '../../../types/settings'

export const MODES: Record<ReadMode, { label: string; icon: string; desc: string }> = {
  mushaf: { label: 'Мусхаф', icon: 'open', desc: 'Печатные страницы' },
  page: { label: 'Страница', icon: 'page', desc: 'Аяты страницы, свайп вбок' },
  sura: { label: 'Сура', icon: 'rows', desc: 'Вся сура, вниз' },
}

export function ModePop({ mode, onPick }: { mode: ReadMode; onPick: (m: ReadMode) => void }) {
  return (
    <div className="pop glass">
      <h4>Режим чтения</h4>
      <div className="opts">
        {(Object.keys(MODES) as ReadMode[]).map((m) => (
          <button key={m} className={m === mode ? 'on' : ''} onClick={() => onPick(m)}>
            <span className="ic"><Icon id={MODES[m].icon} /></span>
            <b>{MODES[m].label}</b>
            <span>{MODES[m].desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
