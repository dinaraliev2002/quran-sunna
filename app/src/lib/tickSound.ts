// Тихий короткий щелчок для колеса выбора числа (Web Audio, без файлов). Если звук недоступен — молча ничего.
let ctx: AudioContext | null = null

export function tickSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(1500, t)
    o.frequency.exponentialRampToValueAtTime(900, t + 0.025)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.04)
  } catch { /* звук не обязателен */ }
}
