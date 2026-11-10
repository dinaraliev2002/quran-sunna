import { Sheet, SheetHead } from './ui'
import './JuzGrid.css'

// Окно выбора джуза: сетка 1–30, под номером — сура, с которой начинается джуз. Текущий джуз выделен.

export function JuzGrid({ current, names, onPick, onClose }: { current: number; /** название первой суры каждого джуза, по порядку */ names: string[]; onPick: (juz: number) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Перейти к джузу" sub="Список откроется на первой суре джуза" onClose={onClose} />
      <div className="body">
        <div className="jg">
          {names.map((n, k) => (
            <button key={k} className={'jg-cell' + (k + 1 === current ? ' on' : '')} onClick={() => onPick(k + 1)}>
              <b>{k + 1}</b>
              <span>{n}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
