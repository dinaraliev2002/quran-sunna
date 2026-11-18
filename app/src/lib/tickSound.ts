// Тихий «деревянный» щелчок для колеса выбора (Web Audio, без файлов): короткий шум + глухой толчок. Если звук недоступен — молча ничего.
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

/** Вид щелчка: шум через полосовой фильтр (n*) и тон-«толчок» под ним (o*). Громкость 0 — части нет */
interface Tick { nf: number; nq: number; ng: number; nd: number; of: number; of2: number; og: number; od: number; ot: OscillatorType }

/** Пробные звуки колеса (№ 1–10; 10 — без звука). № 1 — прежний, № 2 — прежний мягкий */
export const TICK_SOUNDS: { name: string; p: Tick | null }[] = [
  { name: 'Прежний', p: { nf: 2400, nq: 1.4, ng: 0.5, nd: 0.018, of: 260, of2: 110, og: 0.16, od: 0.04, ot: 'sine' } },
  { name: 'Мягкий', p: { nf: 1100, nq: 0.8, ng: 0.12, nd: 0.03, of: 200, of2: 120, og: 0.09, od: 0.06, ot: 'sine' } },
  { name: 'Капля', p: { nf: 700, nq: 0.5, ng: 0.008, nd: 0.025, of: 520, of2: 340, og: 0.055, od: 0.1, ot: 'sine' } },
  { name: 'Глухой', p: { nf: 500, nq: 0.7, ng: 0.06, nd: 0.03, of: 150, of2: 90, og: 0.14, od: 0.08, ot: 'sine' } },
  { name: 'Шёпот', p: { nf: 3200, nq: 0.5, ng: 0.05, nd: 0.025, of: 0, of2: 0, og: 0, od: 0, ot: 'sine' } },
  { name: 'Часы', p: { nf: 1800, nq: 2, ng: 0.14, nd: 0.012, of: 420, of2: 300, og: 0.05, od: 0.03, ot: 'triangle' } },
  { name: 'Пузырёк', p: { nf: 700, nq: 0.5, ng: 0.01, nd: 0.01, of: 340, of2: 760, og: 0.09, od: 0.06, ot: 'sine' } },
  { name: 'Тёплый', p: { nf: 800, nq: 0.6, ng: 0.03, nd: 0.02, of: 330, of2: 250, og: 0.1, od: 0.09, ot: 'triangle' } },
  { name: 'Бархат', p: { nf: 600, nq: 0.5, ng: 0.05, nd: 0.045, of: 180, of2: 140, og: 0.06, od: 0.1, ot: 'sine' } },
  { name: 'Без звука', p: null },
]

/** n — номер звука из TICK_SOUNDS (1–10); по умолчанию мягкий. Web Audio, без файлов */
export function tickSound(n = 2) {
  try {
    const v = TICK_SOUNDS[n - 1]?.p
    if (!v) return
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const t = ctx.currentTime
    if (!noise) {
      noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.05), ctx.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    const n1 = ctx.createBufferSource()
    n1.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = v.nf; f.Q.value = v.nq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(v.ng, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + v.nd + 0.004)
    n1.connect(f).connect(g).connect(ctx.destination)
    n1.start(t)
    if (v.og > 0) {
      const o = ctx.createOscillator()
      const og = ctx.createGain()
      o.type = v.ot
      o.frequency.setValueAtTime(v.of, t)
      o.frequency.exponentialRampToValueAtTime(v.of2, t + v.od)
      og.gain.setValueAtTime(0.0001, t)
      og.gain.exponentialRampToValueAtTime(v.og, t + 0.006)
      og.gain.exponentialRampToValueAtTime(0.0001, t + v.od + 0.006)
      o.connect(og).connect(ctx.destination)
      o.start(t)
      o.stop(t + v.od + 0.03)
    }
  } catch { /* звук не обязателен */ }
}

/** Перед включением микрофона отпускаем звуковую карту: на iPhone работающий Web Audio мешает записи */
export function quietAudio() {
  try { void ctx?.suspend() } catch { /* нечего приостанавливать */ }
}
