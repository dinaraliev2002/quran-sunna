import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { IconSprite } from './components/Icon'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PageTransition } from './components/PageTransition'
import { cleanupOldData } from './lib/net'
import { useWordHighlight } from './lib/wordSync'
import { useReminders } from './hooks/useReminders'
import Reminders from './screens/Reminders'
import Words from './screens/words/Words'
import { TermPop } from './screens/glossary/TermPop'
import { allowRotation, backButton, initTelegram, paintChrome, registerVisit, telegramScheme } from './lib/telegram'
import Azkar from './screens/azkar/Azkar'
import AzkarCategory from './screens/azkar/Category'
import AzkarChapter from './screens/azkar/Chapter'
import Hadith from './screens/hadith/Hadith'
import HadithBook from './screens/hadith/Book'
import HadithCollection from './screens/hadith/Collection'
import HadithEnc from './screens/hadith/EncHadith'
import HadithTopic from './screens/hadith/Topic'
import Hifz from './screens/hifz/Hifz'
import HifzSession from './screens/hifz/Session'
import QuranHifz from './screens/hifz/Quran'
import WordsHifz from './screens/hifz/Words'
import QuranSession from './screens/hifz/QuranSession'
import Home from './screens/Home'
import Names from './screens/names/Names'
import NameCard from './screens/names/NameCard'
import NamesLearn from './screens/names/Learn'
import Profile from './screens/Profile'
import Reader from './screens/reader/Reader'
import Downloads from './screens/Downloads'
import Settings from './screens/Settings'
import Stub from './screens/Stub'
import SurahList from './screens/SurahList'
import Stories from './screens/Stories'
import { Glossary, SajdaList } from './screens/Reference'
import { hydrateStore, useStore } from './store/settings'
import { OnboardingGate } from './screens/onboarding/Gate'
import Plan from './screens/Plan'
import { useUi } from './store/ui'

// разделы, где на телефоне можно читать в горизонтальном положении
const ROTATE = /^\/(read|stories|hadith\/|azkar\/(ch|cat)|glossary|sajda)/
const ROOTS = ['/', '/quran', '/azkar', '/hadith', '/names', '/settings']

function useTheme() {
  const pref = useStore((s) => s.theme)
  const [tgScheme, setTgScheme] = useState<'light' | 'dark' | null>(telegramScheme())
  const [sysDark, setSysDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => { initTelegram(setTgScheme); registerVisit() }, [])
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
  useEffect(() => allowRotation(ROTATE.test(loc.pathname)), [loc.pathname])
  return null
}

import { initPlayerSettings } from './lib/listen'
import { MiniPlayer } from './components/MiniPlayer'
import { QuickMenu } from './components/QuickMenu'
import { RemindAsk } from './components/RemindAsk'
import { WordSheet } from './screens/reader/word/WordSheet'

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  useTheme()
  useWordHighlight()
  useReminders()
  useEffect(() => { hydrateStore(); cleanupOldData(); initPlayerSettings() }, [])

  return (
    <HashRouter>
      <IconSprite />
      <TelegramBack />
      <MiniPlayer />
      {hydrated && <QuickMenu />}
      <WordSheet />
      <TermPop />
      {hydrated && <OnboardingGate />}
      {hydrated && <RemindAsk />}
      <div className="app">
        {hydrated && (
          <ErrorBoundary>
          <PageTransition>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quran" element={<SurahList />} />
            <Route path="/read/:surah" element={<Reader />} />
            <Route path="/stories/:surah" element={<Stories />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/sajda" element={<SajdaList />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/words" element={<Words key="words" section="words" />} />
            <Route path="/meaning" element={<Words key="meaning" section="meaning" />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/azkar" element={<Azkar />} />
            <Route path="/azkar/ch/:id" element={<AzkarChapter />} />
            <Route path="/azkar/cat/:id" element={<AzkarCategory />} />
            <Route path="/hadith" element={<Hadith />} />
            <Route path="/hadith/c/:cid" element={<HadithCollection />} />
            <Route path="/hadith/c/:cid/g/:g" element={<HadithCollection />} />
            <Route path="/hadith/c/:cid/:n" element={<HadithBook />} />
            <Route path="/hadith/t/:id" element={<HadithTopic />} />
            <Route path="/hadith/e/:id" element={<HadithEnc />} />
            <Route path="/hifz" element={<Hifz />} />
            <Route path="/hifz/learn" element={<HifzSession mode="learn" />} />
            <Route path="/hifz/review" element={<HifzSession mode="review" />} />
            <Route path="/hifz/quran" element={<QuranHifz />} />
            <Route path="/hifz/words" element={<WordsHifz />} />
            <Route path="/hifz/quran/learn" element={<QuranSession mode="learn" />} />
            <Route path="/hifz/quran/review" element={<QuranSession mode="review" />} />
            <Route path="/names" element={<Names />} />
            <Route path="/names/learn" element={<NamesLearn />} />
            <Route path="/names/:n" element={<NameCard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/notifications" element={<Stub title="Уведомления" icon="bell" text="Здесь будут напоминания и сообщения." />} />
            <Route path="*" element={<Home />} />
          </Routes>
          </PageTransition>
          </ErrorBoundary>
        )}
      </div>
    </HashRouter>
  )
}
