/**
 * Перед уходом из чтения в другой раздел (например, из окна аята в «Слова Корана») записываем в адрес текущего экрана,
 * где мы были: сура, аят и открыто ли окно аята. Тогда кнопка «Назад» вернёт именно туда, а не к началу суры.
 * Адрес меняется «тихо», без перезагрузки экрана: сам экран чтения этого не замечает.
 */
export function rememberReaderSpot(surah: number, ayah: number, sheet: boolean) {
  if (!window.location.hash.startsWith('#/read/')) return // уходим не из чтения — адрес не трогаем
  try {
    window.history.replaceState(window.history.state, '', `#/read/${surah}?a=${ayah}${sheet ? '&sheet=1' : ''}`)
  } catch { /* адрес не менять нельзя — не страшно */ }
}
