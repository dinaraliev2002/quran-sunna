import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { hasAsbab, loadAsbabIndex, loadAsbabSurah, type AsbabBook, type AsbabIndex, type AsbabStory } from '../../lib/data'
import { haptic } from '../../lib/telegram'

/** «История аята» в окне аята: причины ниспослания из книг асбаб ан-нузуль. Нет историй — блока нет.
 *  Ставить с key={аят}, чтобы при листании аятов раскрытые истории сворачивались. */
export function AsbabBlock({ surah, ayah }: { surah: number; ayah: number }) {
  const [ix, setIx] = useState<AsbabIndex | null>(null)
  const [stories, setStories] = useState<AsbabStory[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { loadAsbabIndex().then(setIx) }, [])
  const has = hasAsbab(ix, surah, ayah)
  useEffect(() => { if (has) loadAsbabSurah(surah).then(setStories) }, [has, surah])

  const list = stories?.filter((x) => x.from <= ayah && ayah <= x.to) ?? []
  if (!ix || !list.length) return null
  return (
    <>
      <div className="as-label">История аята{list.length > 1 ? ` · ${list.length}` : ''}</div>
      <div className="asb-list">
        {list.map((x) => (
          <Story key={x.id} x={x} book={ix.books[x.book]} open={open === x.id || list.length === 1}
            onToggle={() => { haptic.tap(); setOpen(open === x.id ? null : x.id) }} single={list.length === 1} />
        ))}
      </div>
      <div className="tafsir-hint asb-ai">Истории переведены с арабского с помощью ИИ, а не человеком — в переводе возможны неточности</div>
    </>
  )
}

function Story({ x, book, open, single, onToggle }: {
  x: AsbabStory; book: AsbabBook; open: boolean; single: boolean; onToggle: () => void
}) {
  const [chains, setChains] = useState(false)
  const range = x.from === x.to ? `аят ${x.from}` : `аяты ${x.from}–${x.to}`
  return (
    <div className={'asb' + (open ? ' open' : '')}>
      <button className="asb-head" onClick={single ? undefined : onToggle} disabled={single}>
        <Icon id="scroll" />
        <div className="t"><b>{x.title}</b>{x.verdict && <span>{x.verdict}</span>}</div>
        {!single && <Icon id={open ? 'up' : 'right'} />}
      </button>
      {open && (
        <div className="asb-body">
          {x.parts.map((p, i) => {
            if (p.k === 'isnad') return chains ? <p key={i} className="asb-isnad">{p.t}</p> : null
            return p.t.split('\n').map((line, j) => <p key={`${i}.${j}`} className={'asb-' + p.k}>{line}</p>)
          })}
          {x.parts.some((p) => p.k === 'isnad') && (
            <button className="asb-chain" onClick={() => setChains(!chains)}>
              {chains ? 'Скрыть цепочки передатчиков' : 'Показать цепочки передатчиков'}
            </button>
          )}
          <div className="asb-src">
            {book.author}, «{book.title}»{x.page ? `, с. ${x.page}` : ''} · {range}
          </div>
        </div>
      )}
    </div>
  )
}
