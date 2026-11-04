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
  /** качество аудио по чтецам, кбит/с: { alafasy: 64 } (нет записи — как у чтеца по умолчанию) */
  bitrates: Record<string, number>
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
  // заучивание
  hzPerDay: number // план: новых хадисов в день
  hzDrills: boolean // упражнения при заучивании: пропуски, первые буквы, сборка
  hzAr: boolean // показывать арабский текст при чтении
  hzSet: SetId // набор, из которого берутся новые хадисы
  qhPerDay: number // заучивание Корана: новых аятов в день
  qhDrill: 0 | 2 | 3 | 23 // упражнение: 2 — видно слово через одно, 3 — через два, 23 — оба по очереди, 0 — без упражнений
  qhNext: boolean // упражнение «Продолжи аят»: видно только начало каждого аята
  plRate: number // плеер: скорость 0.75–1.5
  plGap: number // плеер: пауза между аятами, мс; -1 — «как длина аята»
  plNext: 'stop' | 'next' | 'repeat' // что после конца суры
  plSleepMode: 'time' | 'suras' // таймер сна: по времени или по числу сур
  plSleepMin: number
  plSleepSuras: number
  plFollow: boolean // листать страницы вслед за звуком
  plResume: boolean // продолжать суру с места остановки
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
  qhPos: { s: number; a: number } | null // откуда учить дальше (выбранная сура); null — 30-й джуз с конца
  hzRate: number // скорость озвучки хадисов
}

/** Активность по дням: номер дня → [страниц прочитано, хадисов выучено, повторов сделано] */
export type Activity = Record<number, [number, number, number]>
