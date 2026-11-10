import { WORD_PARSE } from '../store/wordSheet'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../lib/telegram'
import { Icon } from '../components/Icon'
import { PlayerSettings } from '../components/PlayerSettings'
import { Sheet, SheetHead, TabBar } from '../components/ui'
import { isNative, openBot, openSupport } from '../lib/telegram'
import { useProfile } from '../lib/profile'
import { RECITERS } from '../store/player'
import { ReciterList } from '../components/ReciterList'
import { NewsHistory } from '../components/WhatsNew'
import { useStore, type ThemePref, type Translation } from '../store/settings'

const TRANSLATIONS: Record<Translation, string> = { ku: 'Эльмир Кулиев', aa: 'Абу Адель' }
const THEMES: Record<ThemePref, string> = { auto: 'Как в Telegram', light: 'Светлая', dark: 'Тёмная' }

type Picker = null | 'tr' | 'rec' | 'theme' | 'font' | 'sources' | 'news'

export default function Settings() {
  const st = useStore()
  const nav = useNavigate()
  const pr = useProfile()
  const [open, setOpen] = useState<Picker>(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [vibOpen, setVibOpen] = useState(false)
  const close = () => setOpen(null)

  const Choice = <T extends string>({ title, items, value, onPick }: { title: string; items: Record<T, string>; value: T; onPick: (v: T) => void }) => (
    <Sheet onClose={close}>
      <SheetHead title={title} onClose={close} />
      <div className="body">
        {(Object.keys(items) as T[]).map((k) => (
          <button key={k} className="opt-row" onClick={() => { onPick(k); close() }}>
            <span>{items[k]}</span>{k === value && <Icon id="check" />}
          </button>
        ))}
      </div>
    </Sheet>
  )

  return (
    <div className="screen">
      <h1 className="page-title">Настройки</h1>
      <button className="list-item" onClick={() => nav('/profile')}>
        <div className="avatar">{pr.photo ? <img src={pr.photo} alt="" /> : pr.initial}</div>
        <div className="t"><b style={{ fontSize: 17 }}>{pr.first || 'Профиль'}</b><span>Профиль, план, статистика</span></div>
        <Icon id="right" className="icon" />
      </button>

      <div className="group-t">Чтение</div>
      <div className="group">
        <button className="sitem" onClick={() => setOpen('tr')}><span className="si" style={{ background: '#13704B' }}><Icon id="book" /></span><span className="t">Перевод</span><span className="v">{TRANSLATIONS[st.translation]}</span><Icon id="right" className="icon chev" /></button>
        <div className="sitem"><span className="si" style={{ background: '#2F7FD8' }}><Icon id="scroll" /></span><span className="t">Тафсир</span><span className="v">ас-Саади</span></div>
        <button className="sitem" onClick={() => setOpen('font')}><span className="si" style={{ background: '#9B59D0' }}><Icon id="font" /></span><span className="t">Размер шрифта</span><span className="v">{st.arSize} / {st.trSize}</span><Icon id="right" className="icon chev" /></button>
        <button className="sitem" onClick={() => st.set({ termHl: !st.termHl })}><span className="si" style={{ background: '#C9A24B' }}><Icon id="scroll" /></span><span className="t">Подсветка терминов</span><span className={'switch' + (st.termHl ? ' on' : '')} /></button>
        <button className="sitem" onClick={() => st.set({ tajweed: !st.tajweed })}><span className="si" style={{ background: '#E0663A' }}><Icon id="eye" /></span><span className="t">Цветной таджвид</span><span className={'switch' + (st.tajweed ? ' on' : '')} /></button>
      </div>

      <div className="group">
        {WORD_PARSE && <button className="sitem" onClick={() => nav('/words')}><span className="si" style={{ background: '#2F7FD8' }}><Icon id="font" /></span><span className="t">Слова Корана</span><span className="v">Частые слова</span><Icon id="right" className="icon chev" /></button>}
        {WORD_PARSE && <button className="sitem" onClick={() => nav('/meaning')}><span className="si" style={{ background: '#13704B' }}><Icon id="book" /></span><span className="t">Смысл Корана</span><span className="v">Темы, понятия</span><Icon id="right" className="icon chev" /></button>}
        <button className="sitem" onClick={() => nav('/reminders')}><span className="si" style={{ background: '#C0563B' }}><Icon id="bell" /></span><span className="t">Напоминания</span><span className="v">{Object.values(st.rem).some((r) => r.on) ? 'Включены' : 'Повтор, азкары, пятница'}</span><Icon id="right" className="icon chev" /></button>
        <button className="sitem" onClick={() => nav('/plan')}><span className="si" style={{ background: '#D9A441' }}><Icon id="star" /></span><span className="t">Личный план</span><span className="v">{st.plan ? 'Ваши шаги по очереди' : 'Пройти опрос'}</span><Icon id="right" className="icon chev" /></button>
      </div>

      <div className="group-t">Аудио</div>
      <div className="group">
        <button className="sitem" onClick={() => setOpen('rec')}><span className="si" style={{ background: '#C08A2E' }}><Icon id="sound" /></span><span className="t">Чтец</span><span className="v">{(RECITERS[st.reciter] ?? RECITERS.alafasy).name}</span><Icon id="right" className="icon chev" /></button>
        <button className="sitem" onClick={() => setPlayerOpen(true)}><span className="si" style={{ background: '#2F7D6B' }}><Icon id="play" /></span><span className="t">Плеер</span><span className="v">Скорость, таймер сна, пауза</span><Icon id="right" className="icon chev" /></button>
      </div>

      {isNative && (
        <div className="group">
          <button className="sitem" onClick={() => setVibOpen(true)}><span className="si" style={{ background: '#7A5AC8' }}><Icon id="bell" /></span><span className="t">Вибрация</span><span className="v">{st.hapAll ? 'Включена' : 'Выключена'}</span><Icon id="right" className="icon chev" /></button>
        </div>
      )}

      <div className="group-t">Без интернета</div>
      <div className="group">
        <button className="sitem" onClick={() => nav('/downloads')}><span className="si" style={{ background: '#13704B' }}><Icon id="download" /></span><span className="t">Загрузки</span><span className="v">Коран, страницы, аудио</span><Icon id="right" className="icon chev" /></button>
      </div>

      <div className="group-t">Приложение</div>
      <div className="group">
        <button className="sitem" onClick={() => setOpen('theme')}><span className="si" style={{ background: '#34495E' }}><Icon id="moon" /></span><span className="t">Тема</span><span className="v">{THEMES[st.theme]}</span><Icon id="right" className="icon chev" /></button>
        <button className="sitem" onClick={() => setOpen('sources')}><span className="si" style={{ background: '#5E6661' }}><Icon id="info" /></span><span className="t">Об источниках</span><Icon id="right" className="icon chev" /></button>
        <button className="sitem" onClick={() => setOpen('news')}><span className="si" style={{ background: '#C98A2B' }}><Icon id="bell" /></span><span className="t">Что нового</span><span className="v">История обновлений</span><Icon id="right" className="icon chev" /></button>
        {/* экскурсы по разделам покажутся снова при следующем заходе в каждый раздел */}
        <button className="sitem" onClick={() => { haptic.success(); st.set({ tours: [] }) }}>
          <span className="si" style={{ background: '#C98A2B' }}><Icon id="star" /></span>
          <span className="t">Показать подсказки снова</span>
          <span className="v">{st.tours.length ? '' : 'Покажутся в разделах'}</span>
        </button>
      </div>
      <div className="group-t">Связь с автором</div>
      <div className="group">
        <button className="sitem" onClick={() => { haptic.tap(); openBot('feedback') }}><span className="si" style={{ background: '#2F7FD8' }}><Icon id="share" /></span><span className="t">Написать автору</span><span className="v">Идеи и ошибки</span><Icon id="right" className="icon chev" /></button>
        <button className="sitem" onClick={() => { haptic.tap(); openSupport() }}><span className="si" style={{ background: '#C0504D' }}><Icon id="heart" /></span><span className="t">Поддержать проект</span><Icon id="right" className="icon chev" /></button>
      </div>
      <div className="ver">Коран и Сунна · версия 0.1</div>

      {open === 'tr' && <Choice title="Перевод смыслов" items={TRANSLATIONS} value={st.translation} onPick={(v) => st.set({ translation: v })} />}
      {playerOpen && <PlayerSettings onClose={() => setPlayerOpen(false)} />}
      {vibOpen && (
        <Sheet onClose={() => setVibOpen(false)}>
          <SheetHead title="Вибрация" sub="Отклик при листании и нажатиях" onClose={() => setVibOpen(false)} />
          <div className="body">
            <button className="srow2" onClick={() => st.set({ hapAll: !st.hapAll })}><div>Вибрация<span>Общий выключатель</span></div><span className={'switch' + (st.hapAll ? ' on' : '')} /></button>
            <div className="as-label">Где вибрировать</div>
            <button className="srow2" disabled={!st.hapAll} onClick={() => st.set({ hapAzkar: !st.hapAzkar })}><div>Азкары<span>Листание карточек и счётчик</span></div><span className={'switch' + (st.hapAll && st.hapAzkar ? ' on' : '')} /></button>
            <button className="srow2" disabled={!st.hapAll} onClick={() => st.set({ hapHadith: !st.hapHadith })}><div>Хадисы<span>Листание карточек</span></div><span className={'switch' + (st.hapAll && st.hapHadith ? ' on' : '')} /></button>
            <button className="srow2" disabled={!st.hapAll} onClick={() => st.set({ hapQuran: !st.hapQuran })}><div>Коран и тафсир<span>Страницы, линейка, аяты в тафсире</span></div><span className={'switch' + (st.hapAll && st.hapQuran ? ' on' : '')} /></button>
          </div>
        </Sheet>
      )}
      {open === 'rec' && (
        <Sheet onClose={close}>
          <SheetHead title="Чтец" sub="Сура звучит одной записью, без пауз между аятами" onClose={close} />
          <div className="body"><ReciterList onDone={close} /></div>
        </Sheet>
      )}
      {open === 'theme' && <Choice title="Тема" items={THEMES} value={st.theme} onPick={(v) => st.set({ theme: v })} />}
      {open === 'font' && (
        <Sheet onClose={close}>
          <SheetHead title="Размер шрифта" onClose={close} />
          <div className="body">
            <div className="fld"><label>Арабский текст</label>
              <div className="stepper"><small>{st.arSize} px</small><button onClick={() => st.set({ arSize: Math.max(20, st.arSize - 2) })}>−</button><b /><button onClick={() => st.set({ arSize: Math.min(44, st.arSize + 2) })}>+</button></div>
            </div>
            <div className="fld"><label>Перевод</label>
              <div className="stepper"><small>{st.trSize} px</small><button onClick={() => st.set({ trSize: Math.max(12, st.trSize - 1) })}>−</button><b /><button onClick={() => st.set({ trSize: Math.min(24, st.trSize + 1) })}>+</button></div>
            </div>
            <div className="ayah-day" style={{ marginTop: 8 }}>
              <div className="ar" style={{ fontSize: st.arSize }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
              <p style={{ fontSize: st.trSize, color: 'var(--text)' }}>Во имя Аллаха, Милостивого, Милосердного!</p>
            </div>
          </div>
        </Sheet>
      )}
      <BuildInfo />
      {open === 'news' && <NewsHistory onClose={close} />}
      {open === 'sources' && (
        <Sheet onClose={close}>
          <SheetHead title="Об источниках" onClose={close} />
          <div className="body ver" style={{ textAlign: 'left', fontSize: 14 }}>
            <p>• Текст Корана и шрифты мусхафа — Комплекс короля Фахда по изданию Корана (Медина), через Quran.com / QUL.</p>
            <p>• Переводы смыслов: Эльмир Кулиев; Абу Адель.</p>
            <p>• Тафсир ас-Саади (русский перевод) — Quran.com.</p>
            <p>• Аудио: цельные записи сур — Quran.com (quranicaudio.com) и mp3quran.net; отдельные аяты — everyayah.com.</p>
            <p>• Азкары «Крепость мусульманина» (Саид аль-Кахтани): тексты и перевод — открытая библиотека my-prayers/muslim-data (Apache-2.0); число повторов и аудио — hisnmuslim.com.</p>
            <p>• Комментарии к аятам, словарь арабских терминов и сведения о земных поклонах — из книги «Перевод смыслов Священного Корана» Э. Кулиева (издание Комплекса короля Фахда); краткое пояснение «История аята» — из книг по асбаб ан-нузуль, переведено с арабского с помощью ИИ.</p>
            <p>• Грамматический разбор слов (корни, формы, части речи) — Quranic Arabic Corpus (Kais Dukes), <a href="https://corpus.quran.com" target="_blank" rel="noreferrer">corpus.quran.com</a>; открытая копия с исправленными леммами — github.com/mustafa0x/quran-morphology. На нём построены «Слова Корана», разбор слова и частые слова.</p>
            <p>• Роль слова в предложении (ирааб) — The Quranic Treebank, <a href="https://github.com/NoorBayan/Quranic" target="_blank" rel="noreferrer">github.com/NoorBayan/Quranic</a> (лицензия MIT); русские названия ролей — наши.</p>
            <p>• «Понятия» (пророки, народы, места, животные, растения) — онтология Quranic Arabic Corpus, <a href="https://corpus.quran.com/ontology.jsp" target="_blank" rel="noreferrer">corpus.quran.com</a>; «Темы» — тематический указатель аятов Quranic Universal Library, <a href="https://qul.tarteel.ai" target="_blank" rel="noreferrer">qul.tarteel.ai</a>. Русские названия тем и понятий переведены с английского с помощью ИИ.</p>
            <p>• Хадисы: сборники «40 хадисов ан-Навави», «Рияд ас-Салихин» и «Сахих аль-Бухари» (арабский текст и перевод) — isnad.link; темы с объяснениями — «Энциклопедия переведённых пророческих хадисов» HadeethEnc.com.</p>
            <p>• 99 имён Аллаха: список и толкования — Са‘ид аль-Кахтани, «Толкование прекрасных имён Аллаха в свете Корана и Сунны» (пер. Э. Р. Кулиева), текст — «Библиотека Мусульманина», <a href="https://kitab.center/sharh-asma-qahtani" target="_blank" rel="noreferrer">kitab.center/sharh-asma-qahtani</a>.</p>
          </div>
        </Sheet>
      )}
      <TabBar />
    </div>
  )
}

declare const __BUILD_TIME__: string // время сборки (vite.config.ts)

/** Мелкая строка внизу настроек: какая сборка открыта и разрешены ли системой анимации. Помогает понять, что телефон показывает старую версию из кэша */
function BuildInfo() {
  const d = new Date(__BUILD_TIME__)
  const t = d.toLocaleString('ru-RU', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  return <p className="build-info">Сборка от {t}{calm ? ' · в телефоне включено «уменьшить анимацию»' : ''}</p>
}
