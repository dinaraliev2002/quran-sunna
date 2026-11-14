// Длинную запись режем на части ~20–27 с по паузам: на цельной записи в пару минут Whisper выкидывает куски из середины,
// по частям — распознаёт всё (проверено на хадисе №2 ан-Навави: из 397 слов цельно — 287, по частям — 385–394).
import { toRate, wavBlob, WAV_RATE } from './wavRecorder'

const MIN = 18, MAX = 27 // границы части, секунд
const FRAME = 0.05 // окно для поиска паузы, секунд

/** Если запись короче MAX — отдаём как есть; иначе — части WAV 16 кГц, разрезанные в самых тихих местах */
export async function splitAudio(blob: Blob): Promise<Blob[]> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return [blob]
  const ctx = new AC()
  let x: Float32Array
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    if (buf.duration <= MAX + 1) return [blob]
    x = toRate(buf.getChannelData(0), buf.sampleRate)
  } catch { return [blob] } // не смогли разобрать — шлём целиком
  finally { void ctx.close().catch(() => {}) }

  const f = Math.round(FRAME * WAV_RATE)
  const energy = (i: number) => { let e = 0; for (let j = i; j < i + f && j < x.length; j++) e += x[j] * x[j]; return e }
  const parts: Blob[] = []
  let s = 0
  while (x.length - s > MAX * WAV_RATE) {
    let best = s + MAX * WAV_RATE, bestE = Infinity
    for (let i = s + MIN * WAV_RATE; i < s + MAX * WAV_RATE; i += f) { const e = energy(i); if (e < bestE) { bestE = e; best = i + (f >> 1) } }
    parts.push(wavBlob(x.subarray(s, best)))
    s = best
  }
  parts.push(wavBlob(x.subarray(s)))
  return parts
}
