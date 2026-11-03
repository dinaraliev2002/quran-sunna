// «Истории аятов» (асбаб ан-нузуль): оглавление, истории, книги

/** История аята (причина ниспослания) — запись из книги по асбаб ан-нузуль */
export interface AsbabPart { k: 'src' | 'isnad' | 'text' | 'note' | 'result' | 'foot'; t: string }

/** Запись одной книги об истории: оценка автора и его текст */
export interface AsbabOpinion {
  id: string; book: string; page?: string; title: string; verdict?: string
  /** вывод автора: yes — это причина ниспослания, no — нет, other — причина другая, weak — слабое */
  sabab?: 'yes' | 'no' | 'other' | 'weak'
  parts: AsbabPart[]
}

/** Карточка истории: текст из главной книги + мнения остальных книг о той же истории */
export interface AsbabStory {
  id: string; from: number; to: number; main: AsbabOpinion; opinions: AsbabOpinion[]
  /** история обо всей суре (где и когда ниспослана) — «История суры» у заголовка, а не у аятов */
  whole?: boolean
}

export interface AsbabBook { author: string; short: string; title: string; about: string; edition: string }

/** Оглавление историй: книги и для каждой суры — диапазоны аятов [от, до], у которых есть истории */
export interface AsbabIndex {
  v: string; books: Record<string, AsbabBook>; s: Record<string, [number, number][]>
  /** сколько историй у суры целиком (нет у старых файлов) */
  w?: Record<string, number>
  /** сколько историй у аятов суры */
  n?: Record<string, number>
}
