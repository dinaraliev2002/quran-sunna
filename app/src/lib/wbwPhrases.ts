// Пословный перевод: в источнике фраза («من قبلك» — «до тебя») бывает переведена целиком,
// и у следующих слов подписи нет (пустая строка). Здесь такие слова привязываются к первому слову фразы.

/** Группы слов-фраз: [[0],[1],[2,3],…]. Без перевода каждое слово — отдельная группа */
export function phraseGroups(tr: string[] | null | undefined, count: number): number[][] {
  const groups: number[][] = []
  for (let i = 0; i < count; i++) {
    if (tr && i > 0 && !tr[i] && groups.length) groups[groups.length - 1].push(i)
    else groups.push([i])
  }
  return groups
}

/** Подпись слова i: свою, а если её нет — перевод фразы, в которую слово входит */
export function wordCaption(tr: string[] | null | undefined, i: number): string {
  if (!tr) return ' '
  let k = i
  while (k > 0 && !tr[k]) k--
  return tr[k] || ' '
}
