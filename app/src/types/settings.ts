// Настройки и прогресс пользователя
import type { SetId } from './hifz'

export type ReadMode = 'mushaf' | 'page' | 'sura'

export type Translation = 'ku' | 'aa'

export type ThemePref = 'auto' | 'light' | 'dark'

export interface LastRead { s: number; a: number; p: number }

/** Ежедневные дела на главной */
export type TaskId = 'read' | 'morning' | 'evening' | 'memo'

export interface Settings {
  /** пройденные экскурсы по разделам (подсказки показываются один раз) */
  tours: string[]
  mode: ReadMode
  translation: Translation
  reciter: string
  /** закладки в «Историях»: отрывки «сура:первый аят» */
  storyMarks: string[]
  tajweed: boolean
  /** пословный перевод в чтении (режимы «Страница» и «Сура») */
  wbw: boolean
  arSize: number
  trSize: number
  theme: ThemePref
  // азкары
  azArSize: number
  azTrSize: number
  azShowAr: boolean
  azShowTr: boolean
  azShowRef: boolean
  azAuto: boolean // после последнего повтора — сама к следующей карточке
  azFont: 'sch' | 'hafs' | 'amiri' // шрифт арабского текста азкаров
  // хадисы
  hdArSize: number
  hdTrSize: number
  hdAr: boolean
  termHl: boolean // подсветка терминов в комментариях
  quickTabY: number // высота язычка боковой панели, % экрана (его можно двигать вверх-вниз)
  quickHidden: string[] // какие пункты скрыты в боковой панели разделов (QuickMenu)
  ayahBlocks: AyahBlocks // что показывать в окне аята (перевод и тафсир — всегда)
  // заучивание
  hzPerDay: number // план: новых хадисов в день
  nrSrc: boolean // цепочка передатчиков: показывать строку об источниках данных внизу окна
  hdBukhari: 'main' | 'sharkasi' // чья версия «Сахиха» аль-Бухари в разделе «Хадисы»: основная (isnad.link) или перевод аш-Шаркаси
  hzDrills: boolean // упражнения при заучивании: общий выключатель
  hzDrillSet: string[] // какие упражнения проходить: gap3 — каждое третье слово, gap2 — половина слов, gap1 — все слова, build — сборка из кусочков
  hzAr: boolean // показывать арабский текст при чтении
  hzVoicePass: number // проверка голосом: сколько % считать «выучено»
  hzVoiceLang: 'ru' | 'ar' // проверка голосом: рассказывать хадис по-русски (перевод) или по-арабски
  hzHarakat: boolean // проверка голосом по-арабски: другая огласовка (гласная, удвоение) — ошибка; работает, если распознавание пишет огласовки (Gemini)
  hzVoiceNarr: boolean // проверка голосом: проверять и слова передатчика
  hzVoiceModel: 'full' | 'turbo' // облачная модель: полная Whisper large-v3 (точнее) или turbo (быстрее, дешевле)
  hzVoiceEngine: 'cloud' | 'system' // проверка голосом: облачное распознавание (Groq) или системное
  hzVoiceAi: boolean // проверка голосом: ИИ засчитывает спорные слова (перестановка, ошибка распознавания)
  hzVoiceLoose: boolean // проверка голосом: прощать неточное распознавание (окончания, одна буква); замена слова синонимом штрафуется всегда
  hzSet: SetId // набор, из которого берутся новые хадисы
  qhPerDay: number // заучивание Корана: новых аятов в день
  /** по «Проверить себя» в заучивании Корана сразу звучат аяты отрывка */
  qhCheckAudio: boolean
  qhDrill: 0 | 2 | 3 | 23 // упражнение: 2 — видно слово через одно, 3 — через два, 23 — оба по очереди, 0 — без упражнений
  qhNext: boolean // упражнение «Продолжи аят»: видно только начало каждого аята
  plRate: number // плеер: скорость 0.75–1.5
  /** плеер: на сколько мс раньше границы аята гасить звук в его конце */
  plEndCut: number
  /** плеер: на сколько мс раньше начала аята включать звук (при остановке и повторе) */
  plStartLead: number
  plGap: number // плеер: пауза между аятами, мс; -1 — «как длина аята»
  plNext: 'stop' | 'next' | 'repeat' // что после конца суры
  plSleepMode: 'time' | 'suras' // таймер сна: по времени или по числу сур
  plSleepMin: number
  plSleepSuras: number
  plFollow: boolean // листать страницы вслед за звуком
  plResume: boolean // продолжать суру с места остановки
  obDone: boolean // опросник и личный план пройдены
  obSeen: boolean // опросник уже показывали (пропустили или прошли)
  plan: import('../lib/plan').PlanAnswers | null // ответы опросника
  profName: string // своё имя (пусто — из Telegram или «Гость»)
  profPhoto: string // своё фото (сжатый JPEG в виде data-ссылки)
  hapAll: boolean // вибрация в приложении из магазина
  hapAzkar: boolean
  hapHadith: boolean
  hapQuran: boolean // листание тафсира, страниц, линейка
  plPos: Record<number, number> // место остановки по сурам
  qhRate: number // скорость чтеца при заучивании, 0.5–1.5
  qhWbw: boolean // пословный перевод в уроке (иначе обычный перевод под аятом)
  qhChain: boolean // слушать цепочкой: 1 → 1–2 → 1–3
  qhHide: string[] // подборки, которые человек убрал из ряда «Что учить»
  qhOrder: string[] // свой порядок подборок (id); не названные — в конце, как по умолчанию
  qhMy: string[] // «мой набор»: «67» — сура, «2:255-255» — аяты (lib/hifzQuran myEntry)
  qhSet: string // подборка, из которой берутся новые аяты (lib/hifzQuran QSETS)
  qhGoal: { t: string; by: number } | null // цель: «set:juz30» или «s:18» — выучить к дню by (dayNum)
  qhRepeat: number // сколько раз чтец повторяет каждый аят при прослушивании
  qhPause: number // пауза между повторами при прослушивании, секунд (0 — без паузы)
  qhRepeatAll: number // сколько раз прослушать весь отрывок целиком
  qhPos: { s: number; a: number } | null // откуда учить дальше (выбранная сура); null — 30-й джуз с конца
  hzRate: number // скорость озвучки хадисов
  rem: Record<RemindKey, RemindCfg> // напоминания (в магазинах — уведомления телефона, в Telegram — сообщения бота)
  remAsked: boolean // окошко «Включить напоминания?» в Telegram уже показывали
}

/** Блоки окна аята, которые можно скрыть (шестерёнка в окне аята) */
export interface AyahBlocks { topics: boolean; concepts: boolean; story: boolean; kuliev: boolean }

/** Напоминание: включено ли и время «ЧЧ:ММ» */
export interface RemindCfg { on: boolean; t: string }
export type RemindKey = 'review' | 'morning' | 'evening' | 'friday' | 'streak'

/** Активность по дням: номер дня → [страниц прочитано, хадисов выучено, повторов сделано] */
export type Activity = Record<number, [number, number, number]>
