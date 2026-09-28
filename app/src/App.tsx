import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { IconSprite } from './components/Icon'
import { cleanupOldData } from './lib/net'
import { backButton, initTelegram, paintChrome, telegramScheme } from './lib/telegram'
import Home from './screens/Home'
import Reader from './screens/reader/Reader'
import Downloads from './screens/Downloads'
import Settings from './screens/Settings'
import Stub from './screens/Stub'
import SurahList from './screens/SurahList'
import { hydrateStore, useStore } from './store/settings'
import { useUi } from './store/ui'

const ROOTS = ['/', '/quran', '/azkar', '/settings']

function useTheme() {
  const pref = useStore((s) => s.theme)
  const [tgScheme, setTgScheme] = useState<'light' | 'dark' | null>(telegramScheme())
  const [sysDark, setSysDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => { initTelegram(setTgScheme) }, [])
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSysDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const theme = pref !== 'auto' ? pref : tgScheme ?? (sysDark ? 'dark' : 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    useUi.setState({ theme })
    paintChrome(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())
  }, [theme])
}

function TelegramBack() {
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => backButton(!ROOTS.includes(loc.pathname), () => nav(-1)), [loc.pathname, nav])
  return null
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  useTheme()
  useEffect(() => { hydrateStore(); cleanupOldData() }, [])

  return (
    <HashRouter>
      <IconSprite />
      <TelegramBack />
      <div className="app">
        {hydrated && (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quran" element={<SurahList />} />
            <Route path="/read/:surah" element={<Reader />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/azkar" element={<Stub title="Азкары" icon="hands" text="«Крепость мусульманина» — следующий раздел, который мы сделаем." />} />
            <Route path="/hadith" element={<Stub title="Хадисы" icon="scroll" text="Сборники хадисов появятся после раздела азкаров." />} />
            <Route path="/names" element={<Stub title="99 имён Аллаха" icon="star" text="Раздел в работе." />} />
            <Route path="/profile" element={<Stub title="Профиль" icon="flame" text="Профиль, анкета и план заучивания — в следующих версиях." />} />
            <Route path="/notifications" element={<Stub title="Уведомления" icon="bell" text="Здесь будут напоминания и сообщения." />} />
            <Route path="*" element={<Home />} />
          </Routes>
        )}
      </div>
    </HashRouter>
  )
}
