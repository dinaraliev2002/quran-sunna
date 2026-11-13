// Громкость микрофона для полосок «идёт запись» (Web Audio). Возвращает функцию остановки.
export function attachMeter(stream: MediaStream, onLevel: (lvl: number) => void): () => void {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC()
  const an = ctx.createAnalyser()
  an.fftSize = 512
  ctx.createMediaStreamSource(stream).connect(an)
  const buf = new Uint8Array(an.fftSize)
  const id = window.setInterval(() => {
    an.getByteTimeDomainData(buf)
    let peak = 0
    for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
    onLevel(Math.min(1, peak / 70))
  }, 70)
  return () => { clearInterval(id); void ctx.close() }
}
