"""
Утилита для получения ID каналов и чатов Telegram
Помогает настроить бота, получая необходимые ID
"""

import asyncio
import os
from dotenv import load_dotenv
from aiogram import Bot

# Загружаем переменные окружения
load_dotenv()

async def get_chat_info(bot_token: str):
    """
    Получение информации о чатах и каналах для настройки бота
    
    Args:
        bot_token: Токен бота
    """
    bot = Bot(token=bot_token)
    
    print("🤖 Бот запущен для получения ID чатов и каналов")
    print("📋 Инструкции:")
    print("1. Добавьте бота в канал/чат как администратора")
    print("2. Отправьте любое сообщение в канал/чат")
    print("3. Скопируйте ID из вывода ниже")
    print("4. Нажмите Ctrl+C для остановки")
    print("-" * 50)
    
    try:
        # Получаем обновления
        async for update in bot.get_updates():
            if update.message:
                chat = update.message.chat
                print(f"📱 Чат: {chat.title or 'Личные сообщения'}")
                print(f"🆔 ID: {chat.id}")
                print(f"👤 Тип: {chat.type}")
                print("-" * 30)
                
            elif update.channel_post:
                chat = update.channel_post.chat
                print(f"📺 Канал: {chat.title}")
                print(f"🆔 ID: {chat.id}")
                print(f"👤 Тип: {chat.type}")
                print("-" * 30)
                
    except KeyboardInterrupt:
        print("\n⏹ Остановка...")
    finally:
        await bot.session.close()


async def main():
    """Основная функция"""
    bot_token = os.getenv('BOT_TOKEN')
    
    if not bot_token:
        print("❌ Ошибка: BOT_TOKEN не найден в .env файле")
        print("Создайте .env файл и добавьте BOT_TOKEN=your_token_here")
        return
    
    await get_chat_info(bot_token)


if __name__ == '__main__':
    asyncio.run(main())
