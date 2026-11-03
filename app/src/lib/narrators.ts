// Передатчики хадисов: загрузка данных (hadith-kg, CC BY 4.0) и перевод оценок критиков
import type { Narrator, Rich } from '../types/narrators'

export const loadRich = (cid: string, bn: number, i: number) => fetch(`data/narrators/rich/${cid}-${bn}-${i}.json`).then((r) => (r.ok ? (r.json() as Promise<Rich>) : null)).catch(() => null)

const get = <T,>(url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json() as Promise<T> })
const cache = new Map<string, Promise<unknown>>()
const once = <T,>(url: string, fallback?: T) => {
  if (!cache.has(url)) cache.set(url, get<T>(url).catch((e) => { if (fallback !== undefined) return fallback; cache.delete(url); throw e }))
  return cache.get(url) as Promise<T>
}
export const loadChains = (cid: string) => once<Record<string, number[]>>(`data/narrators/chains-${cid}.json`, {})
export const loadSahabi = (cid: string) => once<Record<string, [number, number]>>(`data/narrators/sahabi-${cid}.json`, {})
// ан-Навави и «Рияд»: цепочка того же хадиса из первоисточника — [книга, номер, звенья]
export const loadLinks = (cid: string) => once<Record<string, [string, string, number[]]>>(`data/narrators/links-${cid}.json`, {})
/** Карточки передатчиков лежат шардами по 200 номеров — грузим только нужные */
export const loadNarrators = async (ids: number[]) => {
  const shards = [...new Set(ids.map((id) => Math.floor(id / 200)))]
  const parts = await Promise.all(shards.map((sh) => once<Record<string, Narrator>>(`data/narrators/n-${sh}.json`)))
  return Object.assign({}, ...parts) as Record<string, Narrator>
}
export const AUTHOR: Record<string, string> = { bukhari: 'аль-Бухари', muslim: 'Муслима', tirmidhi: 'ат-Тирмизи', abudawud: 'Абу Дауда', nasai: 'ан-Насаи', ibnmajah: 'Ибн Маджи', darimi: 'ад-Дарими', malik: 'Малика' }
export const BOOK: Record<string, string> = { bukhari: '«Сахих» аль-Бухари', muslim: '«Сахих» Муслима', tirmidhi: '«Сунан» ат-Тирмизи', abudawud: '«Сунан» Абу Дауда', nasai: '«Сунан» ан-Насаи', ibnmajah: '«Сунан» Ибн Маджи', darimi: '«Сунан» ад-Дарими', malik: '«Муватта» Малика' }

// 12 поколений по «Такрибу» Ибн Хаджара
export const TABAQA: Record<number, string> = {
  1: 'Сподвижники',
  2: 'Старшие табиины (как Ибн аль-Мусайяб)',
  3: 'Средние табиины (как аль-Хасан аль-Басри)',
  4: 'Табиины, передававшие в основном от старших табиинов (как аз-Зухри)',
  5: 'Младшие табиины (как аль-А‘маш)',
  6: 'Современники пятого поколения, не заставшие сподвижников (как Ибн Джурайдж)',
  7: 'Старшие из «последователей табиинов» (как Малик)',
  8: 'Средние из «последователей табиинов» (как Ибн ‘Уяйна)',
  9: 'Младшие из «последователей табиинов» (как аш-Шафи‘и)',
  10: 'Старшие из тех, кто брал у «последователей табиинов» (как Ахмад)',
  11: 'Средние из них (как аль-Бухари)',
  12: 'Младшие из них (как ат-Тирмизи)',
}
export const TABAQA_SHORT: Record<number, string> = { 1: 'сподвижник', 2: 'табиин', 3: 'табиин', 4: 'табиин', 5: 'табиин', 6: '6-е поколение', 7: '7-е поколение', 8: '8-е поколение', 9: '9-е поколение', 10: '10-е поколение', 11: '11-е поколение', 12: '12-е поколение' }

const WORDS: Record<string, string> = {
  'ثقة': 'надёжный', 'ثبت': 'твёрдый', 'حافظ': 'хафиз', 'متقن': 'точный', 'مأمون': 'заслуживающий доверия', 'حجة': 'довод',
  'صدوق': 'правдивый', 'حسن': 'хороший', 'الحديث': 'в хадисах', 'مقبول': 'принимаемый', 'ضعيف': 'слабый', 'متروك': 'оставленный',
  'صحابي': 'сподвижник', 'صحابية': 'сподвижница', 'صغير': 'младший', 'مخضرم': 'застал обе эпохи', 'مدلس': 'допускал тадлис', 'يرسل': 'передавал мурсаль',
  'يخطئ': 'бывает, ошибается', 'يهم': 'бывает, ошибается', 'أوهام': 'ошибки', 'له': '', 'فيه': '', 'لين': 'мягок в передаче', 'إمام': 'имам', 'فقيه': 'знаток права', 'عابد': 'благочестивый',
  'جليل': 'выдающийся', 'مكثر': 'передал много', 'أفراد': 'передавал одиночные сообщения',
}
const GRADE_EXACT: Record<string, string> = {
  'ثقة': 'Надёжный', 'صحابي': 'Сподвижник', 'صدوق حسن الحديث': 'Правдивый, его хадисы хорошие', 'ثقة ثبت': 'Надёжный, твёрдый в передаче',
  'ثقة حافظ': 'Надёжный, хафиз', 'مقبول': 'Принимаемый (при подтверждении)', 'له رؤية': 'Видел Пророка ﷺ', 'ضعيف الحديث': 'Слабый в хадисах',
  'صحابي صغير': 'Младший сподвижник', 'مختلف في صحبته': 'О его сподвижничестве спорят', 'لم تثبت له صحبة': 'Сподвижничество не доказано',
}
export const gradeRu = (r?: string) => {
  if (!r) return ''
  if (GRADE_EXACT[r]) return GRADE_EXACT[r]
  const t = r.split(/\s+/).map((w) => WORDS[w]).filter((x) => x !== undefined && x !== '')
  if (!t.length) return ''
  const s = t.join(', ')
  return s[0].toUpperCase() + s.slice(1)
}
/** Начало русского перевода оценки — для значка, если короткого шаблона нет */
export const shortTr = (tr?: string | null) => {
  if (!tr) return ''
  const s = tr.replace(/\{\{\w+\|([^}]+)\}\}/g, '$1').split(/[.;:]/)[0].trim()
  return s.length <= 48 ? s : ''
}
// цвет значка оценки: надёжные — зелёный, «правдивый» и с оговорками — золотой, слабые — красный
export const tone = (r?: string) => (!r ? 'n' : /ضعيف|متروك|منكر|كذاب|متهم|ليس/.test(r) ? 'bad' : /^ثقة|صحابي|صحابية|له رؤية|مخضرم|إمام|ثبت|حافظ/.test(r) && !/إلا|رمي|يخطئ|يهم/.test(r) ? 'good' : 'mid')
