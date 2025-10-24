"""
Основной файл для запуска Telegram-бота RawThoughts
Интегрирует все компоненты: пользователи, модерация, канал и Google Sheets
"""

import asyncio
import logging
import os
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

# Импортируем роутеры
from handlers.user import user_router
from handlers.moderation import moderation_router
from handlers.channel import channel_router

# Импортируем сервисы
from services.google_sheets import GoogleSheetsService
from middleware import ContextMiddleware

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


async def main():
    """Основная функция запуска бота"""
    
    # Загружаем переменные окружения
    load_dotenv()
    
    # Получаем конфигурацию из переменных окружения
    bot_token = os.getenv('BOT_TOKEN')
    channel_id = os.getenv('CHANNEL_ID')
    mod_chat_id = os.getenv('MOD_CHAT_ID')
    google_sheet_id = os.getenv('GOOGLE_SHEET_ID')
    google_credentials_path = os.getenv('GOOGLE_CREDENTIALS_PATH', '/etc/secrets/credentials.json')
    
    # Проверяем наличие всех необходимых переменных
    required_vars = {
        'BOT_TOKEN': bot_token,
        'CHANNEL_ID': channel_id,
        'MOD_CHAT_ID': mod_chat_id,
        'GOOGLE_SHEET_ID': google_sheet_id
    }
    
    missing_vars = [var for var, value in required_vars.items() if not value]
    if missing_vars:
        logger.error(f"Отсутствуют обязательные переменные окружения: {', '.join(missing_vars)}")
        return
    
    try:
        # Инициализируем бота и диспетчер
        bot = Bot(token=bot_token)
        storage = MemoryStorage()
        dp = Dispatcher(storage=storage)
        
        # Инициализируем сервис Google Sheets
        sheets_service = GoogleSheetsService(google_credentials_path, google_sheet_id)
        
        # Создаем middleware с контекстом
        context_middleware = ContextMiddleware(
            sheets_service=sheets_service,
            channel_id=channel_id,
            mod_chat_id=mod_chat_id,
            bot=bot
        )
        
        # Регистрируем middleware
        dp.message.middleware(context_middleware)
        dp.callback_query.middleware(context_middleware)
        
        # Регистрируем роутеры
        dp.include_router(user_router)
        dp.include_router(moderation_router)
        dp.include_router(channel_router)
        
        logger.info("Бот RawThoughts запущен успешно!")
        logger.info(f"Канал: {channel_id}")
        logger.info(f"Чат модераторов: {mod_chat_id}")
        logger.info(f"Google Sheets: {google_sheet_id}")
        
        # Запускаем бота
        await dp.start_polling(bot)
        
    except Exception as e:
        logger.error(f"Ошибка при запуске бота: {e}")
    finally:
        if 'bot' in locals():
            await bot.session.close()


def setup_environment():
    """
    Настройка окружения и проверка конфигурации
    """
    logger.info("Проверка конфигурации...")
    
    # Проверяем наличие файла с учетными данными Google
    credentials_path = os.getenv('GOOGLE_CREDENTIALS_PATH', 'credentials.json')
    if not os.path.exists(credentials_path):
        logger.error(f"Файл учетных данных Google не найден: {credentials_path}")
        logger.error("Создайте файл credentials.json с учетными данными Google Service Account")
        return False
    
    # Проверяем наличие .env файла
    if not os.path.exists('.env'):
        logger.warning("Файл .env не найден. Создайте его на основе env.example")
        return False
    
    logger.info("Конфигурация проверена успешно")
    return True


if __name__ == '__main__':
    # Проверяем конфигурацию перед запуском
    if setup_environment():
        try:
            # Запускаем бота
            asyncio.run(main())
        except KeyboardInterrupt:
            logger.info("Бот остановлен пользователем")
        except Exception as e:
            logger.error(f"Критическая ошибка: {e}")
    else:
        logger.error("Не удалось запустить бота из-за проблем с конфигурацией")
