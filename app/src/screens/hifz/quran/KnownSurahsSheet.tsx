import { useMemo, useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Sheet, SheetHead } from '../../../components/ui'
import { JUZ30 } from '../../../lib/hifzQuran'
import { haptic } from '../../../lib/telegram'
import type { Surah } from '../../../types/quran'

/** Выбор сур, которые человек уже знает наизусть (анкета и раздел «Заучивание») */
export function KnownSurahsSheet({ surahs, initial, onSave, onClose }: { surahs: Surah[]; initial: number[]; onSave: (ids: number[]) => void; onClose: () => void }) {
  const [sel, setSel] = useState(() => new Set(initial))
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/[-\s‘’']/g, '')
    return t ? surahs.filter((s) => String(s.id) === t || s.name.toLowerCase().replace(/[-\s‘’']/g, '').includes(t)) : surahs
  }, [q, surahs])
  const toggle = (id: number) => { haptic.tick(); setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  const add = (ids: number[]) => { haptic.tap(); setSel((p) => new Set([...p, ...ids])) }
  return (
    <Sheet tall onClose={onClose}>
      <SheetHead title="Какие суры вы знаете?" sub="Отметьте те, что помните наизусть" onClose={onClose} />
      <div className="ks-pills">
        <button onClick={() => add(JUZ30)}>Весь 30-й джуз</button>
        <button onClick={() => add(surahs.filter((s) => s.id >= 103).map((s) => s.id))}>Короткие (103–114)</button>
        <button onClick={() => { haptic.tap(); setSel(new Set()) }}>Снять всё</button>
      </div>
      <div className="search" style={{ margin: '0 0 8px' }}>
        <Icon id="search" />
        <input placeholder="Название или номер суры" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="body ks-list">
        {list.map((s) => (
          <button key={s.id} className={'ks-row' + (sel.has(s.id) ? ' on' : '')} onClick={() => toggle(s.id)} role="checkbox" aria-checked={sel.has(s.id)}>
            <div className="num-badge"><span>{s.id}</span></div>
            <span className="t"><b>{s.name}</b><small>{s.ayahs} аятов</small></span>
            <span className="ks-box">{sel.has(s.id) && <Icon id="check" />}</span>
          </button>
        ))}
        {list.length === 0 && <div className="empty">Ничего не найдено</div>}
      </div>
      <button className="bigbtn" onClick={() => onSave([...sel].sort((a, b) => a - b))}>Готово · выбрано {sel.size}</button>
    </Sheet>
  )
}
