import { useEffect, useRef, useState } from 'react'
import { DATA_BASE } from '../lib/data'
import { usePlayer } from '../store/player'

/** Озвучка тафсира ас-Саади (Э. Кулиев, издательство «Умма») — отрывки по аятам; адрес потом заменим на своё облако */
export const TAFSIR_AUDIO_BASE = 'https://s2.musulmanin.com/audio_knigi/tafsir_saadi/'

type Index = Record<string, [number, number, string][]>
let index: Promise<Index> | null = null
const loadIndex = () => (index ??= fetch(DATA_BASE + 'tafsir-audio.json').then((r) => r.json() as Promise<Index>))

/** Отрывок озвучки, в который попадает аят: { file, from, to } (to = 0 — до конца суры) */
export async function tafsirAudioFor(surah: number, ayah: number) {
  try {
    const parts = (await loadIndex())[String(surah)]
    if (!parts) return null
    const hit = parts.find(([f, t]) => ayah >= f && (t === 0 || ayah <= t))
    return hit ? { from: hit[0], to: hit[1], file: hit[2] } : null
  } catch { return null }
}

export function TafsirAudio({ surah, ayah, total }: { surah: number; ayah: number; total: number }) {
  const [part, setPart] = useState<{ from: number; to: number; file: string } | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const el = useRef<HTMLAudioElement>(null)
  useEffect(() => { setPart(undefined); setFailed(false); tafsirAudioFor(surah, ayah).then(setPart) }, [surah, ayah])
  if (!part) return null
  const to = part.to || total
  return (
    <div className="tafsir-audio">
      <div className="ta-t">Слушать тафсир · {part.from === to ? `аят ${part.from}` : `аяты ${part.from}–${to}`}</div>
      <audio
        key={part.file} ref={el} controls preload="none" src={TAFSIR_AUDIO_BASE + part.file}
        onPlay={() => { const p = usePlayer.getState(); if (p.status === 'playing' || p.status === 'loading') p.toggle() }}
        onError={() => setFailed(true)}
      />
      {failed && <div className="ta-err">Не удалось загрузить озвучку. Проверьте интернет и попробуйте позже</div>}
    </div>
  )
}
