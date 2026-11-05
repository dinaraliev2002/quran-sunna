import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { plural } from '../lib/plural'
import { loadGlossary, loadSajda, surahGlyph, type GlossaryItem, type SajdaData } from '../lib/data'
import { TermItem } from './glossary/TermItem'

/** Откуда открыли справочник: сура и страница, чтобы показать их в верхней плашке */
export interface RefFrom { id: number; name: string; sub: string }

/** Верхняя плашка справочника: «Назад» и название; если пришли из чтения — ещё и где вы читаете */
function RefTop({ title, sub }: { title: string; sub: string }) {
  const nav = useNavigate()
  const from = (useLocation().state as { from?: RefFrom } | null)?.from
  return (
    <div className="rtop ref-top">
      <button className="sq glass" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
      <div className="rtitle glass">
        <div className="t"><b>{title}</b><span>{from ? `Назад к: ${from.name} · ${from.sub}` : sub}</span></div>
        {from && <span className="sname">{surahGlyph(from.id)}</span>}
      </div>
    </div>
  )
}

/** Свайп от левого края вправо — назад, как в читалке */
function useBackSwipe() {
  const nav = useNavigate()
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; start.current = t.clientX < 40 ? { x: t.clientX, y: t.clientY } : null },
    onTouchEnd: (e: React.TouchEvent) => {
      const a = start.current; start.current = null
      if (!a) return
      const t = e.changedTouches[0]
      if (t.clientX - a.x > 70 && Math.abs(t.clientY - a.y) < 60) nav(-1)
    },
  }
}

/** Словарь арабских выражений и терминов (Приложение к переводу Кулиева) */
export function Glossary() {
  const swipe = useBackSwipe()
  const [items, setItems] = useState<GlossaryItem[] | null>(null)
  const fromTerm = (useLocation().state as { open?: string } | null)?.open ?? null // пришли из подсвеченного термина
  const [q, setQ] = useState(fromTerm ?? '')
  const [open, setOpen] = useState<string | null>(fromTerm) // какой термин раскрыт (по одному)
  useEffect(() => { loadGlossary().then((g) => setItems(g ?? [])) }, [])
  const list = useMemo(() => {
    if (!items) return []
    const n = q.trim().toLowerCase().replace(/[-\s‘’']/g, '')
    if (!n) return items
    return items.filter((x) => x.tr.toLowerCase().replace(/[-\s‘’']/g, '').includes(n) || x.mean.toLowerCase().includes(q.trim().toLowerCase()) || x.ar.replace(/\s/g, '').includes(n))
  }, [items, q])
  return (
    <>
    <div className="screen az ref" {...swipe}>
      <div className="search" style={{ margin: '0 0 8px' }}>
        <Icon id="search" />
        <input placeholder="Термин или значение" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="az-sub">Арабские выражения и термины · {items ? items.length : '…'} {plural(items?.length ?? 0, 'запись', 'записи', 'записей')}</p>
      {!items && <div className="loading">Загрузка…</div>}
      {items && list.length === 0 && <div className="empty">Ничего не найдено</div>}
      {list.map((x) => <TermItem key={x.tr} x={x} open={open === x.tr} onToggle={() => setOpen(open === x.tr ? null : x.tr)} />)}
      <div className="kv-src" style={{ padding: '14px 4px' }}>Словарь арабских выражений и терминов — приложение к переводу смыслов Корана Э. Кулиева (издание Комплекса короля Фахда).</div>
    </div>
    <RefTop title="Словарь" sub="Арабские термины" />
    </>
  )
}

/** Перечень мест для земных поклонов в Коране */
export function SajdaList() {
  const nav = useNavigate()
  const swipe = useBackSwipe()
  const from = (useLocation().state as { from?: RefFrom } | null)?.from
  const [sj, setSj] = useState<SajdaData | null>(null)
  useEffect(() => { loadSajda().then(setSj) }, [])
  return (
    <>
    <div className="screen az ref" {...swipe}>
      {!sj && <div className="loading">Загрузка…</div>}
      {sj && (
        <>
          <p className="az-sub">После прочтения этих аятов желательно совершить земной поклон</p>
          <div className="kv sj">
            <div className="sj-label">Мольба при земном поклоне</div>
            <div className="sj-ar">{sj.dua_ar}</div>
            <p className="kv-p">{sj.dua_ru} Об этом сообщил {sj.dua_src}.</p>
          </div>
          <div className="sj-label" style={{ margin: '18px 4px 4px' }}>Места земных поклонов</div>
          {sj.places.map((p) => (
            <button key={p.n} className="ref-open" onClick={() => nav(`/read/${p.surah}?a=${p.ayah}`, { state: { from } })}>
              <div className="num-badge"><span>{p.n}</span></div>
              <div className="t"><b>{p.name}</b><span>{p.surah}:{p.ayah} · джуз {p.juz}{p.disputed ? ' · по мнению аш-Шафии' : ''}</span></div>
              <Icon id="right" className="icon chev-s" />
            </button>
          ))}
          <p className="kv-src" style={{ padding: '10px 4px' }}>{sj.note}</p>
        </>
      )}
    </div>
    <RefTop title="Земные поклоны" sub="15 мест в Коране" />
    </>
  )
}
