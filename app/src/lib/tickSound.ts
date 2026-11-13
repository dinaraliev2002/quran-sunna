// Тихий «деревянный» щелчок для колеса выбора (Web Audio, без файлов): короткий шум + глухой толчок. Если звук недоступен — молча ничего.
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

export function tickSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const t = ctx.currentTime
    if (!noise) {
      noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.03), ctx.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    // сухой щелчок: шум через полосовой фильтр, очень короткий
    const n = ctx.createBufferSource()
    n.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1.4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018)
    n.connect(f).connect(g).connect(ctx.destination)
    n.start(t)
    // глухой толчок под ним — чтобы звучало «материально»
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(260, t)
    o.frequency.exponentialRampToValueAtTime(110, t + 0.03)
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(0.16, t + 0.002)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    o.connect(og).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.045)
  } catch { /* звук не обязателен */ }
}
