import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { useQuranMeta } from '../../hooks/useQuranMeta'
import { hasAsbab, loadAsbabIndex, loadAsbabSurah, loadKulievSurah, type KulievSurah, type AsbabIndex, type AsbabOpinion, type AsbabPart, type AsbabStory } from '../../lib/data'
import { haptic } from '../../lib/telegram'
import { useKulievIndex } from './Kuliev'
import { KvNote } from './KvFormat'

// оглавление историй — одно на всё приложение; пока не загрузилось (или файлов нет) — null
let ixReady: AsbabIndex | null = null
/** Оглавление историй для значков у аятов */
export function useAsbabIndex() {
  const [ix, setIx] = useState(ixReady)
  // оглавление могло загрузиться между отрисовкой и этим эффектом — тогда просто берём его
  useEffect(() => { if (ixReady) setIx(ixReady); else loadAsbabIndex().then((x) => { if (x) ixReady = x; setIx(x) }) }, [])
  return ix
}

/** «История аята» в окне аята: причины ниспослания из книг асбаб ан-нузуль. Нет историй — блока нет.
 *  Ставить с key={аят}, чтобы при листании аятов раскрытые истории сворачивались. */
export function AsbabBlock({ surah, ayah }: { surah: number; ayah: number }) {
  const [ix, setIx] = useState<AsbabIndex | null>(null)
  const [stories, setStories] = useState<AsbabStory[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { loadAsbabIndex().then(setIx) }, [])
  const has = hasAsbab(ix, surah, ayah)
  useEffect(() => { if (has) loadAsbabSurah(surah).then(setStories) }, [has, surah])

  // истории обо всей суре — не здесь, а у заголовка суры («История суры»)
  const list = stories?.filter((x) => !x.whole && x.from <= ayah && ayah <= x.to) ?? []
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

/** Кнопка «История суры» у заголовка суры: где, когда и по какому поводу ниспослана сура целиком.
 *  compact — значок без подписи для строки заголовка в печатном мусхафе. Нет историй — кнопки нет. */
export function SurahStoryButton({ sid, name, compact }: { sid: number; name?: string; compact?: boolean }) {
  const ix = useAsbabIndex()
  const kix = useKulievIndex()
  const [open, setOpen] = useState(false)
  const n = ix?.w?.[sid] ?? 0
  // «О суре»: вступление Кулиева и/или записи книг о суре целиком
  if (!n && !kix?.s[sid]?.intro) return null
  return (
    <>
      <button className={'s-story' + (compact ? ' compact' : '')} aria-label="О суре"
        onClick={(e) => { e.stopPropagation(); haptic.tap(); setOpen(true) }}>
        <Icon id="scroll" />{!compact && <>О суре</>}
      </button>
      {/* окно — поверх всего экрана; нажатия в нём не доходят до читалки (не прячут панели) */}
      {open && createPortal(
        <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <SurahStorySheet sid={sid} name={name} onClose={() => setOpen(false)} />
        </div>,
        document.body,
      )}
    </>
  )
}

function SurahStorySheet({ sid, name, onClose }: { sid: number; name?: string; onClose: () => void }) {
  const ix = useAsbabIndex()
  const meta = useQuranMeta() // название суры, если его не передали (строка заголовка в мусхафе)
  const [stories, setStories] = useState<AsbabStory[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [kv, setKv] = useState<KulievSurah | null>(null)
  useEffect(() => { loadAsbabSurah(sid).then(setStories) }, [sid])
  useEffect(() => { loadKulievSurah(sid).then(setKv) }, [sid])
  const list = stories?.filter((x) => x.whole) ?? []
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="О суре" sub={name ?? meta?.surahs[sid - 1]?.name ?? ''} onClose={onClose} />
      <div className="body">
        {(!stories || !ix) && !(kv && kv.intro.length > 0) && <div className="loading" style={{ height: 56 }}>Загрузка…</div>}
        {kv && kv.intro.length > 0 && (
          <>
            <div className="as-label">Вступление</div>
            <div className="kv">
              <KvNote paras={kv.intro} />
              <div className="kv-src">Комментарии к переводу смыслов Корана, Э. Кулиев (издание Комплекса короля Фахда).</div>
            </div>
          </>
        )}
        {ix && list.length > 0 && <div className="as-label">Где и когда ниспослана</div>}
        {ix && list.length > 0 && (
          <div className="asb-list">
            {list.map((x) => (
              <Story key={x.id} x={x} ix={ix} open={open === x.id || list.length === 1}
                onToggle={() => { haptic.tap(); setOpen(open === x.id ? null : x.id) }} single={list.length === 1} />
            ))}
          </div>
        )}
        {list.length > 0 && <div className="tafsir-hint asb-ai">Истории переведены с арабского с помощью ИИ, а не человеком — в переводе возможны неточности</div>}
      </div>
    </Sheet>
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

/** Пояснение там, где упомянут ас-Суюти: его книгу мы не переводим — его называют как источник авторы переведённых книг */
function SuyutiNote() {
  const [on, setOn] = useState(false)
  return (
    <div className="asb-suy">
      <button className="asb-chain" onClick={() => { haptic.tap(); setOn(!on) }}>
        {on ? 'Скрыть пояснение' : 'Почему здесь упоминается ас-Суюти?'}
      </button>
      {on && (
        <>
          <p>Книги ас-Суюти мы не переводим. Его имя встречается здесь только как ссылка на источник.</p>
          <p>
            Ас-Суюти собрал в своём сборнике «ад-Дурр аль-мансур» множество преданий из книг, многие из которых до нас не дошли.
            Часто он приводит предание без цепочки передатчиков и лишь называет, у кого оно было.
          </p>
          <p>
            Учёные, чьи книги переведены в приложении, проверяют каждое предание по первоисточникам. Если предание удалось найти
            только у ас-Суюти, они честно указывают это: «привёл ас-Суюти в „ад-Дурр аль-мансур“».
          </p>
          <p>
            Такая пометка — предупреждение, а не рекомендация: цепочку передатчиков проверить нельзя, поэтому опираться
            на такое предание нельзя.
          </p>
        </>
      )}
    </div>
  )
}

export function Story({ x, ix, open, single, onToggle }: {
  x: AsbabStory; ix: AsbabIndex; open: boolean; single: boolean; onToggle: () => void
}) {
  const [chains, setChains] = useState(false)
  const [book, setBook] = useState<string | null>(null)
  const all = [x.main, ...x.opinions]
  const story = x.main.parts.filter((p) => STORY.includes(p.k))
  const range = x.whole ? 'вся сура' : x.from === x.to ? `аят ${x.from}` : `аяты ${x.from}–${x.to}`
  const hasChains = all.some((o) => o.parts.some((p) => p.k === 'isnad'))
  const suyuti = all.some((o) => [o.title, o.verdict ?? '', ...o.parts.map((p) => p.t)].some((t) => t.includes('Суюти')))
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
          {suyuti && <SuyutiNote />}
          <div className="asb-src">
            {all.map((o) => `${ix.books[o.book]?.short}, с. ${o.page ?? '—'}`).join(' · ')} · {range}
          </div>
        </div>
      )}
    </div>
  )
}
