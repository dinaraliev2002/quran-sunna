// Тихий «деревянный» щелчок для колеса выбора (Web Audio, без файлов): короткий шум + глухой толчок. Если звук недоступен — молча ничего.
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

/** soft — мягче и глуше (колонка скорости) */
export function tickSound(soft = false) {
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
    f.type = 'bandpass'; f.frequency.value = soft ? 1100 : 2400; f.Q.value = soft ? 0.8 : 1.4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(soft ? 0.12 : 0.5, t + (soft ? 0.004 : 0.001))
    g.gain.exponentialRampToValueAtTime(0.0001, t + (soft ? 0.03 : 0.018))
    n.connect(f).connect(g).connect(ctx.destination)
    n.start(t)
    // глухой толчок под ним — чтобы звучало «материально»
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(soft ? 200 : 260, t)
    o.frequency.exponentialRampToValueAtTime(soft ? 120 : 110, t + 0.04)
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(soft ? 0.09 : 0.16, t + (soft ? 0.006 : 0.002))
    og.gain.exponentialRampToValueAtTime(0.0001, t + (soft ? 0.06 : 0.04))
    o.connect(og).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.07)
  } catch { /* звук не обязателен */ }
}
