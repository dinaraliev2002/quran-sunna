// Грамматические метки Quranic Arabic Corpus по-русски.
import type { MorphSeg } from '../types/morph'

const TAG: Record<string, string> = {
  // виды имён
  PN: 'имя собственное', ADJ: 'прилагательное', PRON: 'местоимение', DEM: 'указательное местоимение', REL: 'относительное местоимение',
  T: 'обстоятельство времени', LOC: 'обстоятельство места', ACT_PCPL: 'действительное причастие', PASS_PCPL: 'страдательное причастие',
  VN: 'масдар (отглагольное имя)', NV: 'глагольное имя', INDEF: 'неопределённое (с танвином)',
  // части слова
  DET: 'определённый артикль «аль»', PREF: 'приставка', SUFF: 'суффикс',
  // глагол
  PERF: 'совершенное время (прошедшее)', IMPF: 'несовершенное время (настоящее или будущее)', IMPV: 'повелительное наклонение', PASS: 'страдательный залог',
  'MOOD:IND': 'изъявительное наклонение (марфу‘)', 'MOOD:SUBJ': 'сослагательное наклонение (мансуб)', 'MOOD:JUS': 'усечённое наклонение (маджзум)',
  // падеж
  NOM: 'именительный падеж', GEN: 'родительный падеж', ACC: 'винительный падеж',
  // частицы
  CONJ: 'союз', P: 'предлог', NEG: 'отрицание', EMPH: 'усилительная частица', COND: 'условная частица', INTG: 'вопросительная частица',
  REM: 'возобновление речи', SUB: 'подчинительный союз', RES: 'ограничительная частица', ATT: 'привлекающая внимание частица',
  DIST: 'указание на дальнее', ADDR: 'обращение к собеседнику', CERT: 'частица уверенности', VOC: 'звательная частица',
  RSLT: 'ответ на условие', PRO: 'запрет', PRP: 'частица цели', CIRC: 'обстоятельственная частица', SUP: 'дополнительная частица',
  PREV: 'препятствующая частица', FUT: 'будущее время', RET: 'отрицание сказанного', EXP: 'частица исключения', EXL: 'пояснение',
  AMD: 'уточнение', ANS: 'ответная частица', INC: 'начало речи', INT: 'пояснительная частица', EXH: 'побуждение', SUR: 'частица неожиданности',
  AVR: 'отвращение', INL: 'начальные буквы суры', EQ: 'уравнивающая частица', COM: 'частица совместности', CAUS: 'причинная частица',
}

const FAM: Record<string, string> = { 'إِنّ': 'из «сестёр» إِنَّ', 'كَان': 'из «сестёр» كَانَ', 'كَاد': 'из «сестёр» كَادَ' }

/** Породы (формы) глагола: номер → название и смысл */
export const VERB_FORMS: Record<string, string> = {
  1: 'I порода — основная',
  2: 'II порода — усиление, «заставить»',
  3: 'III порода — направленность на другого',
  4: 'IV порода — «сделать кем-то, чем-то»',
  5: 'V порода — от II, «стать»',
  6: 'VI порода — взаимность',
  7: 'VII порода — «поддаться действию»',
  8: 'VIII порода — возвратная',
  9: 'IX порода — цвет, недостаток',
  10: 'X порода — «просить, считать»',
  11: 'XI порода',
}

const PERSON: Record<string, string> = { 1: '1-е лицо', 2: '2-е лицо', 3: '3-е лицо' }
const GENDER: Record<string, string> = { M: 'муж. род', F: 'жен. род' }
const NUMBER: Record<string, string> = { S: 'ед. число', D: 'дв. число', P: 'мн. число' }

/** «3MS», «MP», «1P» → «3-е лицо, муж. род, ед. число» */
function agreement(t: string): string | null {
  const m = /^([123])?([MF])?([SDP])?$/.exec(t)
  if (!m || !t) return null
  return [m[1] && PERSON[m[1]], m[2] && GENDER[m[2]], m[3] && NUMBER[m[3]]].filter(Boolean).join(', ')
}

/** Название метки по-русски (или null, если метку не показываем) */
export function tagLabel(t: string): string | null {
  if (t.startsWith('ROOT:') || t.startsWith('LEM:') || t === '') return null
  if (t.startsWith('VF:')) return VERB_FORMS[t.slice(3)] ?? `${t.slice(3)} порода`
  if (t.startsWith('FAM:')) return FAM[t.slice(4)] ?? null
  return TAG[t] ?? agreement(t)
}

/** Что это за часть слова: «приставка · предлог», «глагол», «имя собственное»… */
export function segRole(seg: MorphSeg): string {
  const tags = seg[2].split('|')
  const has = (t: string) => tags.includes(t)
  if (seg[1] === 'V') return 'Глагол'
  if (seg[1] === 'P') {
    const kind = tags.filter((t) => t !== 'PREF' && t !== 'SUFF' && !t.startsWith('LEM:')).map((t) => TAG[t]).filter(Boolean)[0]
    return (has('PREF') ? 'Приставка' : 'Частица') + (kind ? ` · ${kind}` : '')
  }
  if (has('SUFF')) return 'Суффикс · ' + (has('PRON') ? 'местоимение' : (tags.map((t) => TAG[t]).filter(Boolean)[0] ?? ''))
  for (const k of ['PN', 'PRON', 'DEM', 'REL', 'T', 'LOC', 'ACT_PCPL', 'PASS_PCPL', 'VN', 'NV', 'ADJ']) if (has(k)) return 'Имя · ' + TAG[k]
  return 'Имя существительное'
}

/** Остальные признаки части слова: форма глагола, время, лицо, род, число, падеж… */
export function segChips(seg: MorphSeg): string[] {
  const kinds = new Set(['PN', 'PRON', 'DEM', 'REL', 'T', 'LOC', 'ACT_PCPL', 'PASS_PCPL', 'VN', 'NV', 'ADJ', 'PREF', 'SUFF'])
  const out: string[] = []
  for (const t of seg[2].split('|')) {
    if (seg[1] === 'P' || kinds.has(t)) continue
    const l = tagLabel(t)
    if (l) out.push(l)
  }
  // причастия и масдар показываем и как признак имени, если это причастие
  return out
}

/** Короткое описание формы слова из списка «Формы»: «глагол · I порода · несов. · 3-е лицо, муж. род, мн. число» */
export function formLabel(posAndTags: string): string {
  const [pos, ...tags] = posAndTags.split('|')
  const seg: MorphSeg = ['', pos as 'N' | 'V' | 'P', tags.join('|')]
  return [segRole(seg), ...segChips(seg)].join(' · ')
}
