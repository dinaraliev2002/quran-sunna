import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { loadFreq } from '../../lib/freqWords'
import { plural } from '../../lib/plural'
import { haptic } from '../../lib/telegram'
import { gradeWord, loadWordCards, loadWordsPerDay, saveWordCards, saveWordsPerDay, WORDS_PER_DAY, wordsToday, type WordCards } from '../../lib/wordCards'
import { useWordSheet } from '../../store/wordSheet'
import type { FreqData, FreqWord } from '../../types/morph'
import { HifzTabs } from './parts'

const KIND: Record<string, string> = { V: 'глагол', N: 'имя', P: 'частица' }

/** Раздел «Заучивание → Слова»: самые частые слова Корана по порядку, с повторением по интервалам */
export default function WordsHifz() {
  const nav = useNavigate()
  const openWord = useWordSheet((s) => s.open)
  const [data, setData] = useState<FreqData | null | undefined>(undefined)
  const [cards, setCards] = useState<WordCards>(loadWordCards)
  const [perDay, setPerDay] = useState(loadWordsPerDay)
  const [queue, setQueue] = useState<FreqWord[] | null>(null) // идёт занятие: что осталось показать
  const [shown, setShown] = useState(false) // открыт ли ответ у текущего слова
  const [done, setDone] = useState(0)
  useEffect(() => { loadFreq().then(setData) }, [])

  const today = useMemo(() => (data ? wordsToday(data, cards, perDay) : null), [data, cards, perDay])

  if (data === undefined) return <div className="screen"><div className="loading">Загрузка…</div></div>
  if (!data || !today) return <div className="screen"><div className="empty">Не удалось загрузить список слов</div></div>

  const start = () => { haptic.tap(); setQueue([...today.due, ...today.fresh]); setShown(false); setDone(0) }
  const cur = queue?.[0]
  const answer = (good: boolean) => {
    if (!cur) return
    haptic.tap()
    const next = gradeWord(cards, cur[0], good ? 'good' : 'bad')
    setCards(next); saveWordCards(next)
    setQueue((q) => {
      const rest = (q ?? []).slice(1)
      return good ? rest : [...rest, cur] // не вспомнили — слово вернётся в конце этого же занятия
    })
    if (good) setDone((n) => n + 1)
    setShown(false)
  }

  // ===== занятие =====
  if (queue) {
    const finished = !cur
    return (
      <div className="screen hz">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setQueue(null)} aria-label="Закрыть"><Icon id="back" /></button>
          <div className="ttl"><b>Слова</b><span>{finished ? 'Готово' : `Осталось: ${queue.length}`}</span></div>
          <span style={{ width: 44 }} />
        </div>
        {finished ? (
          <section className="hz-hero">
            <span className="hz-hero-l">Занятие окончено</span>
            <b className="hz-hero-t">{done} {plural(done, 'слово', 'слова', 'слов')} — машаАллах!</b>
            <p>Слова вернутся на повтор в нужный день. Загляните завтра.</p>
            <div className="hz-hero-btns"><button className="gold" onClick={() => setQueue(null)}>Готово</button></div>
          </section>
        ) : (
          <div className="fwl-card">
            <span className="wd-dim">{cards[cur[0]] ? 'Повторение' : 'Новое слово'} · {KIND[cur[2]]} · {cur[3]} {plural(cur[3], 'раз', 'раза', 'раз')} в Коране</span>
            <div className="ar fwl-ar" dir="rtl">{cur[0]}</div>
            {shown ? (
              <>
                <div className="fwl-tr">{cur[4] || '—'}</div>
                <button className="fwl-ex" onClick={() => { const [s, a, w] = cur[5].split(':').map(Number); openWord({ s, a, w }) }}>
                  Пример в Коране: <span className="ar" dir="rtl">{cur[6]}</span> · {cur[5].split(':').slice(0, 2).join(':')}
                </button>
                <div className="fwl-btns">
                  <button onClick={() => answer(false)}>Не помню</button>
                  <button className="good" onClick={() => answer(true)}>Помню</button>
                </div>
              </>
            ) : (
              <button className="fwl-show" onClick={() => setShown(true)}>Показать значение</button>
            )}
          </div>
        )}
        <p className="wd-src">Разбор слов — Quranic Arabic Corpus (corpus.quran.com).</p>
      </div>
    )
  }

  // ===== главный экран раздела =====
  const total = today.due.length + today.fresh.length
  return (
    <div className="screen hz">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>Заучивание</b><span>Слова</span></div>
        <span className="icon-btn ghost"><Icon id="brain" /></span>
      </div>
      <HifzTabs on="words" />
      <section className="hz-hero">
        <span className="hz-hero-l">Сегодня</span>
        <b className="hz-hero-t">
          {total === 0
            ? 'На сегодня всё — машаАллах!'
            : [today.due.length ? `${today.due.length} на повтор` : '', today.fresh.length ? `${today.fresh.length} ${plural(today.fresh.length, 'новое', 'новых', 'новых')}` : ''].filter(Boolean).join(' · ')}
        </b>
        <p>Самые частые слова Корана — по порядку. Сто слов покрывают больше половины текста.</p>
        <div className="hz-hero-btns">
          {total > 0 && <button className="gold" onClick={start}><Icon id="brain" />Начать</button>}
        </div>
        <div className="hz-hero-stat">
          <span><b>{today.learned}</b> выучено</span>
          <span><b>{today.started - today.learned}</b> в повторении</span>
          <span>понимаете ≈ <b>{today.pct}%</b> слов Корана</span>
        </div>
      </section>
      <div className="group-t">Новых слов в день</div>
      <div className="fw-chips">
        {WORDS_PER_DAY.map((n) => <button key={n} className={perDay === n ? 'on' : ''} onClick={() => { setPerDay(n); saveWordsPerDay(n) }}>{n}</button>)}
      </div>
      <button className="srow2" style={{ marginTop: 10 }} onClick={() => nav('/words')}>
        <div>Все частые слова<span>Список с переводом, грамматика, понятия</span></div><Icon id="right" className="icon" />
      </button>
    </div>
  )
}
