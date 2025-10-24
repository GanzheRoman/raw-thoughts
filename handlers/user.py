"""
Обработчики сообщений от пользователей
Обрабатывает команды и текстовые сообщения от обычных пользователей
"""

from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command
import logging

from services.google_sheets import GoogleSheetsService

logger = logging.getLogger(__name__)

# Создаем роутер для пользовательских сообщений
user_router = Router()


@user_router.message(Command("start"))
async def start_command(message: Message):
    """
    Обработчик команды /start
    Отправляет приветственное сообщение с инструкциями
    """
    welcome_text = """
🤖 **Добро пожаловать в RawThoughts!**

Отправь сюда проблему, которая тебя раздражает или мешает. 
После модерации она может попасть в канал RawThoughts.

Просто напиши свою проблему в следующем сообщении!
    """
    
    await message.answer(welcome_text, parse_mode="Markdown")
    logger.info(f"Пользователь {message.from_user.id} запустил бота")


@user_router.message(F.text)
async def handle_text_message(message: Message, sheets_service: GoogleSheetsService, bot, mod_chat_id: str, moderator_ids: list):
    """
    Обработчик текстовых сообщений от пользователей
    Сохраняет проблему в Google Sheets и отправляет на модерацию
    """
    try:
        # Проверяем, что сообщение НЕ из чата модераторов
        if str(message.chat.id) == str(mod_chat_id):
            return  # Игнорируем сообщения из чата модераторов
        
        # Получаем текст проблемы
        problem_text = message.text.strip()
        
        # Проверяем, что сообщение не пустое
        if not problem_text:
            await message.answer("Пожалуйста, отправьте текст проблемы.")
            return
        
        # Проверяем длину сообщения (максимум 1000 символов)
        if len(problem_text) > 1000:
            await message.answer(
                "Сообщение слишком длинное. Пожалуйста, сократите до 1000 символов."
            )
            return
        
        # Сохраняем проблему в Google Sheets
        problem_id = sheets_service.add_problem(problem_text)
        
        # Отправляем подтверждение пользователю
        confirmation_text = f"""
✅ **Ваша проблема получена!**

**ID проблемы:** #{problem_id}
**Статус:** Ожидает модерации

Ваша проблема отправлена на модерацию. Если она будет одобрена, 
то появится в канале RawThoughts с возможностью голосования.
        """
        
        await message.answer(confirmation_text, parse_mode="Markdown")
        
        # Отправляем проблему модераторам
        from handlers.moderation import send_to_moderators
        await send_to_moderators(bot, int(mod_chat_id), problem_id, problem_text, moderator_ids)
        
        logger.info(f"Пользователь {message.from_user.id} отправил проблему #{problem_id}")
        
    except Exception as e:
        logger.error(f"Ошибка при обработке сообщения пользователя: {e}")
        await message.answer(
            "Произошла ошибка при сохранении вашей проблемы. "
            "Попробуйте еще раз позже."
        )


@user_router.message()
async def handle_other_messages(message: Message):
    """
    Обработчик для всех остальных типов сообщений
    (фото, видео, документы и т.д.)
    """
    await message.answer(
        "Пожалуйста, отправляйте только текстовые сообщения с описанием проблемы."
    )
