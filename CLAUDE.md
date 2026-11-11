# Коран и Сунна — карта проекта

Приложение для чтения Корана, хадисов, азкаров и заучивания. Работает как Telegram Mini App и как приложение для Android/iOS (Capacitor).
Стек: React 19 + TypeScript + Vite, маршруты — react-router (HashRouter, `src/App.tsx`), состояние — zustand (`src/store`).
Весь код приложения — в `app/`. Документация и планы — в `docs/`.

## Где что лежит (`app/src`)

| Папка | Что там | Правило |
|---|---|---|
| `types/` | Модели данных: `quran`, `hadith`, `azkar`, `names`, `hifz`, `hifzQuran`, `asbab`, `kuliev`, `narrators`, `news`, `player`, `settings` | Только `type`/`interface`, без логики. Старые файлы (`lib/data`, `store/settings`…) пересылают типы — новые импорты брать прямо из `types/` |
| `lib/` | Логика без интерфейса: загрузка данных, кэш, офлайн, заучивание, поиск, передатчики (`narrators`), новости (`news`), раскладка мусхафа (`mushafLayout`), `plural` | Не импортирует ничего из `screens/` и `components/` |
| `hooks/` | Связка логики с экраном (то, что в SwiftUI называют ViewModel): `useQuranMeta`, `useWbw`, `useQuranHifz`, `useLastRead`, `usePageReadTimer`, `useFlashAyah`, `useNarratorLink`, жесты (`useSideSwipe`, `useSwipeToClose`, `useScrollThumb`, `useLandscape`) | Хук не рисует, только данные и поведение |
| `store/` | Общее состояние (zustand): `settings` (сохраняемые настройки), `player` (Коран-плеер), `azkarAudio`, `ui` | Логика состояния здесь, а не в экранах |
| `components/` | Общие куски интерфейса: `ui/` (TabBar, SurahRow, Sheet, SheetHead — по файлу), MiniPlayer, Icon, WhatsNew, Tour | Используются в нескольких разделах |
| `screens/` | Экраны по разделам | Экран показывает; вычисления и загрузку берёт из `lib/`, `hooks/` и `store/` |
| `styles/` | `tokens.css` (цвета, отступы, темы), `app.css` (все стили) | Цвета только через токены |

### Разделы (`screens/`)
- `Home.tsx` — главная (аят дня, ежедневные дела); `SurahList.tsx` — список сур; `Settings.tsx`, `Profile.tsx`, `Downloads.tsx`, `Reference.tsx`
- `reader/` — чтение Корана: `Reader.tsx` (экран), `Pager.tsx` (листание), `views/` (QpcText, AyahBlock, SuraView, PageAyahs, MushafView, AyahWords… — по файлу), `sheets/` (нижние окна: ModePop, MenuPanel, PickerSheet, MemoSheet, AyahSheet, LearnMenu, BookmarksSheet, ReaderSettingsSheet — по файлу), `MemoBar.tsx`, `tour.ts`, `Asbab.tsx` (истории ниспослания), `Kuliev.tsx` + `KvFormat.tsx` (комментарии Кулиева), `TafsirText.tsx`, `Dial.tsx`. Папки `views/` и `sheets/` импортируются через свой `index.ts`
- `hadith/` — сборники → книги → хадисы, «Энциклопедия хадисов» (`Topic`, `EncHadith`), передатчики (`Narrators`), термины (`terms.ts`)
- `azkar/` — «Крепость мусульманина»: категории → главы → азкары
- `hifz/` — заучивание хадисов (`Hifz`, `Session`, `parts`, `SplitEditor`) и Корана: `Quran.tsx` + окна в `quran/` (цель, наборы, «Мой набор», выбор суры), `QuranSession.tsx` + части урока в `session/` (новое, повторение, прослушивание, по памяти, настройки, итог)
- `names/` — 99 имён Аллаха и их заучивание
- `Stories.tsx`, `StoryMenu.tsx` — вкладка «Истории» (асбаб + Кулиев подряд)

## Данные
- `app/public/data/` — готовые JSON (quran, mushaf, wbw, tafsir, hadith, azkar, names, hifz, narrators, asbab, kuliev). Собираются скриптами из `app/scripts/` (`fetch-data.mjs`, `build-*.py`). Руками JSON не править — править скрипт и пересобрать.
- `asbab` и `kuliev` в git не попадают (авторские права) — см. `.gitignore`.
- Аудио чтецов — цельные записи сур (без пауз на стыках аятов) + разметка `public/data/recite/` (`lib/recite.ts`, плеер `store/player.ts`). Пересборка: `node scripts/fetch-recitations.mjs [чтец]`, затем **обязательно** `python -I scripts/align-recitation.py` для Даусари 36, для Джухани и Сувейда (`all --write --clean`) и для Шатри, Хусари, Шурайма (`all --write --clean --shift-words`: играют сплошные записи mp3quran, слова переносятся из разметки Quran.com) — иначе разметка затрётся. Записи-«склейки» из файлов аятов (тишина на стыках = микропрерывы) не брать: проверять, что на стыках аятов нет участков нулей. **Афаси — исключение (с 12.11.2026):** запись qdc 173 звучит с эхом, поэтому он играет файлами аятов everyayah (`Alafasy_128kbps`), поставленными встык через Web Audio с обрезкой тишины (`lib/glueAudio.ts`, флаг `glue` в `RECITERS`); слова — `public/data/timing/alafasy` (Quran.com 7, время от начала файла аята); загрузки — `ayah:alafasy:NNN:AAA` + отметка `sura:`; на iPhone, в заучивании и при скорости ≠1 играют сами файлы. Разметку `recite/alafasy` и `align-recitation.py` для него не запускать. Без разметки (Муайкли) сура играет целиком с начала, а с середины и в заучивании — файлы аятов everyayah.
- На телефоне: кэш в IndexedDB (`lib/idb.ts`, `lib/net.ts`), загрузки для офлайна — `lib/offline.ts`.

## Команды (в `app/`)
- `npm run dev` — разработка; `npm run build` — проверка типов + сборка (запускать перед каждым коммитом)
- `npm run deploy:test` — тестовая версия; `npm run release` — выпуск
- `npm run sync` — сборка + перенос в android/ios; сборка для магазинов — Codemagic (`codemagic.yaml`, `docs/04-stores.md`)

## Правила для кода
1. **Один файл — одна задача.** Файл больше ~400 строк — повод разделить. Новый компонент — новый файл в папке своего раздела.
2. **Интерфейс отдельно от логики.** Загрузка, расчёты, работа с хранилищем — в `lib/` или `store/` (или в хуке `useXxx`), экран только показывает и вызывает.
3. **Типы данных — в `src/types/`**, понятные имена.
4. **Комментарии и тексты интерфейса — по-русски**, как в остальном коде.
5. После каждого готового и проверенного шага (`npm run build` проходит) — коммит с понятным русским описанием.
