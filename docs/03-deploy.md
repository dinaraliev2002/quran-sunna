# Шаг 3. Публикация и кнопка в боте

Адрес приложения: **https://dinaraliev2002.github.io/quran-sunna/**
Код: https://github.com/dinaraliev2002/quran-sunna (публичный репозиторий)

## Кнопка «Открыть» в @quran_sunna_app_bot (сделать один раз)

### 1. Кнопка меню в чате с ботом
1. Откройте **@BotFather** → отправьте `/mybots` → выберите **@quran_sunna_app_bot**.
2. **Bot Settings** → **Menu Button** → **Configure menu button**.
3. Отправьте адрес: `https://dinaraliev2002.github.io/quran-sunna/`
4. Отправьте название кнопки: `Открыть`

### 2. Основное мини-приложение (кнопка «Открыть» в профиле бота и прямая ссылка)
1. В **@BotFather** → `/mybots` → **@quran_sunna_app_bot** → **Bot Settings** → **Configure Mini App** → **Enable Mini App**.
2. Отправьте тот же адрес: `https://dinaraliev2002.github.io/quran-sunna/`

После этого приложение открывается:
- кнопкой «Открыть» слева от поля ввода в чате с ботом;
- кнопкой «Открыть» в профиле бота;
- по ссылке `https://t.me/quran_sunna_app_bot?startapp` (ею можно делиться).

## Как выложить новую версию
```
cd app
npm run deploy
```
Через 1–2 минуты новая версия будет по тому же адресу. В Telegram иногда нужно закрыть и заново открыть приложение.
