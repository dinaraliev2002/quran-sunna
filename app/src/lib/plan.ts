// Личный план обучения: ответы опросника → список шагов «по очереди» (правила, без ИИ). См. docs/06-personal-plan.md

export type QuranLevel = 'none' | 'short' | 'j30' | 'more' | 'custom'
export type HadithLevel = 'none' | 'few' | 'nawawi'
export type Goal = 'quran' | 'hadith' | 'names' | 'azkar' | 'words'
/** known — суры, которые человек отметил как заученные (при quran: 'custom') */
export interface PlanAnswers { quran: QuranLevel; hadith: HadithLevel; goals: Goal[]; minutes: 5 | 10 | 20 | 30; known?: number[] }
export interface PlanStep { title: string; sub: string; to: string; surahs?: number[] }

export const DEFAULT_ANSWERS: PlanAnswers = { quran: 'none', hadith: 'none', goals: ['quran', 'hadith'], minutes: 10 }

/** Сколько новых аятов или хадисов в день при таком времени */
export const perDay = (m: PlanAnswers['minutes']) => (m <= 5 ? 1 : m <= 10 ? 2 : m <= 20 ? 3 : 5)

const learn = (s: number) => `/hifz/quran/learn?s=${s}&a=1`

export function buildPlan(a: PlanAnswers): PlanStep[] {
  const out: PlanStep[] = []
  if (a.goals.includes('quran')) {
    if (a.quran === 'none') {
      out.push({ title: 'Аль-Фатиха', sub: 'Сура, без которой нет намаза', to: learn(1), surahs: [1] })
      out.push({ title: 'Аль-Ихлас, Аль-Фаляк, Ан-Нас', sub: 'Самые короткие суры для намаза', to: learn(112), surahs: [112, 113, 114] })
      out.push({ title: 'Аль-Каусар, Аль-Аср, Ан-Наср', sub: 'Ещё три короткие суры', to: learn(108), surahs: [108, 103, 110] })
    } else if (a.quran === 'short') {
      out.push({ title: 'Закрепить Аль-Фатиху и короткие суры', sub: 'Повторять по интервалам', to: learn(1), surahs: [1, 112, 113, 114] })
      out.push({ title: 'Продолжить джуз 30', sub: 'Ад-Духа, Аш-Шарх, Ат-Тин', to: learn(93), surahs: [93, 94, 95] })
    } else if (a.quran === 'j30') {
      out.push({ title: 'Дальше по джузу 30', sub: 'С того места, где вы остановились', to: learn(91), surahs: [91, 92, 93] })
    } else if (a.quran === 'custom') {
      const known = new Set(a.known ?? [])
      const next = Array.from({ length: 37 }, (_, i) => 114 - i).find((s) => !known.has(s))
      out.push({ title: 'Закрепить заученные суры', sub: `Отмечено сур: ${known.size}. Они сами вернутся на повтор`, to: '/hifz/quran' })
      if (next) out.push({ title: 'Учить дальше', sub: 'Следующая сура 30-го джуза, которую вы ещё не знаете', to: learn(next), surahs: [next] })
    } else {
      out.push({ title: 'Продолжить заучивание Корана', sub: 'Следующая сура на выбор', to: '/hifz/quran', surahs: [67] })
    }
  }
  if (a.goals.includes('hadith')) {
    if (a.hadith === 'none') out.push({ title: '40 хадисов ан-Навави', sub: 'Первые хадисы: коротко и самое важное', to: '/hifz' })
    else if (a.hadith === 'few') out.push({ title: 'Продолжить 40 хадисов ан-Навави', sub: 'Дальше по плану на день', to: '/hifz' })
    else out.push({ title: 'Рияд ас-Салихин', sub: 'Читать и выбирать хадисы для заучивания', to: '/hadith' })
  }
  if (a.goals.includes('words')) out.push({ title: '100 самых частых слов Корана', sub: 'Сто слов — больше половины текста: так начинаешь понимать Коран', to: '/hifz/words' })
  if (a.goals.includes('names')) out.push({ title: '99 имён Аллаха', sub: 'По одному в день: значение и заучивание', to: '/names/learn' })
  if (a.goals.includes('azkar')) out.push({ title: 'Утренние и вечерние азкары', sub: 'Каждый день после намаза', to: '/azkar' })
  return out
}
