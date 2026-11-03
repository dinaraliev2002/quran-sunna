import { memo } from 'react'
import { Icon } from '../../../components/Icon'
import { hasAsbab, hasKuliev, isSajda } from '../../../lib/data'
import type { Ayah } from '../../../types/quran'
import { useAsbabIndex } from '../Asbab'
import { useKulievIndex } from '../Kuliev'
import { QpcText } from './QpcText'
import { WbwText } from './WbwText'
import type { AyahActions, ViewOpts } from './types'

// ---------- Аят с переводом ----------
export const AyahBlock = memo(function AyahBlock({ sid, a, opts, act, playing, hidden, marked }: {
  sid: number; a: Ayah; opts: ViewOpts; act: AyahActions; playing: boolean; hidden: boolean; marked: boolean
}) {
  const key = `${sid}:${a.n}`
  const story = hasAsbab(useAsbabIndex(), sid, a.n)
  const kix = useKulievIndex()
  const comment = hasKuliev(kix, sid, a.n)
  const sajda = isSajda(kix, sid, a.n)
  return (
    <div className={'a-block' + (playing ? ' playing' : '')} data-key={key} data-page={a.p}>
      <div className="a-head">
        <span className="a-key">{key}{playing ? ' · звучит' : ''}</span>
        {/* у аята есть история ниспослания — она в окне аята */}
        {story && <button className="a-story" onClick={() => act.onInfo(sid, a.n)}><Icon id="book" />История аята</button>}
        {comment && !story && <button className="a-story" onClick={() => act.onInfo(sid, a.n)}><Icon id="scroll" />Комментарий</button>}
        {sajda && <button className="a-story sj" onClick={() => act.onInfo(sid, a.n)} aria-label="Земной поклон">۩</button>}
        <div className="a-acts">
          <button className={'a-act' + (playing ? ' playing' : '')} onClick={() => (playing ? act.onToggle() : act.onPlay(sid, a.n))}
            aria-label={playing && act.sounding ? 'Пауза' : 'Слушать'}><Icon id={playing && act.sounding ? 'pause' : 'play'} /></button>
          <button className="a-act" onClick={() => act.onInfo(sid, a.n)} aria-label="Перевод и тафсир"><Icon id="info" /></button>
          <button className={'a-act' + (marked ? ' on' : '')} onClick={() => act.onBookmark(key)} aria-label="Закладка"><Icon id="bookmark" /></button>
        </div>
      </div>
      {opts.wbw
        ? <WbwText sid={sid} a={a} tajweed={opts.tajweed} hidden={hidden} />
        : <QpcText page={a.p} glyphs={a.g} tajweed={opts.tajweed} className={'a-ar' + (hidden ? ' hidden' : '')} />}
      <div className="a-tr">{opts.translation === 'aa' ? a.aa : a.ku}</div>
    </div>
  )
})
