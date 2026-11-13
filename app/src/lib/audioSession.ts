// Режим звука iPhone (Safari 17+, navigator.audioSession). Плеер ставит «playback» — звук не глушится беззвучным режимом,
// но в этом режиме iOS не даёт микрофон («AudioSession category is not compatible with audio capture»).
// На время записи переключаем на «play-and-record», после — возвращаем «playback».

type Session = { type: string }
const session = (): Session | undefined => (navigator as Navigator & { audioSession?: Session }).audioSession

export function setPlayback() {
  const s = session()
  if (s) try { s.type = 'playback' } catch { /* старая версия */ }
}

export function setRecording() {
  const s = session()
  if (s) try { s.type = 'play-and-record' } catch { /* старая версия */ }
}
