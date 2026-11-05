// «Частые слова Корана»: данные public/data/morph/freq.json (собирает scripts/build-freq.py) и отметки «знаю» на этом устройстве.
import { DATA_BASE } from './data'
import type { FreqData } from '../types/morph'

let freq: Promise<FreqData | null> | null = null
/** Список частых слов по убыванию частоты (грузится один раз) */
export function loadFreq() {
  if (!freq) {
    freq = fetch(DATA_BASE + 'morph/freq.json').then((r) => (r.ok ? (r.json() as Promise<FreqData>) : null)).catch(() => null)
    freq.then((r) => { if (!r) freq = null })
  }
  return freq
}

const KEY = 'fw_known_v1'
/** Какие слова (леммы) отмечены как знакомые */
export function loadKnownWords(): Set<string> {
  try { return new Set<string>(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch { return new Set() }
}
export function saveKnownWords(s: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify([...s])) } catch { /* нет хранилища — не страшно */ }
}
