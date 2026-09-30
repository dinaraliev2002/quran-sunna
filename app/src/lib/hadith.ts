// Раздел «Хадисы»: данные из public/data/hadith (см. scripts/build-hadith.py)
//  • сборники (isnad.link): index.json → книги/главы → {cid}/{n}.json
//  • темы (HadeethEnc): topics.json (дерево тем + заголовки) → enc/{chunk}.json (тексты с объяснениями)
import { DATA_BASE } from './data'
import { cachedJson, dataKey } from './net'

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

// версия данных хадисов — увеличиваем при пересборке, чтобы телефоны не держали старую копию
const HADITH_VERSION = 3
const cache = new Map<string, Promise<unknown>>()
function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = cachedJson<T>(dataKey(`hadith/${path}?v=${HADITH_VERSION}`), `${DATA_BASE}hadith/${path}?v=${HADITH_VERSION}`)
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return cache.get(path) as Promise<T>
}

export const loadHadithIndex = () => load<HIndex>('index.json')
export const loadBook = (cid: string, n: number) => load<HBookData>(`${cid}/${n}.json`)
export const loadTopics = () => load<TopicsData>('topics.json')
export async function loadEnc(id: number): Promise<EncHadith | null> {
  const t = await loadTopics()
  const ref = t.hadiths[id]
  return ref ? loadEncChunk(id, ref[0]) : null
}
const loadEncChunk = (id: number, chunk: number) => load<Record<string, EncHadith>>(`enc/${chunk}.json`).then((c) => c[id] ?? null)

/** Хадис дня — меняется каждый день (без загрузки большого индекса тем) */
export async function hadithOfDay(): Promise<EncHadith | null> {
  const idx = await loadHadithIndex()
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5)
  // шаг 37 — чтобы соседние дни не давали хадисы одной темы подряд
  const [id, chunk] = idx.daily[(day * 37) % idx.daily.length]
  return loadEncChunk(id, chunk)
}

// иконки корневых тем HadeethEnc
export const TOPIC_ICON: Record<number, string> = { 1: 'book', 2: 'scroll', 3: 'star', 4: 'kaaba', 5: 'heart', 6: 'users', 7: 'compass' }
// короткие названия корневых тем для карточек
const TOPIC_SHORT: Record<number, string> = { 6: 'Призыв к Аллаху', 7: 'Жизнеописание Пророка ﷺ и история' }
export const topicTitle = (t: Topic) => TOPIC_SHORT[t.id] ?? t.title

// избранное: «c:сборник:книга:номер» или «e:id»
export const favBook = (cid: string, n: number, i: number) => `c:${cid}:${n}:${i}`
export const favEnc = (id: number) => `e:${id}`

/** Абзац-источник в конце хадиса («Этот хадис передали…») */
export const isSourcePara = (p: string) => /^(Этот хадис|Хадис передал|Передал|Передали|\(?Муслим|\(?аль-Бухари)/i.test(p) && p.length < 900

/** Текст для «Поделиться»: не длиннее ~1500 символов (ограничение ссылки Telegram) */
export function shareBody(title: string, text: string, ref: string) {
  const clean = text.replace(/\*\*/g, '')
  const body = clean.length > 1500 ? clean.slice(0, 1500).replace(/\s+\S*$/, '') + '…' : clean
  return `${title ? title + '\n\n' : ''}${body}\n— ${ref}`
}
