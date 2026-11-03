import { Sheet, SheetHead } from '../../../components/ui'
import { plural } from '../../../lib/plural'
import { surahGlyph } from '../../../lib/data'
import { type Surah } from '../../../types/quran'
import { haptic } from '../../../lib/telegram'
import { useStore } from '../../../store/settings'

/** Выбор, откуда учить: 30-й джуз с конца или любая сура */
export function PickSheet({ surahs, onClose, onPick, title }: { surahs: Surah[]; onClose: () => void; onPick?: (s: number) => void; title?: string }) {
  const set = useStore((s) => s.set)
  const choose = (pos: { s: number; a: number } | null) => { haptic.tick(); if (onPick && pos) onPick(pos.s); else set({ qhPos: pos }); onClose() }
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title={title ?? 'Выберите суру'} sub={onPick ? 'Сура добавится целиком' : 'Новые аяты будут браться отсюда, с первого аята'} onClose={onClose} />
      <div className="body qh-pick">
        {surahs.map((s) => (
          <button key={s.id} className="srow" onClick={() => choose({ s: s.id, a: 1 })}>
            <div className="num-badge"><span>{s.id}</span></div>
            <div className="t"><b>{s.name}</b><span>{s.meaning} · {s.ayahs} {plural(s.ayahs, 'аят', 'аята', 'аятов')}</span></div>
            <div className="r"><span className="sname">{surahGlyph(s.id)}</span></div>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
