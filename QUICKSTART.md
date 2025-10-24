# 🚀 Быстрый запуск RawThoughts Bot

## ⚡ Быстрая настройка (5 минут)

### 1. Установка зависимостей
```bash
pip install -r requirements.txt
```

### 2. Создание бота в Telegram
1. Напишите [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot`
3. Введите имя: `RawThoughts Bot`
4. Введите username: `rawthoughts_bot`
5. **Скопируйте токен** (начинается с цифр)

### 3. Создание канала и чата
1. **Создайте канал** для публикации проблем
2. **Создайте группу** для модераторов
3. Добавьте бота как администратора в оба

### 4. Получение ID
```bash
python utils/get_ids.py
```
- Отправьте сообщение в канал/группу
- Скопируйте ID (начинаются с -100)

### 5. Настройка Google Sheets
1. Создайте таблицу в [Google Sheets](https://sheets.google.com)
2. Скопируйте ID из URL таблицы
3. Создайте Service Account в [Google Cloud Console](https://console.cloud.google.com)
4. Скачайте JSON ключ → переименуйте в `credentials.json`
5. Поделитесь таблицей с email из JSON файла

### 6. Создание .env файла
```bash
cp env.example .env
```

Заполните `.env`:
```env
BOT_TOKEN=ваш_токен_от_botfather
CHANNEL_ID=-1001234567890
MOD_CHAT_ID=-1001234567890
GOOGLE_SHEET_ID=1ABCdefGHIjklMNOpqrsTUVwxyz
GOOGLE_CREDENTIALS_PATH=credentials.json
```

### 7. Тестирование
```bash
python test_sheets.py
```

### 8. Запуск бота
```bash
python main.py
```

## ✅ Проверка работы

1. **Пользователь**: `/start` → отправить проблему
2. **Модератор**: получить уведомление → нажать "✅ Одобрить"
3. **Канал**: проверить публикацию → нажать "👍 Лайк"

## 🆘 Если что-то не работает

### Бот не отвечает
- Проверьте BOT_TOKEN
- Убедитесь, что бот запущен
- Проверьте логи: `tail -f bot.log`

### Ошибки Google Sheets
- Запустите: `python test_sheets.py`
- Проверьте credentials.json
- Убедитесь, что Service Account имеет доступ к таблице

### Проблемы с каналом
- Проверьте ID канала (должны начинаться с -100)
- Убедитесь, что бот - администратор канала
- Используйте `utils/get_ids.py` для получения правильных ID

## 📞 Поддержка

Если проблемы остаются:
1. Проверьте `bot.log`
2. Запустите `python test_sheets.py`
3. Убедитесь, что все ID правильные
4. Проверьте права бота в Telegram
