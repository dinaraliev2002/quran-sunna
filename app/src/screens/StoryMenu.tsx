import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Sheet, SheetHead } from '../components/ui'
import { useQuranMeta } from '../hooks/useQuranMeta'
import type { AsbabIndex, KulievIndex, Surah } from '../lib/data'
import { setStoryMode, type StoryMode } from '../lib/storyMode'
import { buildStoryIndex, searchStories, snippet, type StoryHit } from '../lib/storySearch'
import { haptic } from '../lib/telegram'
import { useStore } from '../store/settings'

export interface OutlineItem { from: number; to: number; st: number; kv: number }
export type StoryOverlay = null | 'menu' | 'search' | 'outline' | 'marks'

const MODES: [StoryMode, string, string][] = [
  ['all', 'Истории и комментарии', 'Всё вместе'],
  ['st', 'Только истории', 'Причины ниспослания аятов'],
  ['kv', 'Только комментарии', 'Пояснения Э. Кулиева'],
]

const range = (from: number, to: number) => (from === to ? `Аят ${from}` : `Аяты ${from}–${to}`)

/** Меню раздела «Истории»: поиск, оглавление суры, закладки, что показывать, размер текста */
export function StoryMenu({ surah, mode, hasKv, onClose, onGo }: { surah: Surah; mode: StoryMode; hasKv: boolean; onClose: () => void; onGo: (o: StoryOverlay) => void }) {
  const st = useStore()
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Меню" sub={`Истории · ${surah.name}`} onClose={onClose} />
      <div className="menu-body">
        <div className="quick">
          <button onClick={() => onGo('search')}><Icon id="search" />Поиск</button>
          <button onClick={() => onGo('outline')}><Icon id="rows" />Оглавление</button>
          <button onClick={() => onGo('marks')}><Icon id="bookmark" />Закладки{st.storyMarks.length > 0 && <small style={{ marginLeft: 4 }}>{st.storyMarks.length}</small>}</button>
        </div>
        {hasKv && (
          <>
            <div className="as-label" style={{ margin: '14px 4px 4px' }}>Что показывать</div>
            {MODES.map(([m, t, d]) => (
              <button key={m} className="mrow" onClick={() => { haptic.tap(); setStoryMode(m) }}>
                <span className="mi"><Icon id={m === 'kv' ? 'scroll' : m === 'st' ? 'book' : 'rows'} /></span>
                <div className="t"><b>{t}</b><span>{d}</span></div>
                {mode === m && <Icon id="check" className="icon chev" />}
              </button>
            ))}
          </>
        )}
        <div className="as-label" style={{ margin: '14px 4px 4px' }}>Вид текста</div>
        <div className="fld"><label>Арабский текст аята</label>
          <div className="stepper"><small>{st.arSize} px</small><button onClick={() => st.set({ arSize: Math.max(20, st.arSize - 2) })}>−</button><button onClick={() => st.set({ arSize: Math.min(44, st.arSize + 2) })}>+</button></div>
        </div>
        <div className="fld"><label>Перевод аята</label>
          <div className="stepper"><small>{st.trSize} px</small><button onClick={() => st.set({ trSize: Math.max(12, st.trSize - 1) })}>−</button><button onClick={() => st.set({ trSize: Math.min(24, st.trSize + 1) })}>+</button></div>
        </div>
        <button className="mrow" onClick={() => { haptic.tap(); st.set({ translation: st.translation === 'ku' ? 'aa' : 'ku' }) }}>
          <span className="mi">Aa</span>
          <div className="t"><b>Перевод смыслов</b><span>{st.translation === 'ku' ? 'Э. Кулиев' : 'Другой перевод'} · нажмите, чтобы сменить</span></div>
        </button>
      </div>
    </Sheet>
  )
}

/** Оглавление суры: отрывки, у которых есть истории или комментарии */
export function StoryOutline({ surah, items, onClose, onPick }: { surah: Surah; items: OutlineItem[]; onClose: () => void; onPick: (a: number) => void }) {
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Оглавление" sub={`${surah.name} · ${items.length} отрывков`} onClose={onClose} />
      <div className="body">
        {items.length === 0 && <div className="empty">Здесь пока ничего нет</div>}
        {items.map((g) => (
          <button key={`${g.from}-${g.to}`} className="opt-row" onClick={() => onPick(g.from)}>
            <span>{range(g.from, g.to)}<small>{[g.st ? 'история' : '', g.kv ? 'комментарий' : ''].filter(Boolean).join(' · ')}</small></span>
            <Icon id="right" />
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** Закладки: отрывки из любых сур */
export function StoryMarks({ onClose, onOpen }: { onClose: () => void; onOpen: (s: number, a: number) => void }) {
  const meta = useQuranMeta()
  const st = useStore()
  const marks = [...st.storyMarks].map((k) => k.split(':').map(Number) as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Закладки" sub={marks.length ? `${marks.length} отмечено` : undefined} onClose={onClose} />
      <div className="body">
        {marks.length === 0 && <div className="empty">Нажмите на значок закладки у отрывка, чтобы вернуться к нему позже</div>}
        {marks.map(([s, a]) => (
          <div key={`${s}:${a}`} className="opt-row" role="button" tabIndex={0} onClick={() => onOpen(s, a)}>
            <span>{meta?.surahs[s - 1]?.name ?? `Сура ${s}`} · аят {a}</span>
            <button className="icon-btn" aria-label="Убрать закладку" onClick={(e) => { e.stopPropagation(); haptic.tap(); st.set({ storyMarks: st.storyMarks.filter((k) => k !== `${s}:${a}`) }) }}><Icon id="close" /></button>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

/** Поиск по всем историям и комментариям */
export function StorySearch({ surah, ix, kx, mode, onClose, onOpen }: {
  surah: Surah; ix: AsbabIndex | null; kx: KulievIndex | null; mode: StoryMode
  onClose: () => void; onOpen: (hit: StoryHit) => void
}) {
  const meta = useQuranMeta()
  const [q, setQ] = useState('')
  const [here, setHere] = useState(false)
  const [hits, setHits] = useState<StoryHit[] | null>(null)
  const [prog, setProg] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    buildStoryIndex(ix, kx, (d, t) => { if (alive) setProg(Math.round((d / t) * 100)) }).then((h) => { if (alive) setHits(h) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [ix, kx])

  const res = useMemo(() => (hits && q.trim().length > 1 ? searchStories(hits, q, mode, here ? surah.id : undefined) : []), [hits, q, mode, here, surah.id])

  return (
    <Sheet onClose={onClose} tall>
      <SheetHead title="Поиск" sub={mode === 'kv' ? 'По комментариям' : mode === 'st' ? 'По историям' : 'По историям и комментариям'} onClose={onClose} />
      <div className="body">
        <div className="search" style={{ margin: '0 0 8px' }}>
          <Icon id="search" />
          <input autoFocus placeholder="Слово или имя, например «Бадр»" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="sl-chips" style={{ padding: '0 0 8px', background: 'none' }}>
          <button className={'chip' + (!here ? ' on' : '')} onClick={() => setHere(false)}>Везде</button>
          <button className={'chip' + (here ? ' on' : '')} onClick={() => setHere(true)}>В суре «{surah.name}»</button>
        </div>
        {failed && <div className="empty">Не удалось подготовить поиск. Проверьте интернет и попробуйте ещё раз</div>}
        {!hits && !failed && <div className="loading">Готовим поиск… {prog}%</div>}
        {hits && q.trim().length < 2 && <div className="empty">Введите хотя бы два символа</div>}
        {hits && q.trim().length > 1 && res.length === 0 && <div className="empty">Ничего не найдено</div>}
        {res.map(({ hit }, i) => (
          <button key={i} className="opt-row srch" onClick={() => onOpen(hit)}>
            <span>
              <b>{meta?.surahs[hit.s - 1]?.name} · {hit.kind === 'kv' ? hit.title : range(hit.from, hit.to).toLowerCase()}</b>
              <small>{hit.kind === 'kv' ? 'Комментарий' : 'История'} · {snippet(hit.text, q)}</small>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
