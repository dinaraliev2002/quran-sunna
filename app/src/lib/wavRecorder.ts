// Запись голоса без MediaRecorder: берём звук через Web Audio и сами собираем WAV 16 кГц.
// Запасной путь для окон, где MediaRecorder не запускается (бывает в Telegram на телефоне).

const RATE = 16000

export interface WavRec { stop: () => Promise<Blob> }

export function startWav(stream: MediaStream, onLevel: (lvl: number) => void): WavRec {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC()
  void ctx.resume?.()
  const src = ctx.createMediaStreamSource(stream)
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  const parts: Float32Array[] = []
  proc.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0)
    parts.push(new Float32Array(d))
    let peak = 0
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]))
    onLevel(Math.min(1, peak * 3))
  }
  src.connect(proc)
  proc.connect(ctx.destination) // без этого обработчик не вызывается; сами мы в выход ничего не пишем
  const inRate = ctx.sampleRate
  return {
    stop: async () => {
      proc.onaudioprocess = null
      try { src.disconnect(); proc.disconnect() } catch { /* уже отключено */ }
      void ctx.close().catch(() => {})
      return encode(parts, inRate)
    },
  }
}

function encode(parts: Float32Array[], inRate: number): Blob {
  const n = parts.reduce((a, p) => a + p.length, 0)
  const all = new Float32Array(n)
  let o = 0
  for (const p of parts) { all.set(p, o); o += p.length }
  // понижаем частоту до 16 кГц (среднее по окну — без лишнего «звона»)
  const ratio = inRate / RATE
  const len = Math.floor(n / ratio)
  const pcm = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = a; j < b && j < n; j++) sum += all[j]
    const v = Math.max(-1, Math.min(1, sum / (b - a)))
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const dv = new DataView(buf)
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  str(36, 'data'); dv.setUint32(40, pcm.length * 2, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}
