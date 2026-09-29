import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { EVENING, loadAzkar, MORNING, timesLabel, type AzkarData } from '../../lib/azkar'
import { haptic } from '../../lib/telegram'
import { useAzkarAudio } from '../../store/azkarAudio'
import { useStore } from '../../store/settings'
import { ArText, RuText } from './AzkarText'

// шрифты арабского текста азкаров
const AZ_FONTS = {
  sch: { name: 'Шахерезада', css: '"Scheherazade New", "Amiri", serif' },
  hafs: { name: 'Хафс', css: '"UthmanicHafs", "Scheherazade New", serif' },
  amiri: { name: 'Амири', css: '"Amiri", "Scheherazade New", serif' },
} as const

// Раздел азкаров: карточки листаются вбок (свайп влево — следующая),
// внизу закреплён большой счётчик — показывает, сколько раз осталось прочитать.

export default function Chapter() {
  const nav = useNavigate()
  const { id } = useParams()
  const [search] = useSearchParams()
  const ch = Number(id)
  const focusItem = Number(search.get('item')) || 0
  const [data, setData] = useState<AzkarData | null>(null)
  const st = useStore()
  const audio = useAzkarAudio()
  const track = useRef<HTMLDivElement>(null)
  const [cur, setCur] = useState(0) // индекс текущей карточки
  const [settings, setSettings] = useState(false)
  const [pop, setPop] = useState(0) // «пульс» счётчика при нажатии

  useEffect(() => { loadAzkar().then(setData) }, [])
  useEffect(() => () => useAzkarAudio.getState().stop(), [])

  const chapter = data?.chapters.find((c) => c.id === ch)
  const category = data && chapter ? data.categories.find((c) => c.id === chapter.cat) : null
  const items = chapter?.items ?? []
  const count = (item: number) => st.today.az?.[`${ch}:${item}`] ?? 0
  const doneCount = data ? items.filter((i) => count(i) >= data.items[i].rep).length : 0
  const complete = items.length > 0 && doneCount >= items.length

  // открыть на нужной карточке: из «Все» — на выбранной, иначе — на первой непрочитанной
  useLayoutEffect(() => {
    if (!chapter || !data || !track.current) return
    let idx = focusItem ? items.indexOf(focusItem) : items.findIndex((i) => count(i) < data.items[i].rep)
    if (idx < 0) idx = 0
    track.current.scrollLeft = idx * track.current.clientWidth
    setCur(idx)
  }, [chapter, data])

  useEffect(() => {
    if (!complete) return
    if (ch === MORNING) st.markTask('morning', true)
    if (ch === EVENING) st.markTask('evening', true)
  }, [complete, ch])

  const go = (idx: number) => {
    const el = track.current
    if (!el || idx < 0 || idx >= items.length) return
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = track.current!
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx !== cur) { setCur(idx); haptic.tick(); if (audio.id !== null) audio.stop() }
  }

  const itemId = items[cur]
  const item = data && itemId ? data.items[itemId] : null
  const n = itemId ? count(itemId) : 0
  const left = item ? Math.max(0, item.rep - n) : 0

  function tap() {
    if (!item || !itemId) return
    if (left === 0) { go(cur + 1); return }
    const v = st.azkarTap(ch, itemId, item.rep)
    setPop((p) => p + 1)
    if (v >= item.rep) {
      haptic.success()
      if (st.azAuto && cur < items.length - 1) setTimeout(() => go(cur + 1), 450)
    } else haptic.tap()
  }

  return (
    <div className="azc" style={{ ['--az-ar' as string]: st.azArSize + 'px', ['--az-tr' as string]: st.azTrSize + 'px', ['--az-font' as string]: AZ_FONTS[st.azFont ?? 'sch'].css }}>
      <div className="azc-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{chapter?.name ?? 'Азкары'}</b><span>{category?.name ?? 'Крепость мусульманина'}</span></div>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Настройки"><Icon id="gear" /></button>
      </div>

      {items.length > 1 && (
        <div className="azc-dots" aria-hidden>
          {items.map((i, k) => (
            <button key={i} className={(k === cur ? 'on ' : '') + (data && count(i) >= data.items[i].rep ? 'done' : '')} onClick={() => go(k)} />
          ))}
        </div>
      )}

      {!data && <div className="loading">Загрузка…</div>}
      <div className="azc-track" ref={track} onScroll={onScroll}>
        {data && items.map((i, k) => {
          const it = data.items[i]
          const playing = audio.id === i
          return (
            <section key={i} className="azc-card">
              <div className="azc-body">
                <div className="azc-meta">
                  <span>{k + 1} из {items.length}{it.rep > 1 ? ` · ${timesLabel(it.rep)}` : ''}</span>
                  {it.audio && (
                    <button className={'azc-play' + (playing ? ' on' : '')} onClick={() => audio.toggle(i, it.audio!)} aria-label={playing ? 'Стоп' : 'Слушать'}>
                      <Icon id={playing ? 'pause' : 'play'} />{playing ? 'Стоп' : 'Слушать'}
                    </button>
                  )}
                </div>
                {st.azShowAr && <ArText text={it.ar} />}
                {st.azShowAr && st.azShowTr && it.ru && <div className="azc-divider"><span>۞</span></div>}
                {st.azShowTr && it.ru && <RuText text={it.ru} />}
                {st.azShowRef && it.ref && <div className="azc-ref">Источник: {it.ref}</div>}
              </div>
            </section>
          )
        })}
      </div>

      {/* закреплённый счётчик: сколько раз осталось */}
      {item && (
        <div className="azc-counter-wrap">
          <button className={'azc-counter' + (left === 0 ? ' full' : '')} onClick={tap} aria-label={left ? `Осталось ${left}` : 'Прочитано'}>
            <span key={pop} className="azc-num">{left === 0 ? <Icon id="check" /> : left}</span>
          </button>
          {complete && <div className="azc-complete">Все азкары раздела прочитаны · Да примет Аллах!</div>}
        </div>
      )}

      {settings && (
        <Sheet onClose={() => setSettings(false)}>
          <SheetHead title="Настройки текста" onClose={() => setSettings(false)} />
          <div className="body">
            <div className="fld"><label>Шрифт арабского текста</label>
              <div className="az-fonts">
                {(Object.keys(AZ_FONTS) as (keyof typeof AZ_FONTS)[]).map((k) => (
                  <button key={k} className={(st.azFont ?? 'sch') === k ? 'on' : ''} onClick={() => st.set({ azFont: k })}>
                    <span style={{ fontFamily: AZ_FONTS[k].css }}>سُبْحَانَ اللهِ</span>
                    <b>{AZ_FONTS[k].name}</b>
                  </button>
                ))}
              </div>
            </div>
            <div className="fld"><label>Размер арабского текста</label>
              <div className="stepper"><small>{st.azArSize}</small><button onClick={() => st.set({ azArSize: Math.max(18, st.azArSize - 2) })}>−</button><button onClick={() => st.set({ azArSize: Math.min(44, st.azArSize + 2) })}>+</button></div>
            </div>
            <div className="fld"><label>Размер перевода</label>
              <div className="stepper"><small>{st.azTrSize}</small><button onClick={() => st.set({ azTrSize: Math.max(13, st.azTrSize - 1) })}>−</button><button onClick={() => st.set({ azTrSize: Math.min(26, st.azTrSize + 1) })}>+</button></div>
            </div>
            {/* хотя бы что-то одно из двух остаётся включённым */}
            <button className="srow2" onClick={() => { if (!(st.azShowAr && !st.azShowTr)) st.set({ azShowAr: !st.azShowAr }) }}><div>Арабский текст</div><span className={'switch' + (st.azShowAr ? ' on' : '')} /></button>
            <button className="srow2" onClick={() => { if (!(st.azShowTr && !st.azShowAr)) st.set({ azShowTr: !st.azShowTr }) }}><div>Перевод</div><span className={'switch' + (st.azShowTr ? ' on' : '')} /></button>
            <button className="srow2" onClick={() => st.set({ azShowRef: !st.azShowRef })}><div>Источник хадиса</div><span className={'switch' + (st.azShowRef ? ' on' : '')} /></button>
            <button className="srow2" onClick={() => st.set({ azAuto: !st.azAuto })}><div>Автопереход<span>После последнего повтора — к следующей мольбе</span></div><span className={'switch' + (st.azAuto ? ' on' : '')} /></button>
            <button className="bigbtn danger" onClick={() => { haptic.tap(); st.azkarReset(ch, items); setSettings(false); go(0) }}><Icon id="repeat" />Начать раздел заново</button>
          </div>
        </Sheet>
      )}
      {audio.status === 'error' && <div className="azc-toast">Не удалось загрузить аудио. Проверьте интернет.</div>}
    </div>
  )
}
