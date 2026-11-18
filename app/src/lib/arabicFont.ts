// Подгонка арабского текста хадисов под выбранный шрифт.
// Шрифт Хафс (кодировка KFGQPC): обычный сукун U+0652 рисует круглым нулём, знак U+06DF — пунктирным кружком;
// «،» «؛» «؟» — кружком с точкой, арабские цифры — в кружке, как номер аята. Знаки и цифры берём из другого шрифта
// (семейство HafsText в tokens.css без них), сукун меняем на тот, что Хафс рисует правильно.
import { ARABIC_FONTS } from './azkar'

type FontKey = keyof typeof ARABIC_FONTS

/** CSS шрифта для арабского текста хадисов */
export const hadithFontCss = (font: FontKey) => (font === 'hafs' ? '"HafsText", "Scheherazade New", serif' : ARABIC_FONTS[font].css)

/** Текст для шрифта: для Хафса — сукун U+06E1, без U+06DF; для остальных — как есть */
export function arForFont(text: string, font: string): string {
  if (font !== 'hafs') return text
  return text
    .replace(/\s+([ۖ-ۜ])/g, '$1') // знаки остановки — к предыдущему слову
    .replace(/ْ/g, 'ۡ')
    .replace(/۟/g, 'ْ')
}
