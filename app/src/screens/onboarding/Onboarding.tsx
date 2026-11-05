import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { ReciterList } from '../../components/ReciterList'
import { Sheet, SheetHead } from '../../components/ui'
import { useQuranMeta } from '../../hooks/useQuranMeta'
import { fontVariant } from '../../lib/fonts'
import { knownCards } from '../../lib/knownSurahs'
import { KnownSurahsSheet } from '../hifz/quran/KnownSurahsSheet'
import { downloadAudio, downloadFonts } from '../../lib/offline'
import { buildPlan, DEFAULT_ANSWERS, perDay, type Goal, type PlanAnswers } from '../../lib/plan'
import { resizeAvatar, useProfile } from '../../lib/profile'
import { haptic } from '../../lib/telegram'
import { Capacitor } from '@capacitor/core'
import { RECITERS } from '../../store/player'
import { useStore } from '../../store/settings'
import { useUi } from '../../store/ui'
import { WORD_PARSE } from '../../store/wordSheet'
import './onboarding.css'

type Step = 'welcome' | 'profile' | 'quran' | 'hadith' | 'goals' | 'time' | 'plan' | 'download'
const STEPS: Step[] = ['welcome', 'profile', 'quran', 'hadith', 'goals', 'time', 'plan', 'download']
const isIos = Capacitor.getPlatform() === 'ios'

function Opt({ icon, title, sub, on, onClick }: { icon: ReactNode; title: string; sub?: string; on: boolean; onClick: () => void }) {
  return (
    <button className={'ob-opt' + (on ? ' on' : '')} onClick={() => { haptic.tap(); onClick() }}>
      <span className="ob-orb">{icon}</span>
      <span className="ob-t"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {on && <span className="ob-ok"><Icon id="check" /></span>}
    </button>
  )
}

/** Первый запуск: имя и фото → вопросы → личный план → что скачать сразу. Оформление — светлая «объёмная» карточка, как в макете B. */
export function Onboarding({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const nav = useNavigate()
  const meta = useQuranMeta()
  const theme = useUi((s) => s.theme)
  const pr = useProfile()
  const [i, setI] = useState(0)
  const [a, setA] = useState<PlanAnswers>(st.plan ?? DEFAULT_ANSWERS)
  const [name, setName] = useState(st.profName)
  const [photo, setPhoto] = useState(st.profPhoto)
  const [tajweed, setTajweed] = useState(isIos)
  const [audio, setAudio] = useState<'j30' | 'plan' | 'none'>('j30')
  const [rec, setRec] = useState(false)
  const [knownOpen, setKnownOpen] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const step = STEPS[i]
  const plan = buildPlan(a)
  const shownPhoto = photo || pr.photo

  const skip = () => { st.set({ obSeen: true }); onClose() }
  const next = () => { haptic.tap(); setI((n) => Math.min(STEPS.length - 1, n + 1)) }
  const back = () => { haptic.tap(); setI((n) => Math.max(0, n - 1)) }
  const toggleGoal = (g: Goal) => setA((x) => ({ ...x, goals: x.goals.includes(g) ? x.goals.filter((y) => y !== g) : [...x.goals, g] }))

  const finish = () => {
    haptic.success()
    st.set({ obDone: true, obSeen: true, plan: a, hzPerDay: perDay(a.minutes), profName: name.trim().slice(0, 40), profPhoto: photo })
    // скачивание идёт в фоне, прогресс — в Настройки → Загрузки
    const jobs: (() => Promise<unknown>)[] = []
    // суры, которые человек отметил как заученные, становятся карточками заучивания
    const known = a.quran === 'custom' ? a.known ?? [] : []
    if (known.length) jobs.push(() => knownCards(known).then((c) => st.qhMarkKnown(known, c)))
    if (tajweed) jobs.push(() => downloadFonts(fontVariant(true, theme)))
    if (audio !== 'none' && meta) {
      const ids = new Set(audio === 'j30' ? meta.surahs.filter((s) => s.id >= 78).map((s) => s.id) : plan.flatMap((p) => p.surahs ?? []))
      const list = meta.surahs.filter((s) => ids.has(s.id))
      if (list.length) jobs.push(() => downloadAudio(st.reciter, list, 'Аудио из плана'))
    }
    jobs.reduce((p, j) => p.then(j).catch(() => {}), Promise.resolve<unknown>(undefined))
    onClose()
    nav('/')
  }

  const hero = step === 'welcome'
  const progress = Math.round((i / (STEPS.length - 1)) * 100)
  const pace = perDay(a.minutes)

  return (
    <div className="ob" data-step={step}>
      {hero ? (
        <>
          <div className="ob-blob b1" /><div className="ob-blob b2" />
          <div className="ob-card3d"><span>قرآن</span></div>
          <div className="ob-hero-t">
            <h1>Коран и Сунна<br />рядом каждый день</h1>
            <p>Читайте, слушайте и заучивайте. Расскажите о себе, и мы составим личный план.</p>
          </div>
          <div className="ob-foot">
            <button className="ob-btn" onClick={next}>Начать</button>
            <button className="ob-skip" onClick={skip}>Пропустить</button>
          </div>
        </>
      ) : (
        <>
          <div className="ob-top">
            <button className="ob-back" onClick={back} aria-label="Назад"><Icon id="back" /></button>
            <div className="ob-bar"><i style={{ width: progress + '%' }} /></div>
            <button className="ob-skip sm" onClick={skip}>Пропустить</button>
          </div>
          <div className="ob-body">
            {step === 'profile' && (
              <>
                <h2>Как вас зовут?</h2>
                <p className="ob-p">Имя и фото можно изменить позже в профиле</p>
                <div className="ob-ava">
                  <button className="ob-avabtn" onClick={() => file.current?.click()} aria-label="Выбрать фото">
                    {shownPhoto ? <img src={shownPhoto} alt="" /> : (name.trim()[0] ?? pr.initial).toUpperCase()}
                    <span className="ob-cam"><Icon id="plus" /></span>
                  </button>
                  <input ref={file} type="file" accept="image/*" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) resizeAvatar(f).then(setPhoto).catch(() => {}); e.target.value = '' }} />
                </div>
                <input className="ob-input" value={name} maxLength={40} placeholder="Ваше имя" onChange={(e) => setName(e.target.value)} />
              </>
            )}
            {step === 'quran' && (
              <>
                <h2>Что вы уже знаете из Корана?</h2>
                <p className="ob-p">Это поможет выбрать, с чего начать</p>
                <div className="ob-opts">
                  <Opt icon="0" title="Пока ничего" sub="Начнём с самого простого" on={a.quran === 'none'} onClick={() => setA({ ...a, quran: 'none' })} />
                  <Opt icon={<Icon id="check" />} title="Короткие суры" sub="Аль-Фатиха, Аль-Ихлас…" on={a.quran === 'short'} onClick={() => setA({ ...a, quran: 'short' })} />
                  <Opt icon="30" title="Часть джуза 30" sub="Несколько сур для намаза" on={a.quran === 'j30'} onClick={() => setA({ ...a, quran: 'j30' })} />
                  <Opt icon="+" title="Больше" sub="Продолжу с того места" on={a.quran === 'more'} onClick={() => setA({ ...a, quran: 'more' })} />
                  <Opt icon={<Icon id="rows" />} title="Выберу сам" sub={a.quran === 'custom' && a.known?.length ? `Отмечено сур: ${a.known.length}` : 'Отмечу суры, которые знаю наизусть'} on={a.quran === 'custom'} onClick={() => setKnownOpen(true)} />
                </div>
              </>
            )}
            {step === 'hadith' && (
              <>
                <h2>А хадисы?</h2>
                <p className="ob-p">Сколько хадисов вы уже знаете</p>
                <div className="ob-opts">
                  <Opt icon="0" title="Пока ничего" on={a.hadith === 'none'} onClick={() => setA({ ...a, hadith: 'none' })} />
                  <Opt icon={<Icon id="scroll" />} title="Несколько хадисов" sub="Знаю отдельные" on={a.hadith === 'few'} onClick={() => setA({ ...a, hadith: 'few' })} />
                  <Opt icon="40" title="40 хадисов ан-Навави" sub="Частично или полностью" on={a.hadith === 'nawawi'} onClick={() => setA({ ...a, hadith: 'nawawi' })} />
                </div>
              </>
            )}
            {step === 'goals' && (
              <>
                <h2>Что хотите учить?</h2>
                <p className="ob-p">Можно выбрать несколько</p>
                <div className="ob-opts">
                  <Opt icon={<Icon id="book" />} title="Коран" sub="Суры и аяты" on={a.goals.includes('quran')} onClick={() => toggleGoal('quran')} />
                  <Opt icon={<Icon id="scroll" />} title="Хадисы" sub="40 хадисов, Рияд ас-Салихин" on={a.goals.includes('hadith')} onClick={() => toggleGoal('hadith')} />
                  {WORD_PARSE && <Opt icon={<Icon id="font" />} title="Арабские слова" sub="100 самых частых слов — чтобы лучше понимать Коран" on={a.goals.includes('words')} onClick={() => toggleGoal('words')} />}
                  <Opt icon={<Icon id="star" />} title="99 имён Аллаха" sub="Значения и заучивание" on={a.goals.includes('names')} onClick={() => toggleGoal('names')} />
                  <Opt icon={<Icon id="hands" />} title="Азкары" sub="Утренние и вечерние" on={a.goals.includes('azkar')} onClick={() => toggleGoal('azkar')} />
                </div>
              </>
            )}
            {step === 'time' && (
              <>
                <h2>Сколько времени в день?</h2>
                <p className="ob-p">Небольшое время каждый день лучше, чем много раз в неделю</p>
                <div className="ob-opts">
                  {([[5, 'Немного, но каждый день'], [10, 'Спокойный темп'], [20, 'Хороший темп'], [30, 'Серьёзно настроен']] as const).map(([m, s]) => (
                    <Opt key={m} icon={m} title={m === 30 ? '30 минут и больше' : `${m} минут`} sub={s} on={a.minutes === m} onClick={() => setA({ ...a, minutes: m })} />
                  ))}
                </div>
              </>
            )}
            {step === 'plan' && (
              <>
                <h2>Ваш личный план</h2>
                <p className="ob-p">Идём по очереди. Когда закрепите шаг, переходите к следующему. Примерно {pace} {pace === 1 ? 'новый аят или хадис' : 'новых аята или хадиса'} в день.</p>
                <div className="ob-plan">
                  {plan.length === 0 && <div className="ob-empty">Выберите, что учить, на предыдущем шаге</div>}
                  {plan.map((p, n) => (
                    <div key={n} className="ob-step">
                      <span className="ob-orb">{n + 1}</span>
                      <span className="ob-t"><b>{p.title}</b><small>{p.sub}</small></span>
                    </div>
                  ))}
                </div>
                <p className="ob-note">План можно изменить в Настройки → Личный план</p>
              </>
            )}
            {step === 'download' && (
              <>
                <h2>Что скачать сразу?</h2>
                <p className="ob-p">Всё необязательно. Остальное можно скачать позже в Настройки → Загрузки.</p>
                <div className="ob-opts">
                  {isIos && (
                    <Opt icon={<Icon id="eye" />} title="Цветной таджвид" sub="Около 185 МБ для текущей темы" on={tajweed} onClick={() => setTajweed(!tajweed)} />
                  )}
                  <button className="ob-opt" onClick={() => { haptic.tap(); setRec(true) }}>
                    <span className="ob-orb"><Icon id="sound" /></span>
                    <span className="ob-t"><b>Чтец</b><small>{(RECITERS[st.reciter] ?? RECITERS.alafasy).name}</small></span>
                    <span className="ob-chev"><Icon id="right" /></span>
                  </button>
                </div>
                <div className="ob-label">Аудио для этого чтеца</div>
                <div className="ob-pills">
                  {([['j30', 'Джуз 30'], ['plan', 'Суры из плана'], ['none', 'Не нужно']] as const).map(([k, l]) => (
                    <button key={k} className={audio === k ? 'on' : ''} onClick={() => { haptic.tap(); setAudio(k) }}>{l}</button>
                  ))}
                </div>
                <p className="ob-note">Лучше скачивать по Wi‑Fi. Прогресс виден в Настройки → Загрузки.</p>
              </>
            )}
          </div>
          <div className="ob-foot">
            {step === 'download' ? <button className="ob-btn" onClick={finish}>Готово</button> : <button className="ob-btn" onClick={next}>Далее</button>}
          </div>
        </>
      )}
      {knownOpen && meta && (
        <KnownSurahsSheet surahs={meta.surahs} initial={a.known ?? []} onClose={() => setKnownOpen(false)}
          onSave={(ids) => { setA({ ...a, quran: ids.length ? 'custom' : 'none', known: ids }); setKnownOpen(false) }} />
      )}
      {rec && (
        <Sheet onClose={() => setRec(false)} tall>
          <SheetHead title="Чтец и качество" onClose={() => setRec(false)} />
          <div className="body"><ReciterList onDone={() => setRec(false)} /></div>
        </Sheet>
      )}
    </div>
  )
}
