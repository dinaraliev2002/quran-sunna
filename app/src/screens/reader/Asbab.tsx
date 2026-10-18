import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { hasAsbab, loadAsbabIndex, loadAsbabSurah, type AsbabIndex, type AsbabOpinion, type AsbabPart, type AsbabStory } from '../../lib/data'
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
          <Story key={x.id} x={x} ix={ix} open={open === x.id || list.length === 1}
            onToggle={() => { haptic.tap(); setOpen(open === x.id ? null : x.id) }} single={list.length === 1} />
        ))}
      </div>
      <div className="tafsir-hint asb-ai">Истории переведены с арабского с помощью ИИ, а не человеком — в переводе возможны неточности</div>
    </>
  )
}

// предание показываем в теле карточки, разбор автора — в «Что говорят книги»
const STORY: AsbabPart['k'][] = ['src', 'isnad', 'text']
const doubtful = (o: AsbabOpinion) => o.sabab === 'no' || o.sabab === 'other' || o.sabab === 'weak'

function Parts({ parts, chains }: { parts: AsbabPart[]; chains: boolean }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.k === 'isnad') return chains ? <p key={i} className="asb-isnad">{p.t}</p> : null
        return p.t.split('\n').map((line, j) => <p key={`${i}.${j}`} className={'asb-' + p.k}>{line}</p>)
      })}
    </>
  )
}

/** Разбор другой книги: сначала итог и разбор, а её версия предания (часто та же, что выше) — по кнопке */
function OtherBook({ parts, chains }: { parts: AsbabPart[]; chains: boolean }) {
  const [texts, setTexts] = useState(false)
  const story = parts.filter((p) => STORY.includes(p.k))
  return (
    <>
      <Parts parts={parts.filter((p) => p.k === 'result')} chains={chains} />
      <Parts parts={parts.filter((p) => p.k === 'note' || p.k === 'foot')} chains={chains} />
      {story.length > 0 && (
        <button className="asb-chain" onClick={() => setTexts(!texts)}>
          {texts ? 'Скрыть предания в этой книге' : 'Предания в этой книге'}
        </button>
      )}
      {texts && <Parts parts={story} chains={chains} />}
    </>
  )
}

function Story({ x, ix, open, single, onToggle }: {
  x: AsbabStory; ix: AsbabIndex; open: boolean; single: boolean; onToggle: () => void
}) {
  const [chains, setChains] = useState(false)
  const [book, setBook] = useState<string | null>(null)
  const all = [x.main, ...x.opinions]
  const story = x.main.parts.filter((p) => STORY.includes(p.k))
  const range = x.from === x.to ? `аят ${x.from}` : `аяты ${x.from}–${x.to}`
  const hasChains = all.some((o) => o.parts.some((p) => p.k === 'isnad'))
  return (
    <div className={'asb' + (open ? ' open' : '')}>
      <button className="asb-head" onClick={single ? undefined : onToggle} disabled={single}>
        <Icon id="scroll" />
        <div className="t">
          <b>{x.main.title}</b>
          {all.map((o) => o.verdict && (
            <span key={o.id} className={doubtful(o) ? 'warn' : ''}>
              {all.length > 1 ? `${ix.books[o.book]?.short}: ` : ''}{o.verdict}
            </span>
          ))}
        </div>
        {!single && <Icon id={open ? 'up' : 'right'} />}
      </button>
      {open && (
        <div className="asb-body">
          <Parts parts={story} chains={chains} />
          {hasChains && (
            <button className="asb-chain" onClick={() => setChains(!chains)}>
              {chains ? 'Скрыть цепочки передатчиков' : 'Показать цепочки передатчиков'}
            </button>
          )}
          <div className="asb-books">
            <div className="asb-books-h">Что говорят книги</div>
            {all.map((o) => {
              const b = ix.books[o.book]
              // у главной книги предание уже показано выше — здесь только её разбор
              const parts = o === x.main ? o.parts.filter((p) => !STORY.includes(p.k)) : o.parts
              const on = book === o.id
              return (
                <div key={o.id} className={'asb-book' + (on ? ' on' : '')}>
                  <button onClick={() => { haptic.tap(); setBook(on ? null : o.id) }}>
                    <div className="t"><b>{b?.author}</b><span className={doubtful(o) ? 'warn' : ''}>{o.verdict}</span></div>
                    {parts.length > 0 && <Icon id={on ? 'up' : 'right'} />}
                  </button>
                  {on && parts.length > 0 && (
                    <div className="asb-book-body">
                      {o === x.main ? <Parts parts={parts} chains={chains} /> : <OtherBook parts={parts} chains={chains} />}
                      <div className="asb-src">«{b?.title}»{o.page ? `, с. ${o.page}` : ''}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="asb-src">
            {all.map((o) => `${ix.books[o.book]?.short}, с. ${o.page ?? '—'}`).join(' · ')} · {range}
          </div>
        </div>
      )}
    </div>
  )
}
