/** Часть слова: [написание, часть речи (N имя, V глагол, P частица), метки через «|»] */
export type MorphSeg = [string, 'N' | 'V' | 'P', string]
/** Слово = его части (приставки, основа, суффиксы) */
export type MorphWord = MorphSeg[]
/** Разбор суры: номер аята → слова аята */
export type MorphSurah = Record<string, MorphWord[]>

/** Форма слова с этим корнем: [написание, лемма, «часть речи|метки», сколько раз, где: «сура:аят:слово»] */
export type RootForm = [string, string, string, number, string[]]
/** Корень: сколько слов, в каких аятах («сура:аят»), какие формы */
export interface RootInfo { n: number; v: string[]; f: RootForm[] }
export type RootIndex = Record<string, RootInfo>

/** Какое слово открыто в окне разбора */
export interface WordTarget { s: number; a: number; w: number }

/** Частое слово: [лемма, корень, часть речи (V/N/P), сколько раз в Коране, русский перевод, пример «сура:аят:слово», написание в примере] */
export type FreqWord = [string, string, 'N' | 'V' | 'P', number, string, string, string]
/** Частые слова: сколько всего слов в Коране и список по убыванию частоты */
export interface FreqData { total: number; w: FreqWord[] }
