// Темы Корана (смыслы): данные public/data/topics.json (собирает scripts/build-topics.py из тематического указателя QUL).
import { DATA_BASE } from './data'
import type { Topic } from '../types/concepts'

let all: Promise<Topic[] | null> | null = null
/** Все темы одним списком (около 650, грузятся один раз) */
export function loadTopics() {
  if (!all) {
    all = fetch(DATA_BASE + 'topics.json').then((r) => (r.ok ? (r.json() as Promise<Topic[]>) : null)).catch(() => null)
    all.then((r) => { if (!r) all = null })
  }
  return all
}

export interface TopicTree {
  byId: Map<number, Topic>
  kids: Map<number, Topic[]>
  /** все аяты темы и её подтем без повторов */
  total: (id: number) => string[]
}

/** Дерево тем: родители и дети, а также счёт аятов вместе с подтемами */
export function buildTopicTree(list: Topic[]): TopicTree {
  const byId = new Map(list.map((t) => [t.i, t]))
  const kids = new Map<number, Topic[]>()
  for (const t of list) kids.set(t.p, [...(kids.get(t.p) ?? []), t])
  const cache = new Map<number, string[]>()
  const total = (id: number): string[] => {
    const hit = cache.get(id)
    if (hit) return hit
    const set = new Set(byId.get(id)?.a ?? [])
    for (const k of kids.get(id) ?? []) for (const a of total(k.i)) set.add(a)
    const out = [...set]
    cache.set(id, out)
    return out
  }
  return { byId, kids, total }
}

/** Путь от верхнего уровня до темы: названия по порядку */
export function topicPath(tree: TopicTree, id: number): Topic[] {
  const out: Topic[] = []
  let cur = tree.byId.get(id)
  for (let n = 0; cur && n < 12; n++) { out.unshift(cur); cur = cur.p ? tree.byId.get(cur.p) : undefined }
  return out
}

/** Самые «точные» темы аята: у которых аят указан прямо; чем меньше аятов у темы, тем она конкретнее */
export function topicsOfAyah(list: Topic[], key: string): Topic[] {
  return list.filter((t) => t.a.includes(key)).sort((a, b) => a.a.length - b.a.length)
}
