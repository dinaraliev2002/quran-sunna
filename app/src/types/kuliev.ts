// Комментарии Кулиева

/** Комментарии к переводу Кулиева (издание Комплекса короля Фахда): вступления к сурам, пояснения к аятам, словарь, места поклонов.
 *  Авторский текст — файлов нет в публичной сборке, тогда раздела просто нет. */
export interface KulievIndex {
  v: string
  /** по сурам: аяты, у которых есть пояснения, и есть ли вступление */
  s: Record<string, { n: number[]; intro: boolean }>
  /** места земных поклонов [сура, аят] */
  sajda: [number, number][]
}

export interface KulievSurah { s: number; intro: string[]; notes: Record<string, string[][]> }
