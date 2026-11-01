import { createContext, useContext, useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { haptic } from '../../lib/telegram'
import { splitTerms, TERMS } from './terms'

// Цепочка передатчиков хадиса и карточка передатчика (пробная версия, только аль-Бухари).
// Данные: hadith-kg (Emad Jumaah, CC BY 4.0) — сведения о передатчиках и высказывания критиков, на арабском.

// высказывание учёного: [имя, год смерти (0 — нет), арабский текст, русский перевод или null, окраска, id учёного]
type Quote = [string, number, string, string | null, 'praise' | 'note' | 'crit', number]
interface Narrator {
  n: string; k?: string; rn?: string; r?: string; t?: number; ts?: 't' | 'd'; d?: number; nq?: number
  tz?: 1; ik?: 1; st?: 1; tq?: string | null; tr?: string | null; c?: Quote[]
}

interface RichQuote { who: string; era: string; kind: 'praise' | 'note' | 'crit'; ar: string; ru: string }
interface RichNarrator {
  ru: string; kunya: string; nisba: string; role: string; taq_ar: string; taq_ru: string; tab: number
  born: string; died: string; lived: string; post: string; flags?: string[]; quotes: RichQuote[]
}
interface Rich { hadith: { title: string; source: string; type: string; grade: string; facts: string[] }; narrators: Record<string, RichNarrator> }
const loadRich = (cid: string, bn: number, i: number) => fetch(`data/narrators/rich/${cid}-${bn}-${i}.json`).then((r) => (r.ok ? (r.json() as Promise<Rich>) : null)).catch(() => null)

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

const get = <T,>(url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json() as Promise<T> })
const cache = new Map<string, Promise<unknown>>()
const once = <T,>(url: string, fallback?: T) => {
  if (!cache.has(url)) cache.set(url, get<T>(url).catch((e) => { if (fallback !== undefined) return fallback; cache.delete(url); throw e }))
  return cache.get(url) as Promise<T>
}
const loadChains = (cid: string) => once<Record<string, number[]>>(`data/narrators/chains-${cid}.json`, {})
const loadSahabi = (cid: string) => once<Record<string, [number, number]>>(`data/narrators/sahabi-${cid}.json`, {})
// ан-Навави и «Рияд»: цепочка того же хадиса из первоисточника — [книга, номер, звенья]
const loadLinks = (cid: string) => once<Record<string, [string, string, number[]]>>(`data/narrators/links-${cid}.json`, {})
/** Карточки передатчиков лежат шардами по 200 номеров — грузим только нужные */
const loadNarrators = async (ids: number[]) => {
  const shards = [...new Set(ids.map((id) => Math.floor(id / 200)))]
  const parts = await Promise.all(shards.map((sh) => once<Record<string, Narrator>>(`data/narrators/n-${sh}.json`)))
  return Object.assign({}, ...parts) as Record<string, Narrator>
}
const AUTHOR: Record<string, string> = { bukhari: 'аль-Бухари', muslim: 'Муслима', tirmidhi: 'ат-Тирмизи', abudawud: 'Абу Дауда', nasai: 'ан-Насаи', ibnmajah: 'Ибн Маджи', darimi: 'ад-Дарими', malik: 'Малика' }
const BOOK: Record<string, string> = { bukhari: '«Сахих» аль-Бухари', muslim: '«Сахих» Муслима', tirmidhi: '«Сунан» ат-Тирмизи', abudawud: '«Сунан» Абу Дауда', nasai: '«Сунан» ан-Насаи', ibnmajah: '«Сунан» Ибн Маджи', darimi: '«Сунан» ад-Дарими', malik: '«Муватта» Малика' }

// 12 поколений по «Такрибу» Ибн Хаджара
const TABAQA: Record<number, string> = {
  1: 'Сподвижники',
  2: 'Старшие табиины (как Ибн аль-Мусайяб)',
  3: 'Средние табиины (как аль-Хасан аль-Басри)',
  4: 'Табиины, передававшие в основном от старших табиинов (как аз-Зухри)',
  5: 'Младшие табиины (как аль-А‘маш)',
  6: 'Современники пятого поколения, не заставшие сподвижников (как Ибн Джурайдж)',
  7: 'Старшие из «последователей табиинов» (как Малик)',
  8: 'Средние из «последователей табиинов» (как Ибн ‘Уяйна)',
  9: 'Младшие из «последователей табиинов» (как аш-Шафи‘и)',
  10: 'Старшие из тех, кто брал у «последователей табиинов» (как Ахмад)',
  11: 'Средние из них (как аль-Бухари)',
  12: 'Младшие из них (как ат-Тирмизи)',
}
const TABAQA_SHORT: Record<number, string> = { 1: 'сподвижник', 2: 'табиин', 3: 'табиин', 4: 'табиин', 5: 'табиин', 6: '6-е поколение', 7: '7-е поколение', 8: '8-е поколение', 9: '9-е поколение', 10: '10-е поколение', 11: '11-е поколение', 12: '12-е поколение' }

const WORDS: Record<string, string> = {
  'ثقة': 'надёжный', 'ثبت': 'твёрдый', 'حافظ': 'хафиз', 'متقن': 'точный', 'مأمون': 'заслуживающий доверия', 'حجة': 'довод',
  'صدوق': 'правдивый', 'حسن': 'хороший', 'الحديث': 'в хадисах', 'مقبول': 'принимаемый', 'ضعيف': 'слабый', 'متروك': 'оставленный',
  'صحابي': 'сподвижник', 'صحابية': 'сподвижница', 'صغير': 'младший', 'مخضرم': 'застал обе эпохи', 'مدلس': 'допускал тадлис', 'يرسل': 'передавал мурсаль',
  'يخطئ': 'бывает, ошибается', 'يهم': 'бывает, ошибается', 'أوهام': 'ошибки', 'له': '', 'فيه': '', 'لين': 'мягок в передаче', 'إمام': 'имам', 'فقيه': 'знаток права', 'عابد': 'благочестивый',
  'جليل': 'выдающийся', 'مكثر': 'передал много', 'أفراد': 'передавал одиночные сообщения',
}
const GRADE_EXACT: Record<string, string> = {
  'ثقة': 'Надёжный', 'صحابي': 'Сподвижник', 'صدوق حسن الحديث': 'Правдивый, его хадисы хорошие', 'ثقة ثبت': 'Надёжный, твёрдый в передаче',
  'ثقة حافظ': 'Надёжный, хафиз', 'مقبول': 'Принимаемый (при подтверждении)', 'له رؤية': 'Видел Пророка ﷺ', 'ضعيف الحديث': 'Слабый в хадисах',
  'صحابي صغير': 'Младший сподвижник', 'مختلف في صحبته': 'О его сподвижничестве спорят', 'لم تثبت له صحبة': 'Сподвижничество не доказано',
}
export const gradeRu = (r?: string) => {
  if (!r) return ''
  if (GRADE_EXACT[r]) return GRADE_EXACT[r]
  const t = r.split(/\s+/).map((w) => WORDS[w]).filter((x) => x !== undefined && x !== '')
  if (!t.length) return ''
  const s = t.join(', ')
  return s[0].toUpperCase() + s.slice(1)
}
/** Начало русского перевода оценки — для значка, если короткого шаблона нет */
const shortTr = (tr?: string | null) => {
  if (!tr) return ''
  const s = tr.replace(/\{\{\w+\|([^}]+)\}\}/g, '$1').split(/[.;:]/)[0].trim()
  return s.length <= 48 ? s : ''
}
// цвет значка оценки: надёжные — зелёный, «правдивый» и с оговорками — золотой, слабые — красный
const tone = (r?: string) => (!r ? 'n' : /ضعيف|متروك|منكر|كذاب|متهم|ليس/.test(r) ? 'bad' : /^ثقة|صحابي|صحابية|له رؤية|مخضرم|إمام|ثبت|حافظ/.test(r) && !/إلا|رمي|يخطئ|يهم/.test(r) ? 'good' : 'mid')

// src — откуда цепочка, если она взята из первоисточника (для ан-Навави и «Рияда»)
type Link = { chain?: number[]; src?: [string, string]; sahabi?: { id: number; sure: boolean } } | null

function useLink(cid: string, bn: number, i: number): Link | undefined {
  const [link, setLink] = useState<Link | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const k = `${bn}:${i}`
    setLink(undefined)
    if (cid === 'bukhari' || cid === 'muslim') loadChains(cid).then((c) => alive && setLink(c[k] ? { chain: c[k] } : null))
    else if (cid === 'riyad' || cid === 'nawawi') Promise.all([loadSahabi(cid), loadLinks(cid)]).then(([s, l]) => {
      if (!alive) return
      const v: NonNullable<Link> = {}
      if (s[k]) v.sahabi = { id: s[k][0], sure: !!s[k][1] }
      if (l[k]) { v.chain = l[k][2]; v.src = [l[k][0], l[k][1]] }
      setLink(v.chain || v.sahabi ? v : null)
    })
    else setLink(null)
    return () => { alive = false }
  }, [cid, bn, i])
  return link
}

/** Кнопка в ряду значков хадиса: цепочка передатчиков (Бухари, Муслим) или сподвижник (остальные сборники) */
export function ChainButton({ cid, bn, i, label }: { cid: string; bn: number; i: number; label: string }) {
  const link = useLink(cid, bn, i)
  const [open, setOpen] = useState<'chain' | 'sahabi' | null>(null)
  const [term, setTerm] = useState<string | null>(null)
  if (!link) return null
  return (
    <>
      {link.sahabi && (
        <button className="nr-chip" onClick={() => { haptic.tap(); setOpen('sahabi') }} aria-label="Сподвижник">
          <Icon id="users" /><span>Сподвижник</span>
        </button>
      )}
      {link.chain && (
        <button className="nr-chip" onClick={() => { haptic.tap(); setOpen('chain') }} aria-label="Цепочка передатчиков">
          <Icon id="users" /><span>Цепочка</span>
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
  const link = useLink(cid, bn, i)
  return link === null && (cid === 'bukhari' || cid === 'muslim') ? <p className="nr-none">Цепочка передатчиков для этого хадиса не указана.</p> : null
}

function SahabiSheet({ id, sure, cid, onClose }: { id: number; sure: boolean; cid: string; onClose: () => void }) {
  const [nr, setNr] = useState<Narrator | null>(null)
  useEffect(() => { loadNarrators([id]).then((d) => setNr(d[id] ?? null)) }, [id])
  if (!nr) return <Sheet onClose={onClose}><SheetHead title="Сподвижник" onClose={onClose} /><div className="body"><div className="loading">Загрузка…</div></div></Sheet>
  const why = `${cid === 'nawawi' ? 'Ан-Навави' : 'В «Рияд ас-Салихин» ан-Навави'} приводит хадис без цепочки, называя только сподвижника, от которого он дошёл, и того, кто его записал. Поэтому здесь — сподвижник; полная цепочка (если нашлась в первоисточнике) — по кнопке «Цепочка».`
  return <CardSheet nr={nr} note={why + (sure ? '' : ' Сподвижник определён по имени в тексте хадиса; в редких случаях возможна ошибка.')} onClose={onClose} />
}

function TagBtn({ id, text, ok }: { id: string; text: string; ok?: boolean }) {
  const open = useContext(TermCtx)
  return <button className={'nr-tag' + (ok ? ' ok' : '')} onClick={() => { haptic.tap(); open(id) }}>{text}<Icon id="info" /></button>
}

function ChainSheet({ chain, src, cid, bn, i, label, onClose }: { chain: number[]; src?: [string, string]; cid: string; bn: number; i: number; label: string; onClose: () => void }) {
  const from = src ? src[0] : cid
  const sahih = from === 'bukhari' || from === 'muslim'
  const [data, setData] = useState<Record<string, Narrator> | null>(null)
  const [rich, setRich] = useState<Rich | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { loadNarrators(chain).then(setData).catch(() => setFailed(true)); loadRich(cid, bn, i).then(setRich) }, [cid, bn, i])
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
            <p>Цепочка этого же хадиса взята из первоисточника.{!sahih && ' Оценка хадиса — в примечании под его текстом.'}</p>
          </div>
        ) : (
          <div className="nr-hd">
            <b>{label}</b>
            <div className="nr-tags"><TagBtn id="grades" text="Достоверный (сахих)" ok /></div>
            <p>Хадисы этого сборника составитель отбирал по условию достоверности.</p>
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
