import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { EVENING, loadAzkar, MORNING, timesLabel, type AzkarData } from '../../lib/azkar'
import { haptic } from '../../lib/telegram'
import { useAzkarAudio } from '../../store/azkarAudio'
import { useStore } from '../../store/settings'

export default function Chapter() {
  const nav = useNavigate()
  const { id } = useParams()
  const [search] = useSearchParams()
  const ch = Number(id)
  const focusItem = Number(search.get('item')) || 0
  const [data, setData] = useState<AzkarData | null>(null)
  const { today, azkarTap, azkarReset, markTask, arSize, trSize } = useStore()
  const audio = useAzkarAudio()
  const screen = useRef<HTMLDivElement>(null)

  useEffect(() => { loadAzkar().then(setData) }, [])
  useEffect(() => () => useAzkarAudio.getState().stop(), []) // ушли с экрана — выключить звук

  const chapter = data?.chapters.find((c) => c.id === ch)
  const category = data && chapter ? data.categories.find((c) => c.id === chapter.cat) : null
  const count = (item: number) => today.az?.[`${ch}:${item}`] ?? 0
  const done = chapter && data ? chapter.items.filter((i) => count(i) >= data.items[i].rep).length : 0
  const total = chapter?.items.length ?? 0
  const complete = total > 0 && done >= total

  // открыть на нужном азкаре (из вкладки «Все»)
  useLayoutEffect(() => {
    if (!chapter || !focusItem || !screen.current) return
    const el = screen.current.querySelector<HTMLElement>(`[data-item="${focusItem}"]`)
    if (el) screen.current.scrollTop = el.offsetTop - 90
  }, [chapter, focusItem])

  // утренние/вечерние прочитаны полностью → отметить на главной
  useEffect(() => {
    if (!complete) return
    if (ch === MORNING) markTask('morning', true)
    if (ch === EVENING) markTask('evening', true)
  }, [complete, ch, markTask])

  function tap(item: number, rep: number, idx: number) {
    if (count(item) >= rep) return
    const n = azkarTap(ch, item, rep)
    if (n >= rep) {
      haptic.success()
      // прочитан — плавно к следующему непрочитанному
      const next = chapter!.items.slice(idx + 1).find((i) => count(i) < data!.items[i].rep)
      if (next) setTimeout(() => screen.current?.querySelector(`[data-item="${next}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
    } else haptic.tap()
  }

  return (
    <div className="screen azc" ref={screen} style={{ ['--ar-size' as string]: arSize + 'px', ['--tr-size' as string]: trSize + 'px' }}>
      <div className="azc-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{chapter?.name ?? 'Азкары'}</b><span>{category?.name ?? 'Крепость мусульманина'}</span></div>
        <button className="icon-btn" onClick={() => { haptic.tap(); chapter && azkarReset(ch, chapter.items) }} aria-label="Начать заново" title="Начать заново"><Icon id="repeat" /></button>
      </div>
      {total > 1 && (
        <div className="azc-progress">
          <div className="bar2"><i style={{ width: `${(done / total) * 100}%` }} /></div>
          <span>{done} из {total} прочитано сегодня</span>
        </div>
      )}

      {!data && <div className="loading">Загрузка…</div>}
      {chapter && data && chapter.items.map((i, idx) => {
        const it = data.items[i]
        const n = count(i)
        const full = n >= it.rep
        const playing = audio.id === i
        return (
          <div key={i} data-item={i} className={'dua' + (full ? ' done' : '') + (i === focusItem ? ' focus' : '')}>
            <div className="hd">
              <span className="n">№ {idx + 1}{it.rep > 1 ? ` · ${timesLabel(it.rep)}` : ''}</span>
              {it.audio && (
                <button className={'play' + (playing ? ' on' : '')} onClick={() => audio.toggle(i, it.audio!)} aria-label={playing ? 'Стоп' : 'Слушать'}>
                  <Icon id={playing ? (audio.status === 'loading' ? 'more' : 'pause') : 'play'} />
                </button>
              )}
            </div>
            <div className="ar">{it.ar}</div>
            {it.ru && <div className="tr">{it.ru}</div>}
            {it.ref && <div className="src"><b>Источник:</b> {it.ref}</div>}
            <button className={'counter' + (full ? ' full' : '')} onClick={() => tap(i, it.rep, idx)}>
              <span className="lbl">{full ? 'Прочитано' : it.rep > 1 ? 'Нажимайте после каждого раза' : 'Отметить прочитанным'}</span>
              <span className="cnt">{full ? <Icon id="check" /> : `${n} / ${it.rep}`}</span>
            </button>
          </div>
        )
      })}
      {complete && (
        <div className="azc-done">
          <Icon id="check" />
          <b>Все азкары прочитаны</b>
          <span>Да примет Аллах! Счётчики обнулятся завтра.</span>
        </div>
      )}
      {audio.status === 'error' && <div className="azc-toast">Не удалось загрузить аудио. Проверьте интернет.</div>}
    </div>
  )
}
