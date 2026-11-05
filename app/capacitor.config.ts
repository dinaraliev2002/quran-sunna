import type { CapacitorConfig } from '@capacitor/cli'

// Идентификатор приложения (appId) менять можно только до первой публикации в магазинах.
const config: CapacitorConfig = {
  appId: 'app.quransunna.reader',
  appName: 'Коран и Сунна',
  webDir: 'dist',
  backgroundColor: '#0E1110',
  ios: { contentInset: 'never', scrollEnabled: false },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#13704B' },
    SplashScreen: { launchAutoHide: true, launchShowDuration: 600, backgroundColor: '#0E1110' },
  },
}

export default config
