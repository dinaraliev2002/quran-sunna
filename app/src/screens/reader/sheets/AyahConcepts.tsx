import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { conceptsOfAyah, loadConcepts } from '../../../lib/concepts'
import { rememberReaderSpot } from '../../../lib/readerSpot'
import { buildTopicTree, loadTopics, topicPath, topicsOfAyah, type TopicTree } from '../../../lib/topics'
import type { Concept, Topic } from '../../../types/concepts'

/** «О ком и о чём в аяте»: понятия (люди, места, существа…) из этого аята; нажатие открывает их в разделе «Слова Корана» */
export function AyahConcepts({ surah, ayah }: { surah: number; ayah: number }) {
  const nav = useNavigate()
  const [list, setList] = useState<Concept[] | null>(null)
  const [topics, setTopics] = useState<{ t: Topic; path: string }[]>([])
  useEffect(() => { loadConcepts().then((c) => setList(c ? conceptsOfAyah(c, `${surah}:${ayah}`) : [])) }, [surah, ayah])
  useEffect(() => {
    let alive = true
    loadTopics().then((all) => {
      if (!alive || !all) return
      const tree: TopicTree = buildTopicTree(all)
      // название темы с родителем: «Тяжкие грехи › убийство»; верхние разделы («Вероучение и жизнь») не показываем
      setTopics(topicsOfAyah(all, `${surah}:${ayah}`).slice(0, 6).map((t) => ({ t, path: topicPath(tree, t.i).slice(-2).map((x) => x.ru).join(' › ') })))
    })
    return () => { alive = false }
  }, [surah, ayah])
  if (!list?.length && !topics.length) return null
  return (
    <>
      {topics.length > 0 && (
        <>
          <div className="as-label">Темы аята</div>
          <div className="fw-chips">
            {topics.map(({ t, path }) => <button key={t.i} onClick={() => { rememberReaderSpot(surah, ayah, true); nav('/words', { state: { topic: t.i } }) }}>{path}</button>)}
          </div>
        </>
      )}
      {!!list?.length && <div className="as-label">О ком и о чём в аяте</div>}
      <div className="fw-chips">
        {(list ?? []).slice(0, 12).map((c) => <button key={c.i} onClick={() => { rememberReaderSpot(surah, ayah, true); nav('/words', { state: { concept: c.i } }) }}>{c.ru}</button>)}
      </div>
    </>
  )
}
