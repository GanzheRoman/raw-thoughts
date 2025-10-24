# ⚡ Быстрый деплой на Render

## 🚀 За 5 минут

### 1. Подготовка
- ✅ GitHub репозиторий с кодом
- ✅ Telegram Bot Token
- ✅ Google Service Account JSON
- ✅ ID канала и чата модераторов

### 2. Создание сервиса на Render
1. [Render Dashboard](https://dashboard.render.com) → "New" → "Web Service"
2. Подключите GitHub репозиторий
3. Настройки:
   - **Name**: `rawthoughts-bot`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`

### 3. Переменные окружения
```
BOT_TOKEN=ваш_токен_от_botfather
CHANNEL_ID=-1001234567890
MOD_CHAT_ID=-1001234567890
GOOGLE_SHEET_ID=ваш_id_google_sheets
GOOGLE_CREDENTIALS_PATH=/etc/secrets/credentials.json
```

### 4. Secret Files
- **File Path**: `/etc/secrets/credentials.json`
- **File Content**: Содержимое Google Service Account JSON

### 5. Деплой
- Нажмите "Create Web Service"
- Дождитесь сборки (2-3 минуты)
- Проверьте логи

## ✅ Проверка
1. Логи без ошибок
2. Бот отвечает на `/start`
3. Проблемы отправляются модераторам
4. Одобренные проблемы публикуются в канал

## 🆘 Если не работает
- Проверьте все переменные окружения
- Убедитесь, что Secret File добавлен
- Проверьте права бота в Telegram
- Поделитесь Google Sheets с Service Account

**Готово!** 🎉
