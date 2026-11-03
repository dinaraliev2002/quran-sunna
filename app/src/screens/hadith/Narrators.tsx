import { createContext, useContext, useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { plural } from '../../lib/plural'
import { haptic } from '../../lib/telegram'
import { splitTerms, TERMS } from './terms'
import { AUTHOR, BOOK, gradeRu, loadNarrators, loadRich, shortTr, TABAQA, TABAQA_SHORT, tone } from '../../lib/narrators'
import { useNarratorLink } from '../../hooks/useNarratorLink'
import type { Narrator, Rich, RichNarrator } from '../../types/narrators'

// Цепочка передатчиков хадиса и карточка передатчика (пробная версия, только аль-Бухари).
// Данные: hadith-kg (Emad Jumaah, CC BY 4.0) — сведения о передатчиках и высказывания критиков, на арабском.

const TermCtx = createContext<(id: string) => void>(() => {})

/** Текст, в котором слова вида {{id|слово}} открывают пояснение */
function Rt({ text }: { text: string }) {
  const open = useContext(TermCtx)
  return (
    <>
      {splitTerms(text).map((p, k) => 'id' in p
        ? <button key={k} className="nr-term" onClick={() => { haptic.tap(); open(p.id) }}>{p.text}</button>
        : <span key={k}>{p.text}</span>)}
    </>
  )
}

function TermSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const [cur, setCur] = useState(id)
  const [all, setAll] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => { setCur(id); setAll(false) }, [id])
  // нажатие мимо окна закрывает его; нажатие на другой термин открывает его вместо текущего (окна не копятся)
  useEffect(() => {
    const onTap = (e: Event) => {
      const el = e.target as HTMLElement
      if (box.current?.closest('.sheet')?.contains(el) || el.closest('.nr-term, .nr-tag')) return
      closeRef.current()
    }
    document.addEventListener('click', onTap, true)
    return () => document.removeEventListener('click', onTap, true)
  }, [])
  // на затемнении под пальцем может оказаться термин карточки — откроем его
  const onDim = (e: MouseEvent) => {
    const under = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest<HTMLElement>('.nr-term, .nr-tag')).find(Boolean)
    if (under) under.click()
  }
  const t = TERMS[cur]
  if (!t) return null
  return (
    <Sheet onClose={onClose} onDim={onDim}>
      <SheetHead title={t.t} sub={t.ar} onClose={onClose} />
      <div className="body nr" ref={box}>
        {t.text.map((p, k) => <p key={k} className="nr-tp">{p}</p>)}
        {t.more?.map((m, k) => <div key={k} className="nr-tm"><b>{m.h}</b><p>{m.p}</p></div>)}
        <button className="nr-all" onClick={() => setAll(!all)}>{all ? 'Скрыть список терминов' : 'Все термины'}</button>
        {all && Object.entries(TERMS).map(([k, v]) => (
          <button key={k} className={'nr-trow' + (k === cur ? ' on' : '')} onClick={() => { setCur(k); setAll(false); haptic.tap() }}>
            <b>{v.t}</b>{v.ar && <span dir="rtl">{v.ar}</span>}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** Кнопка в ряду значков хадиса: цепочка передатчиков (Бухари, Муслим) или сподвижник (остальные сборники) */
export function ChainButton({ cid, bn, i, label }: { cid: string; bn: number; i: number; label: string }) {
  const link = useNarratorLink(cid, bn, i)
  const [open, setOpen] = useState<'chain' | 'sahabi' | null>(null)
  const [term, setTerm] = useState<string | null>(null)
  if (!link) return null
  return (
    <>
      {(link.chain || link.sahabi) && (
        <button className="nr-chip" onClick={() => { haptic.tap(); setOpen(link.chain ? 'chain' : 'sahabi') }} aria-label={link.chain ? 'Цепочка передатчиков' : 'Сподвижник'}>
          <Icon id="users" /><span>{link.chain ? 'Цепочка' : 'Сподвижник'}</span>
        </button>
      )}
      {createPortal(
        <>
          <TermCtx.Provider value={setTerm}>
            {open === 'chain' && link.chain && <ChainSheet chain={link.chain} src={link.src} cid={cid} bn={bn} i={i} label={label} onClose={() => setOpen(null)} />}
            {open === 'sahabi' && link.sahabi && <SahabiSheet id={link.sahabi.id} sure={link.sahabi.sure} cid={cid} onClose={() => setOpen(null)} />}
          </TermCtx.Provider>
          {term && <TermSheet id={term} onClose={() => setTerm(null)} />}
        </>,
        document.body,
      )}
    </>
  )
}

/** Пометка под текстом, если цепочки для хадиса нет (только Бухари и Муслим) */
export function ChainNote({ cid, bn, i }: { cid: string; bn: number; i: number }) {
  const link = useNarratorLink(cid, bn, i)
  return link === null && (cid === 'bukhari' || cid === 'muslim') ? <p className="nr-none">Цепочка передатчиков для этого хадиса не указана.</p> : null
}

function SahabiSheet({ id, sure, cid, onClose }: { id: number; sure: boolean; cid: string; onClose: () => void }) {
  const [nr, setNr] = useState<Narrator | null>(null)
  useEffect(() => { loadNarrators([id]).then((d) => setNr(d[id] ?? null)) }, [id])
  if (!nr) return <Sheet onClose={onClose}><SheetHead title="Сподвижник" onClose={onClose} /><div className="body"><div className="loading">Загрузка…</div></div></Sheet>
  const why = `${cid === 'nawawi' ? 'Ан-Навави' : 'В «Рияд ас-Салихин» ан-Навави'} приводит хадис без цепочки, называя только сподвижника, от которого он дошёл, и того, кто его записал. Полная цепочка этого хадиса в первоисточнике не найдена, поэтому здесь — только сподвижник.`
  return <CardSheet nr={nr} note={why + (sure ? '' : ' Сподвижник определён по имени в тексте хадиса; в редких случаях возможна ошибка.')} onClose={onClose} />
}

function TagBtn({ id, text, ok }: { id: string; text: string; ok?: boolean }) {
  const open = useContext(TermCtx)
  return <button className={'nr-tag' + (ok ? ' ok' : '')} onClick={() => { haptic.tap(); open(id) }}>{text}<Icon id="info" /></button>
}

/** Короткие факты о цепочке — считаются по данным передатчиков */
function chainFacts(chain: number[], data: Record<string, Narrator>): string[] {
  const list = chain.map((id) => data[id]).filter(Boolean)
  if (list.length < 2) return []
  const nm = (nr: Narrator) => nr.rn || nr.k || nr.n
  const first = list[0], last = list[list.length - 1]
  const out = [`В цепочке ${list.length} ${plural(list.length, 'передатчик', 'передатчика', 'передатчиков')}: хадис записал ${nm(first)}, а ближе всех к Пророку ﷺ стоит ${nm(last)}${last.t === 1 ? ' — сподвижник' : ''}${last.d ? ` (умер в ${last.d} г. х.)` : ''}.`]
  const ok = list.filter((nr) => /ثقة|ثبت|حافظ|صحابي|إمام|متقن|حجة|عدل/.test(nr.r ?? '')).length
  out.push(ok === list.length ? `Все ${list.length} ${plural(list.length, 'передатчик', 'передатчика', 'передатчиков')} учёные называют надёжными.` : `Надёжными учёные называют ${ok} из ${list.length}; у остальных оценка мягче («правдивый» и т. п.) — её видно в карточке передатчика.`)
  return out
}

/** Сворачиваемое пояснение (как «Почему здесь упоминается ас-Суюти?» в историях аятов) */
function WhyNote({ q, children }: { q: string; children: string }) {
  const [on, setOn] = useState(false)
  return (
    <div className="nr-why">
      <button onClick={() => { haptic.tap(); setOn(!on) }}><Icon id="info" />{on ? 'Скрыть пояснение' : q}</button>
      {on && <p>{children}</p>}
    </div>
  )
}

function ChainSheet({ chain, src, cid, bn, i, label, onClose }: { chain: number[]; src?: [string, string]; cid: string; bn: number; i: number; label: string; onClose: () => void }) {
  const from = src ? src[0] : cid
  const sahih = from === 'bukhari' || from === 'muslim'
  const [data, setData] = useState<Record<string, Narrator> | null>(null)
  const [rich, setRich] = useState<Rich | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { loadNarrators(chain).then(setData).catch(() => setFailed(true)); loadRich(cid, bn, i).then(setRich) }, [cid, bn, i])
  const facts = data ? chainFacts(chain, data) : []
  if (sel !== null && data?.[sel]) return <CardSheet nr={data[sel]} rich={rich?.narrators[sel]} onBack={() => setSel(null)} onClose={onClose} />
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Цепочка передатчиков" sub={`От ${AUTHOR[from] ?? 'составителя'} до Пророка ﷺ`} onClose={onClose} />
      <div className="body nr">
        {!data && !failed && <div className="loading">Загрузка…</div>}
        {failed && <div className="empty">Не удалось загрузить. Проверьте интернет</div>}
        {rich ? (
          <div className="nr-hd">
            <b>{rich.hadith.title}</b>
            <small>{rich.hadith.source}</small>
            <div className="nr-tags">
              <TagBtn id="marfu" text={rich.hadith.type} />
              <TagBtn id="grades" text={rich.hadith.grade} ok />
            </div>
            {rich.hadith.facts.map((f, k) => <p key={k}><Rt text={f} /></p>)}
          </div>
        ) : src ? (
          <div className="nr-hd">
            <b>{label}</b>
            <small>Источник цепочки: {BOOK[src[0]] ?? src[0]}, № {src[1]}</small>
            {sahih && <div className="nr-tags"><TagBtn id="grades" text="Достоверный (сахих)" ok /></div>}
            {facts.map((f, k) => <p key={k}>{f}</p>)}
            {!sahih && <p>Оценка хадиса — в примечании под его текстом.</p>}
            {(cid === 'nawawi' || cid === 'riyad') && (
              <WhyNote q={`Почему у ${cid === 'nawawi' ? 'ан-Навави' : 'хадиса из «Рияда»'} есть цепочка?`}>
                {`${cid === 'nawawi' ? 'Ан-Навави' : 'В «Рияд ас-Салихин» ан-Навави'} приводит хадис без цепочки, называя только сподвижника и того, кто его записал. Полная цепочка взята из первоисточника: сподвижник — последний в списке, ближе всех к Пророку ﷺ.`}
              </WhyNote>
            )}
          </div>
        ) : (
          <div className="nr-hd">
            <b>{label}</b>
            <div className="nr-tags"><TagBtn id="grades" text="Достоверный (сахих)" ok /></div>
            <p>Хадисы этого сборника составитель отбирал по условию достоверности.</p>
            {facts.map((f, k) => <p key={k}>{f}</p>)}
          </div>
        )}
        {data && chain.map((id, k) => {
          const nr = data[id]
          const isAuthor = k === 0
          const rn = rich?.narrators[id]
          if (nr && nr.n.includes('تعليق')) return (
            <div key={k} className="nr-row gap">
              <span className="nr-n">{k + 1}</span>
              <span className="t">
                <b className="nr-ru">Звено не названо составителем</b>
                <span className="nr-meta"><Rt text="Здесь аль-Бухари приводит сообщение без полной цепочки — такое называют {{muallaq|муаллак}}." /></span>
              </span>
            </div>
          )
          return (
            <button key={k} className="nr-row" onClick={() => nr && (haptic.tap(), setSel(id))} disabled={!nr}>
              <span className="nr-n">{k + 1}</span>
              <span className="t">
                {rn ? <span className="nr-ru">{rn.ru}</span> : nr?.rn && <span className="nr-ru">{nr.rn}</span>}
                <b dir="rtl" className="nr-ar">{nr?.k || nr?.n || `№ ${id}`}</b>
                {rn && <span className="nr-meta">{rn.role}</span>}
                <span className="nr-meta">
                  {rn ? `${rn.tab}-е поколение` : isAuthor ? 'Составитель сборника' : nr?.t ? TABAQA_SHORT[nr.t] : ''}
                  {!isAuthor && nr?.d ? ` · ум. ${nr.d} г. х.` : ''}
                </span>
                {nr?.r && <span className={'nr-pill ' + tone(nr.r)}>{gradeRu(nr.r) || shortTr(nr.tr) || nr.r}</span>}
              </span>
              {nr && <Icon id="right" className="icon chev-s" />}
            </button>
          )
        })}
        {data && <div className="nr-row end"><span className="nr-n">ﷺ</span><span className="t"><b>Пророк Мухаммад ﷺ</b></span></div>}
        <p className="nr-src">Данные о передатчиках — проект «الجامع» (Hadith Knowledge Graph, Emad Jumaah, CC BY 4.0) и «Такриб ат-Тахзиб» Ибн Хаджара.</p>
      </div>
    </Sheet>
  )
}

function CardSheet({ nr, rich, note, onBack, onClose }: { nr: Narrator; rich?: RichNarrator; note?: string; onBack?: () => void; onClose: () => void }) {
  const tab = rich?.tab ?? nr.t
  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Передатчик" sub={tab ? `${tab}-е поколение` : undefined} onClose={onClose} />
      <div className="body nr">
        {onBack && <button className="nr-back" onClick={onBack}><Icon id="back" />К цепочке</button>}
        {note && <div className="nr-flag">{note}</div>}
        <div className="nr-card">
          <div className="nr-name" dir="rtl">{nr.k || nr.n}</div>
          {rich ? (
            <>
              <div className="nr-rutitle">{rich.ru}</div>
              <div className="nr-full">{[rich.kunya, rich.nisba].filter(Boolean).join(' · ')}</div>
            </>
          ) : (
            <>
              {nr.rn && <div className="nr-rutitle">{nr.rn}</div>}
              {nr.k && nr.k !== nr.n && <div className="nr-full" dir="rtl">{nr.n}</div>}
            </>
          )}
          {nr.r && (
            <div className="nr-grade">
              <span className={'nr-pill ' + tone(nr.r)}>{gradeRu(nr.r) || shortTr(nr.tr) || 'Оценка'}</span>
              <span dir="rtl" className="nr-ar2">{nr.r}</span>
            </div>
          )}
          {rich?.role && <p className="nr-role">{rich.role}</p>}
        </div>

        {rich ? (
          <>
            <div className="as-label">Оценка Ибн Хаджара</div>
            <div className="nr-quote" dir="rtl">{rich.taq_ar}</div>
            <p className="nr-tab">По книге <Rt text="{{taqrib|«Такриб ат-Тахзиб»}}" /> и другим трудам Ибн Хаджара</p>
            <p className="nr-tr"><Rt text={rich.taq_ru} /></p>
            {tab && <p className="nr-tab"><Rt text={`{{tabaqa|${tab}-е поколение}}: ${TABAQA[tab]}.`} /></p>}

            <div className="as-label">Жизнь</div>
            <dl className="nr-dl">
              <dt>Родился</dt><dd>{rich.born}</dd>
              <dt>Умер</dt><dd>{rich.died}</dd>
              {rich.lived && <><dt>Жил</dt><dd>{rich.lived}</dd></>}
              {rich.post && <><dt>Должность</dt><dd>{rich.post}</dd></>}
            </dl>
            {rich.flags?.map((f, k) => <div key={k} className="nr-flag"><Rt text={f} /></div>)}

            <div className="as-label">Что говорили о нём учёные</div>
            {rich.quotes.map((q, k) => (
              <div key={k} className={'nr-q ' + q.kind}>
                <div className="nr-qh"><b>{q.who}</b><small>{q.era}</small></div>
                <div className="nr-qa" dir="rtl">{q.ar}</div>
                <p><Rt text={q.ru} /></p>
              </div>
            ))}
            <p className="nr-src">Русский перевод выполнен с помощью ИИ и требует проверки. Сведения и высказывания — «الجامع» (Hadith Knowledge Graph, CC BY 4.0) и «Такриб ат-Тахзиб» Ибн Хаджара.</p>
          </>
        ) : (
          <>
            <dl className="nr-dl">
              {nr.t && <><dt>Поколение</dt><dd>{nr.t}-е: {TABAQA[nr.t]}</dd></>}
              {nr.d && <><dt>Год смерти</dt><dd>{nr.d} г. хиджры</dd></>}
              {nr.tz && <><dt>Отметка</dt><dd>Упоминается тадлис (сокрытие в цепочке)</dd></>}
              {nr.ik && <><dt>Отметка</dt><dd>Упоминается ихтилят (расстройство памяти)</dd></>}
            </dl>
            {nr.tq && (
              <>
                <div className="as-label">Оценка Ибн Хаджара</div>
                <div className="nr-quote" dir="rtl">{nr.tq}</div>
                <p className="nr-tab">По книге <Rt text="{{taqrib|«Такриб ат-Тахзиб»}}" /> и другим трудам Ибн Хаджара</p>
                {nr.tr ? <p className="nr-tr"><Rt text={nr.tr} /></p> : <p className="nr-todo">Перевод — скоро</p>}
              </>
            )}
            {nr.c && nr.c.length > 0 && (
              <>
                <div className="as-label">Что говорили о нём учёные</div>
                {nr.c.map(([who, yr, ar, ru, kind], k) => (
                  <div key={k} className={'nr-q ' + kind}>
                    <div className="nr-qh"><b>{who}</b>{yr > 0 && <small>ум. {yr} г. х.</small>}</div>
                    <div className="nr-qa" dir="rtl">{ar}</div>
                    {ru ? <p><Rt text={ru} /></p> : <p className="nr-todo">Перевод — скоро</p>}
                  </div>
                ))}
                {(nr.nq ?? 0) > nr.c.length ? <p className="nr-src">Показаны {nr.c.length} из {nr.nq} высказываний, имеющихся в источнике.</p> : null}
              </>
            )}
            <p className="nr-src">Источник — «الجامع» (Hadith Knowledge Graph), CC BY 4.0, и «Такриб ат-Тахзиб». Поколение взято из «Такриба», а где его найти не удалось, — из базы (возможны расхождения на одно поколение).</p>
          </>
        )}
      </div>
    </Sheet>
  )
}
