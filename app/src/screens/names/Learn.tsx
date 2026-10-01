import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { loadNames, shortMeaning, shuffle, type AllahName, type NamesData } from '../../lib/names'
import { haptic } from '../../lib/telegram'
import { useStore } from '../../store/settings'
import { Translit } from './Names'

const QUIZ_LEN = 10

// Заучивание имён:
//  • «Карточки» — имя → тап переворачивает → значение; «Знаю» отмечает выученным, «Повторить» — вернёт в конец колоды;
//  • «Тест» — 10 вопросов: имя и 4 варианта значения; верный ответ отмечает имя выученным, ошибка — снимает отметку.
export default function Learn() {
  const nav = useNavigate()
  const [search] = useSearchParams()
  const mode = search.get('mode') === 'quiz' ? 'quiz' : 'cards'
  const [data, setData] = useState<NamesData | null>(null)
  useEffect(() => { loadNames().then(setData) }, [])

  return (
    <div className="nml">
      <div className="azc-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад"><Icon id="back" /></button>
        <div className="ttl"><b>{mode === 'quiz' ? 'Тест' : 'Карточки'}</b><span>99 имён Аллаха</span></div>
        <span style={{ width: 44 }} />
      </div>
      {!data ? <div className="loading">Загрузка…</div> : mode === 'quiz' ? <Quiz names={data.names} /> : <Cards names={data.names} />}
    </div>
  )
}

/** Колода: сначала невыученные; если выучены все — повторение всех */
function useDeck(names: AllahName[]) {
  const learned = useStore.getState().learned
  return useMemo(() => {
    const fresh = names.filter((n) => !learned.includes(n.n))
    return shuffle(fresh.length ? fresh : names)
  }, [names])
}

function Cards({ names }: { names: AllahName[] }) {
  const initial = useDeck(names)
  const [deck, setDeck] = useState(initial)
  const [flip, setFlip] = useState(false)
  const [known, setKnown] = useState(0)
  const setLearned = useStore((s) => s.setLearned)
  const card = deck[0]

  const answer = (know: boolean) => {
    haptic.tap()
    if (know) { setLearned(card.n, true); setKnown((k) => k + 1); setDeck((d) => d.slice(1)) }
    else setDeck((d) => [...d.slice(1), d[0]])
    setFlip(false)
  }
  if (!card) return <Done text={`Колода пройдена · запомнено ${known}`} />
  return (
    <div className="nml-body">
      <div className="nml-count">Осталось {deck.length} · запомнено {known}</div>
      <button className={'nml-card' + (flip ? ' flip' : '')} onClick={() => { haptic.tick(); setFlip(!flip) }}>
        <div className="face front">
          <span className="nm-no-big">{card.n}</span>
          <div className="nmc-ar">{card.ar}</div>
          <div className="nmc-tr"><Translit name={card} /></div>
          <small>Нажмите, чтобы увидеть значение</small>
        </div>
        <div className="face back">
          <div className="nmc-tr"><Translit name={card} /></div>
          <div className="nml-mean">{card.ru}</div>
          <small>{card.ar}</small>
        </div>
      </button>
      <div className="nml-btns">
        <button className="again" onClick={() => answer(false)}><Icon id="repeat" />Повторить</button>
        <button className="know" onClick={() => answer(true)}><Icon id="check" />Знаю</button>
      </div>
    </div>
  )
}

function Quiz({ names }: { names: AllahName[] }) {
  const deck = useDeck(names)
  const [qs] = useState(() => deck.slice(0, QUIZ_LEN).map((n) => {
    // варианты: значения других имён, не совпадающие по смыслу
    const others = shuffle(names.filter((x) => shortMeaning(x.ru) !== shortMeaning(n.ru))).slice(0, 3)
    return { n, options: shuffle([n, ...others]) }
  }))
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const setLearned = useStore((s) => s.setLearned)
  const q = qs[i]

  if (!q) return <Done text={`Правильных ответов: ${score} из ${qs.length}`} />
  const pick = (o: AllahName) => {
    if (picked !== null) return
    const ok = o.n === q.n.n
    setPicked(o.n)
    setLearned(q.n.n, ok)
    if (ok) { setScore((s) => s + 1); haptic.success() } else haptic.tap()
  }
  return (
    <div className="nml-body">
      <div className="nml-count">Вопрос {i + 1} из {qs.length} · верно {score}</div>
      <div className="nml-q">
        <div className="nmc-ar">{q.n.ar}</div>
        <div className="nmc-tr"><Translit name={q.n} /></div>
      </div>
      <div className="nml-opts">
        {q.options.map((o) => {
          const state = picked === null ? '' : o.n === q.n.n ? ' ok' : o.n === picked ? ' bad' : ' off'
          return <button key={o.n} className={state} onClick={() => pick(o)}>{o.ru}</button>
        })}
      </div>
      {picked !== null && <button className="bigbtn nml-next" onClick={() => { setPicked(null); setI(i + 1) }}>{i + 1 < qs.length ? 'Дальше' : 'Результат'}<Icon id="right" /></button>}
    </div>
  )
}

function Done({ text }: { text: string }) {
  const nav = useNavigate()
  const learned = useStore((s) => s.learned.length)
  return (
    <div className="nml-body nml-done">
      <div className="nm-ring big">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" className="bg" /><circle cx="32" cy="32" r="27" className="fg" strokeDasharray={169.6} strokeDashoffset={169.6 * (1 - learned / 99)} transform="rotate(-90 32 32)" /></svg>
        <span>{learned}</span>
      </div>
      <b>{text}</b>
      <span>Всего выучено {learned} из 99</span>
      <button className="bigbtn" onClick={() => nav(-1)}>Готово</button>
    </div>
  )
}
