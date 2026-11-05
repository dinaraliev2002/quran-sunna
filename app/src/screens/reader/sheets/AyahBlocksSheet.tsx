import { Sheet, SheetHead } from '../../../components/ui'
import { WORD_PARSE } from '../../../store/wordSheet'
import { useStore } from '../../../store/settings'
import type { AyahBlocks } from '../../../types/settings'

const ROWS: { k: keyof AyahBlocks; t: string; sub: string; only?: boolean }[] = [
  { k: 'topics', t: 'Темы аята', sub: 'О чём аят: пост, терпение, прощение…', only: true },
  { k: 'concepts', t: 'О ком и о чём в аяте', sub: 'Пророки, места, животные, растения', only: true },
  { k: 'story', t: 'История аята', sub: 'Повод ниспослания, если известен' },
  { k: 'kuliev', t: 'Комментарий', sub: 'Пояснения Э. Кулиева к аяту' },
]

/** Шестерёнка в окне аята: что показывать под текстом. Перевод и тафсир ас-Саади показываются всегда. */
export function AyahBlocksSheet({ onClose }: { onClose: () => void }) {
  const blocks = useStore((s) => s.ayahBlocks)
  const set = useStore((s) => s.set)
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Что показывать в окне аята" sub="Перевод и тафсир — всегда" onClose={onClose} />
      <div className="group" style={{ marginBottom: 8 }}>
        {ROWS.filter((r) => !r.only || WORD_PARSE).map((r) => (
          <button key={r.k} className="srow2" onClick={() => set({ ayahBlocks: { ...blocks, [r.k]: !blocks[r.k] } })}>
            <div>{r.t}<span>{r.sub}</span></div>
            <span className={'switch' + (blocks[r.k] ? ' on' : '')} />
          </button>
        ))}
      </div>
    </Sheet>
  )
}
