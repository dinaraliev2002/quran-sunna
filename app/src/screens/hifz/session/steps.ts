// Урок заучивания Корана: шаги, скорости, ограничения

export type Step = 'read' | 'show2' | 'show3' | 'next' | 'tell'
export const STEP_NAME: Record<Step, string> = {
  read: 'Слушать и читать', show2: 'Видно слово через одно', show3: 'Видно слово через два', next: 'Продолжи аят', tell: 'Прочитай по памяти',
}
/** Скорости чтеца */
/** Пауза между повторами при прослушивании, секунд */
export const PAUSES = [0, 1, 2, 3]
export const RATES = [0.5, 0.75, 1, 1.25, 1.5]
export const rateL = (r: number) => String(r).replace('.', ',') + '×'
/** «Продолжи аят»: сколько первых слов видно (у коротких аятов — одно) */
export const headWords = (n: number) => (n <= 3 ? 1 : n <= 8 ? 2 : 3)
/** В повторении за раз — не больше стольких отрывков (самые давние); остальные подождут до завтра */
export const REVIEW_MAX = 10
