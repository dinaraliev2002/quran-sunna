import { Icon } from '../Icon'
import { surahGlyph } from '../../lib/data'
import { plural } from '../../lib/plural'
import type { Surah } from '../../types/quran'

export function SurahRow({ s, sort, current, onClick, onPlay }: { s: Surah; sort?: 'mushaf' | 'rev'; current?: boolean; onClick: () => void; onPlay?: () => void }) {
  return (
    <div className={'srow' + (current ? ' cur' : '')} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}>
      <div className="num-badge"><span>{s.id}</span></div>
      <div className="t">
        <b>{s.name}</b>
        <span>{sort === 'rev' ? `${s.rev}-я по ниспосланию` : s.meaning} · {s.ayahs} {plural(s.ayahs, 'аят', 'аята', 'аятов')}</span>
      </div>
      <div className="r">
        <span className="sname">{surahGlyph(s.id)}</span>
        <span className={'tag ' + (s.mk ? 'mk' : 'md')}>{s.mk ? 'Мекканская' : 'Мединская'}</span>
      </div>
      {onPlay && <button className="srow-play" onClick={(e) => { e.stopPropagation(); onPlay() }} aria-label={`Слушать суру ${s.name}`}><Icon id="play" /></button>}
    </div>
  )
}
