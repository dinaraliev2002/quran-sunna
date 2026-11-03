// Что экран чтения передаёт аятам: действия и настройки показа

export interface AyahActions {
  playing: string | null
  /** идёт ли звук прямо сейчас (для кнопки ▶/⏸ у звучащего аята) */
  sounding: boolean
  onToggle: () => void
  hidden: (key: string) => boolean
  bookmarked: (key: string) => boolean
  onPlay: (surah: number, ayah: number) => void
  /** окно аята: перевод + тафсир */
  onInfo: (surah: number, ayah: number) => void
  onBookmark: (key: string) => void
}

export interface ViewOpts { tajweed: boolean; translation: 'ku' | 'aa'; wbw: boolean }
