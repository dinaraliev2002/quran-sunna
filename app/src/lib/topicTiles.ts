// Главные разделы экрана «Темы»: плитки, которые собирают нужные ветки тематического указателя (номера — как в data/topics.json).

export interface TopicTile { title: string; icon: string; ids: number[] }

export const TOPIC_TILES: TopicTile[] = [
  { title: 'Пять столпов ислама', icon: 'kaaba', ids: [1898] },
  { title: 'Семья и брак', icon: 'heart', ids: [904, 566, 755, 1255, 2262] },
  { title: 'Грехи и прощение', icon: 'flame', ids: [2491, 2510, 1465, 2467] },
  { title: 'Мольбы', icon: 'hands', ids: [2068, 2473] },
  { title: 'Пророки', icon: 'star', ids: [2284] },
  { title: 'Истории и притчи', icon: 'scroll', ids: [2361, 2380] },
  { title: 'Рай и Ад', icon: 'sunrise', ids: [15, 66, 2186] },
  { title: 'Качества Аллаха', icon: 'sun', ids: [1901] },
  { title: 'Коран', icon: 'book', ids: [61] },
  { title: 'Пророк Мухаммад ﷺ', icon: 'moon', ids: [2011] },
  { title: 'Деньги и право', icon: 'cup', ids: [2209, 2227] },
  { title: 'Этикет и поведение', icon: 'users', ids: [2238] },
  { title: 'Невидимый мир', icon: 'cloud', ids: [1837, 2425] },
  { title: 'Творение и природа', icon: 'leaf', ids: [1927, 1963, 1999] },
]

/** «Часто ищут»: быстрые переходы к отдельным темам */
export const POPULAR_TOPICS: { label: string; id: number }[] = [
  { label: 'Терпение', id: 2272 },
  { label: 'Прощение', id: 1465 },
  { label: 'Милостыня', id: 2084 },
  { label: 'Дуа', id: 2068 },
  { label: 'Пост', id: 618 },
  { label: 'Развод', id: 566 },
  { label: 'Справедливость', id: 1556 },
  { label: 'Смерть', id: 538 },
]
