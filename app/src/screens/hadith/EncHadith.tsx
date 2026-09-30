import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { ARABIC_FONTS } from '../../lib/azkar'
import { favEnc, loadEnc, loadTopics, shareBody, topicTitle, type EncHadith, type TopicsData } from '../../lib/hadith'
import { haptic, shareText } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { HadithSettings } from './HadithSettings'

// Хадис из «Энциклопедии хадисов»: текст, источник и степень достоверности, объяснение, выводы.
// Если открыт из темы — внизу переход к соседним хадисам этой темы.
export default function EncHadithView() {
  const nav = useNavigate()
  const id = Number(useParams().id)
  const [search] = useSearchParams()
  const tid = Number(search.get('t')) || 0
  const [h, setH] = useState<EncHadith | null | undefined>(undefined)
  const [topics, setTopics] = useState<TopicsData | null>(null)
  const [settings, setSettings] = useState(false)
  const st = useStore()

  useEffect(() => { setH(undefined); loadEnc(id).then(setH).catch(() => setH(null)); document.querySelector('.hde')?.scrollTo(0, 0) }, [id])
  useEffect(() => { loadTopics().then(setTopics) }, [])

  const topic = tid ? topics?.topics.find((t) => t.id === tid) : null
  const pos = topic ? topic.ids.indexOf(id) : -1
  const prev = topic && pos > 0 ? topic.ids[pos - 1] : null
  const next = topic && pos >= 0 && pos < topic.ids.length - 1 ? topic.ids[pos + 1] : null
  const go = (x: number | null) => x && nav(`/hadith/e/${x}?t=${tid}`, { replace: true })

  const key = favEnc(id)
  const fav = st.hfav.includes(key)
  const quote = h ? (h.in ? h.ru.slice(h.in.length).trim() : h.ru) : ''

  return (
    <div className="screen hdb hde" style={{ ['--hd-ar' as string]: st.hdArSize + 'px', ['--hd-tr' as string]: st.hdTrSize + 'px', ['--az-font' as string]: ARABIC_FONTS[st.azFont ?? 'sch'].css }}>
      <div className="hdb-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Хадис</b><span>{topic ? `${topicTitle(topic)} · ${pos + 1} из ${topic.ids.length}` : 'Энциклопедия хадисов'}</span></div>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Настройки текста"><Icon id="gear" /></button>
      </div>
      {h === undefined && <div className="loading">Загрузка…</div>}
      {h === null && <div className="empty">Не удалось загрузить хадис. Проверьте интернет.</div>}
      {h && (
        <>
          <article className="hd-card">
            <div className="hd-card-h">
              {h.grade && <span className="hd-grade">{h.grade}</span>}
              <div className="hd-acts">
                <button className={fav ? 'on' : ''} onClick={() => { haptic.tap(); st.toggleHadithFav(key) }} aria-label={fav ? 'Убрать из избранного' : 'В избранное'}><Icon id="bookmark" /></button>
                <button onClick={() => shareText(shareBody('', h.ru, h.src))} aria-label="Поделиться"><Icon id="share" /></button>
              </div>
            </div>
            {st.hdShowAr && h.ar && <div className="hd-ar" dir="rtl"><p>{h.ar}</p></div>}
            {st.hdShowAr && h.ar && <div className="azc-divider"><span>۞</span></div>}
            <div className="hd-ru">
              {h.in && <p className="hd-intro">{h.in}</p>}
              <p className="hd-quote">{quote}</p>
              {h.src && <p className="hd-src">{h.src}</p>}
            </div>
          </article>

          {h.ex && (
            <section className="hd-sec">
              <h2><Icon id="info" />Объяснение</h2>
              {h.ex.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </section>
          )}
          {h.hints.length > 0 && (
            <section className="hd-sec">
              <h2><Icon id="leaf" />Польза и выводы</h2>
              <ol className="hd-hints">{h.hints.map((x, i) => <li key={i}>{x}</li>)}</ol>
            </section>
          )}
          <p className="hd-credit">Энциклопедия переведённых пророческих хадисов · HadeethEnc.com</p>

          {topic && (
            <div className="hdb-nav">
              <button disabled={!prev} onClick={() => go(prev)}><Icon id="back" /><span>Предыдущий</span></button>
              <button disabled={!next} onClick={() => go(next)}><span>Следующий</span><Icon id="right" /></button>
            </div>
          )}
        </>
      )}
      {settings && <HadithSettings onClose={() => setSettings(false)} />}
    </div>
  )
}
