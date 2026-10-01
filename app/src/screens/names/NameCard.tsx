import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { loadSurahs, type Surah } from '../../lib/data'
import { loadNames, type NamesData } from '../../lib/names'
import { haptic, shareText } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { Translit } from './Names'

const REF = /\(сур[аы]?\s*(\d{1,3})\s*«[^»]*»,?\s*аяты?\s*(\d{1,3})(?:\s*[-–—]\s*\d{1,3})?\)/g

/** Цитаты верхнего уровня «…» (с учётом вложенных кавычек): [начало, конец] */
function quotes(text: string): [number, number][] {
  const out: [number, number][] = []
  let depth = 0, start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '«') { if (depth++ === 0) start = i }
    else if (text[i] === '»' && depth > 0 && --depth === 0) out.push([start, i + 1])
  }
  return out
}

/** Абзац толкования: аяты (цитата + «(сура 4 «Женщины», аят 134)») — выделены цветом, ссылка открывает Коран;
 *  хадисы и слова учёных в кавычках — полужирным; остальное — обычным текстом */
function Para({ text, open }: { text: string; open: (s: number, a: number) => void }) {
  const out: ReactNode[] = []
  let k = 0
  const plain = (t: string, cls?: string) => {
    const parts = t.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={k++}>{part}</b> : <Fragment key={k++}>{part}</Fragment>))
    out.push(cls ? <span key={k++} className={cls}>{parts}</span> : <Fragment key={k++}>{parts}</Fragment>)
  }
  const refs = [...text.matchAll(REF)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, s: Number(m[1]), a: Number(m[2]), t: m[0] }))
  const qs = quotes(text).map(([a, b]) => ({ a, b, ayah: refs.some((r) => /^[\s*,;:.]*$/.test(text.slice(b, r.start)) && r.start >= b) }))
  // отрезки: цитаты и ссылки по порядку (перекрывающиеся пропускаем — ссылка внутри цитаты остаётся её частью)
  const marks = [...qs.map((q) => ({ start: q.a, end: q.b, kind: q.ayah ? 'ayah' : 'quote' as string })), ...refs.map((r) => ({ start: r.start, end: r.end, kind: 'ref', r }))]
    .sort((x, y) => x.start - y.start)
  let pos = 0
  for (const m of marks) {
    if (m.start < pos) continue
    plain(text.slice(pos, m.start))
    const seg = text.slice(m.start, m.end)
    if (m.kind === 'ref') {
      const r = (m as unknown as { r: { s: number; a: number } }).r
      out.push(<button key={k++} className="azt-link nm-ref" onClick={() => open(r.s, r.a)}>{seg}</button>)
    } else plain(seg, m.kind === 'ayah' ? 'nm-ayah' : 'nm-quote')
    pos = m.end
  }
  plain(text.slice(pos))
  return <p>{out}</p>
}

// на какой карточке открыли последний раз
let lastName = 1

// Имя Аллаха: карточки листаются вбок по порядку списка, внутри — значение, толкование и аяты
export default function NameCard() {
  const nav = useNavigate()
  const start = Number(useParams().n) || lastName
  const [data, setData] = useState<NamesData | null>(null)
  const [surahs, setSurahs] = useState<Surah[] | null>(null)
  const [cur, setCur] = useState(start - 1)
  const st = useStore()
  const track = useRef<HTMLDivElement>(null)
  useEffect(() => { loadNames().then(setData); loadSurahs().then(setSurahs) }, [])
  useLayoutEffect(() => {
    if (!data || !track.current) return
    track.current.scrollLeft = (start - 1) * track.current.clientWidth
    setCur(start - 1)
  }, [data])

  const onScroll = () => {
    const el = track.current!
    const k = Math.round(el.scrollLeft / el.clientWidth)
    if (k !== cur && k >= 0 && k < 99) { setCur(k); haptic.tick(); lastName = k + 1 }
  }
  const go = (k: number) => track.current?.scrollTo({ left: k * track.current.clientWidth, behavior: 'smooth' })
  const open = (s: number, a: number) => nav(`/read/${s}?a=${a}`)
  const names = data?.names ?? []

  return (
    <div className="hdk nmc">
      <div className="azc-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>99 имён Аллаха</b><span>{names.length ? `${cur + 1} из ${names.length}` : ''}</span></div>
        <span style={{ width: 44 }} />
      </div>
      <div className="hdk-progress"><i style={{ width: `${((cur + 1) / 99) * 100}%` }} /></div>
      {!data && <div className="loading">Загрузка…</div>}
      <div className="azc-track" ref={track} onScroll={onScroll}>
        {names.map((n, i) => {
          if (Math.abs(i - cur) > 2) return <section key={n.n} className="azc-card" />
          const g = data!.groups[n.g]
          const others = names.filter((x) => x.g === n.g && x.n !== n.n)
          const done = st.learned.includes(n.n)
          return (
            <section key={n.n} className="azc-card">
              <article className="hdk-body">
                <div className="hdk-content">
                  <div className="nmc-head">
                    <span className="nm-no-big">{n.n}</span>
                    <div className="nmc-ar">{n.ar}</div>
                    <div className="nmc-tr"><Translit name={n} /></div>
                    <div className="nmc-ru">{n.ru}</div>
                    <div className="nmc-acts">
                      <button className={done ? 'on' : ''} onClick={() => { haptic.tap(); st.setLearned(n.n, !done) }}>
                        <Icon id="check" />{done ? 'Выучено' : 'Отметить выученным'}
                      </button>
                      <button className="sq" onClick={() => shareText(`${n.ar} — ${n.tr} (${n.ru})\n\n${g.text[0]?.replace(/\*\*/g, '') ?? ''}`)} aria-label="Поделиться"><Icon id="share" /></button>
                    </div>
                  </div>

                  <div className="nmc-sec">
                    <h2><Icon id="info" />Толкование</h2>
                    {others.length > 0 && <p className="nmc-with">Вместе с именами: {others.map((o) => `${o.tr} (${o.ru})`).join(', ')}</p>}
                    {g.text.map((t, k) => <Para key={k} text={t} open={open} />)}
                  </div>

                  {g.ayahs.length > 0 && (
                    <div className="nmc-sec">
                      <h2><Icon id="book" />Аяты</h2>
                      <div className="nmc-ayahs">
                        {g.ayahs.map(([s, a]) => (
                          <button key={`${s}:${a}`} onClick={() => open(s, a)}>
                            <b>{surahs?.[s - 1]?.name ?? `Сура ${s}`}</b><span>{s}:{a}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="hdk-pager">
                  <button disabled={i === 0} onClick={() => go(i - 1)} aria-label="Предыдущее имя"><Icon id="back" /></button>
                  <span>{i + 1} / {names.length}</span>
                  <button disabled={i >= names.length - 1} onClick={() => go(i + 1)} aria-label="Следующее имя"><Icon id="right" /></button>
                </div>
              </article>
            </section>
          )
        })}
      </div>
    </div>
  )
}
