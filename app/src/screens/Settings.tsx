import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Sheet, SheetHead, TabBar } from '../components/ui'
import { tgUser } from '../lib/telegram'
import { RECITERS } from '../store/player'
import { useStore, type ThemePref, type Translation } from '../store/settings'

const TRANSLATIONS: Record<Translation, string> = { ku: 'Эльмир Кулиев', aa: 'Абу Адель' }
const THEMES: Record<ThemePref, string> = { auto: 'Как в Telegram', light: 'Светлая', dark: 'Тёмная' }

type Picker = null | 'tr' | 'rec' | 'theme' | 'font' | 'sources'

export default function Settings() {
  const st = useStore()
  const nav = useNavigate()
  const user = tgUser()
  const [open, setOpen] = useState<Picker>(null)
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
        <div className="avatar">{user?.photo_url ? <img src={user.photo_url} alt="" /> : (user?.first_name?.[0] ?? 'А')}</div>
        <div className="t"><b style={{ fontSize: 17 }}>{user?.first_name ?? 'Профиль'}</b><span>Профиль, план, статистика</span></div>
        <Icon id="right" className="icon" />
      </button>

      <div className="group-t">Чтение</div>
      <div className="group">
        <button className="sitem" onClick={() => setOpen('tr')}><span className="si" style={{ background: '#1F8A5B' }}><Icon id="book" /></span><span className="t">Перевод</span><span className="v">{TRANSLATIONS[st.translation]}</span><Icon id="right" className="icon chev" /></button>
        <div className="sitem"><span className="si" style={{ background: '#2F7FD8' }}><Icon id="scroll" /></span><span className="t">Тафсир</span><span className="v">ас-Саади</span></div>
        <button className="sitem" onClick={() => setOpen('font')}><span className="si" style={{ background: '#9B59D0' }}><Icon id="font" /></span><span className="t">Размер шрифта</span><span className="v">{st.arSize} / {st.trSize}</span><Icon id="right" className="icon chev" /></button>
        <button className="sitem" onClick={() => st.set({ tajweed: !st.tajweed })}><span className="si" style={{ background: '#E0663A' }}><Icon id="eye" /></span><span className="t">Цветной таджвид</span><span className={'switch' + (st.tajweed ? ' on' : '')} /></button>
      </div>

      <div className="group-t">Аудио</div>
      <div className="group">
        <button className="sitem" onClick={() => setOpen('rec')}><span className="si" style={{ background: '#C08A2E' }}><Icon id="sound" /></span><span className="t">Чтец</span><span className="v">{(RECITERS[st.reciter] ?? RECITERS.alafasy).name}</span><Icon id="right" className="icon chev" /></button>
      </div>

      <div className="group-t">Без интернета</div>
      <div className="group">
        <button className="sitem" onClick={() => nav('/downloads')}><span className="si" style={{ background: '#1F8A5B' }}><Icon id="download" /></span><span className="t">Загрузки</span><span className="v">Коран, страницы, аудио</span><Icon id="right" className="icon chev" /></button>
      </div>

      <div className="group-t">Приложение</div>
      <div className="group">
        <button className="sitem" onClick={() => setOpen('theme')}><span className="si" style={{ background: '#34495E' }}><Icon id="moon" /></span><span className="t">Тема</span><span className="v">{THEMES[st.theme]}</span><Icon id="right" className="icon chev" /></button>
        <button className="sitem" onClick={() => setOpen('sources')}><span className="si" style={{ background: '#5E6661' }}><Icon id="info" /></span><span className="t">Об источниках</span><Icon id="right" className="icon chev" /></button>
      </div>
      <div className="ver">Коран и Сунна · версия 0.1</div>

      {open === 'tr' && <Choice title="Перевод смыслов" items={TRANSLATIONS} value={st.translation} onPick={(v) => st.set({ translation: v })} />}
      {open === 'rec' && <Choice title="Чтец" items={Object.fromEntries(Object.entries(RECITERS).map(([k, r]) => [k, r.name]))} value={st.reciter} onPick={(v) => st.set({ reciter: v })} />}
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
      {open === 'sources' && (
        <Sheet onClose={close}>
          <SheetHead title="Об источниках" onClose={close} />
          <div className="body ver" style={{ textAlign: 'left', fontSize: 14 }}>
            <p>• Текст Корана и шрифты мусхафа — Комплекс короля Фахда по изданию Корана (Медина), через Quran.com / QUL.</p>
            <p>• Переводы смыслов: Эльмир Кулиев; Абу Адель.</p>
            <p>• Тафсир ас-Саади (русский перевод) — Quran.com.</p>
            <p>• Аудио: everyayah.com, зеркало quranicaudio.com.</p>
          </div>
        </Sheet>
      )}
      <TabBar />
    </div>
  )
}
