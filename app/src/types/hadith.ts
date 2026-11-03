// Хадисы: сборники, книги, «Энциклопедия хадисов»

export interface HBook { n: number; /** номер книги/главы в самом сборнике (0 — вступление) */ no: number; title: string; ar: string; range: string; count: number; intro?: 1; /** номер группы, если глава входит в книгу со вложенными главами */ grp?: number }

/** Книга со вложенными главами («Толкование Корана» у аль-Бухари, книги Рияд ас-Салихин) */
export interface HGroup { g: number; no: number; title: string; ar: string; range: string; count: number }

export interface HCollection { id: string; name: string; ar: string; author: string; about: string; hadiths: number; books: HBook[]; groups: HGroup[]; /** перевод неполный — пояснение */ part?: string }

export interface HIndex { collections: HCollection[]; /** кандидаты в «Хадис дня»: [id, номер файла enc] */ daily: [number, number][]; source: string }

/** Хадис или раздел главы: заголовок, абзацы перевода, абзацы арабского текста */
export interface HItem { t: string; ru: string[]; ar: string[]; /** номер хадиса, если это отдельный хадис из главы («» — другая версия предыдущего) */ h?: string }

export interface HBookData { title: string; ar: string; items: HItem[] }

export interface Topic { id: number; title: string; parent: number; count: number; ids: number[] }

export interface TopicsData { topics: Topic[]; hadiths: Record<string, [number, string]> }

export interface EncHadith { id: number; t: string; ru: string; /** вводные слова («От Абу Хурайры передаётся…») — начало ru */ in: string; ar: string; src: string; grade: string; ex: string; hints: string[] }
