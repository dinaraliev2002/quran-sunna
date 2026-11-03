# Коран и Сунна — карта проекта

Приложение для чтения Корана, хадисов, азкаров и заучивания. Работает как Telegram Mini App и как приложение для Android/iOS (Capacitor).
Стек: React 19 + TypeScript + Vite, маршруты — react-router (HashRouter, `src/App.tsx`), состояние — zustand (`src/store`).
Весь код приложения — в `app/`. Документация и планы — в `docs/`.

## Где что лежит (`app/src`)

| Папка | Что там | Правило |
|---|---|---|
| `types/` | Модели данных (Surah, Ayah, Hadith, настройки…), один файл — одна тема | Только `type`/`interface`, без логики |
| `lib/` | Логика без интерфейса: загрузка данных, кэш, офлайн, заучивание, поиск | Не импортирует ничего из `screens/` и `components/` |
| `store/` | Общее состояние (zustand): `settings` (сохраняемые настройки), `player` (Коран-плеер), `azkarAudio`, `ui` | Логика состояния здесь, а не в экранах |
| `components/` | Общие куски интерфейса: `ui.tsx` (TabBar, Sheet, SurahRow), MiniPlayer, Icon, WhatsNew, Tour | Используются в нескольких разделах |
| `screens/` | Экраны по разделам | Экран показывает; вычисления и загрузку берёт из `lib/` и `store/` |
| `styles/` | `tokens.css` (цвета, отступы, темы), `app.css` (все стили) | Цвета только через токены |

### Разделы (`screens/`)
- `Home.tsx` — главная (аят дня, ежедневные дела); `SurahList.tsx` — список сур; `Settings.tsx`, `Profile.tsx`, `Downloads.tsx`, `Reference.tsx`
- `reader/` — чтение Корана: `Reader.tsx` (экран), `Pager.tsx` (листание мусхафа), `views.tsx` (сура, аят, пословный), `sheets.tsx` (нижние окна: меню, выбор суры, аят, закладки), `Asbab.tsx` (истории ниспослания), `Kuliev.tsx` + `KvFormat.tsx` (комментарии Кулиева), `TafsirText.tsx`, `Dial.tsx`
- `hadith/` — сборники → книги → хадисы, «Энциклопедия хадисов» (`Topic`, `EncHadith`), передатчики (`Narrators`), термины (`terms.ts`)
- `azkar/` — «Крепость мусульманина»: категории → главы → азкары
- `hifz/` — заучивание хадисов (`Hifz`, `Session`, `parts`) и Корана (`Quran`, `QuranSession`, `SplitEditor`)
- `names/` — 99 имён Аллаха и их заучивание
- `Stories.tsx`, `StoryMenu.tsx` — вкладка «Истории» (асбаб + Кулиев подряд)

## Данные
- `app/public/data/` — готовые JSON (quran, mushaf, wbw, tafsir, hadith, azkar, names, hifz, narrators, asbab, kuliev). Собираются скриптами из `app/scripts/` (`fetch-data.mjs`, `build-*.py`). Руками JSON не править — править скрипт и пересобрать.
- `asbab` и `kuliev` в git не попадают (авторские права) — см. `.gitignore`.
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
