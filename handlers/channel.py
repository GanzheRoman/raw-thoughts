"""
Обработчики для работы с каналом
Обрабатывает лайки и обновления сообщений в канале
"""

from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
import logging

from services.google_sheets import GoogleSheetsService

logger = logging.getLogger(__name__)

# Создаем роутер для работы с каналом
channel_router = Router()


@channel_router.callback_query(F.data.startswith("like_"))
async def handle_like(callback: CallbackQuery, sheets_service: GoogleSheetsService):
    """
    Обработчик нажатия на кнопку лайка в канале
    
    Args:
        callback: Callback от inline-кнопки
        sheets_service: Сервис для работы с Google Sheets
    """
    try:
        # Извлекаем ID проблемы из callback_data
        problem_id = int(callback.data.split("_")[1])
        user_id = callback.from_user.id
        
        # Получаем текущие данные проблемы
        problem_data = sheets_service.get_problem_by_id(problem_id)
        
        if not problem_data:
            await callback.answer("❌ Проблема не найдена")
            return
        
        # Переключаем лайк (добавить/убрать)
        result = sheets_service.toggle_like(problem_id, user_id)
        
        if result[0] is not None:
            new_likes_count, was_added = result
            
            # Обновляем сообщение в канале
            await update_channel_message(callback, problem_id, problem_data['Текст проблемы'], new_likes_count, user_id, sheets_service)
            
            # Уведомляем пользователя
            if was_added:
                await callback.answer(f"👍 Лайк добавлен! Всего: {new_likes_count}")
            else:
                await callback.answer(f"👎 Лайк убран! Всего: {new_likes_count}")
            
            logger.info(f"Пользователь {user_id} {'добавил' if was_added else 'убрал'} лайк к проблеме #{problem_id}, всего лайков: {new_likes_count}")
        else:
            await callback.answer("❌ Ошибка при обновлении лайков")
            
    except Exception as e:
        logger.error(f"Ошибка при обработке лайка: {e}")
        await callback.answer("❌ Произошла ошибка")


async def update_channel_message(callback: CallbackQuery, problem_id: int, problem_text: str, likes_count: int, user_id: int, sheets_service: GoogleSheetsService):
    """
    Обновление сообщения в канале с новым количеством лайков
    
    Args:
        callback: Callback от inline-кнопки
        problem_id: ID проблемы
        problem_text: Текст проблемы
        likes_count: Количество лайков
        user_id: ID пользователя
        sheets_service: Сервис для работы с Google Sheets
    """
    try:
        # Проверяем, лайкнул ли пользователь
        has_liked = sheets_service.has_user_liked(problem_id, user_id)
        
        logger.info(f"Пользователь {user_id} лайкнул проблему #{problem_id}: {has_liked}")
        
        # Форматируем обновленное сообщение
        updated_text = f"""
💭 **Проблема #{problem_id}**

{problem_text}

👍 {likes_count}
        """
        
        # Создаем обновленную клавиатуру в зависимости от статуса лайка
        if has_liked:
            button_text = f"👎 Убрать лайк ({likes_count})"
        else:
            button_text = f"👍 Лайк ({likes_count})"
        
        logger.info(f"Кнопка для проблемы #{problem_id}: {button_text}")
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=button_text, 
                    callback_data=f"like_{problem_id}"
                )
            ]
        ])
        
        # Обновляем сообщение
        await callback.message.edit_text(
            text=updated_text,
            reply_markup=keyboard,
            parse_mode="Markdown"
        )
        
        logger.info(f"Сообщение проблемы #{problem_id} обновлено в канале")
        
    except Exception as e:
        logger.error(f"Ошибка при обновлении сообщения в канале: {e}")


async def get_problem_stats(sheets_service: GoogleSheetsService) -> dict:
    """
    Получение статистики по проблемам
    
    Args:
        sheets_service: Сервис для работы с Google Sheets
        
    Returns:
        Словарь со статистикой
    """
    try:
        all_records = sheets_service.worksheet.get_all_records()
        
        # Подсчитываем статистику
        total_problems = len(all_records)
        approved_problems = [r for r in all_records if r.get('Статус') == 'approved']
        total_likes = sum(int(r.get('Лайки', 0)) for r in approved_problems)
        
        # Находим самую популярную проблему
        most_liked = max(approved_problems, key=lambda x: int(x.get('Лайки', 0)), default={})
        
        stats = {
            'total_problems': total_problems,
            'approved_problems': len(approved_problems),
            'total_likes': total_likes,
            'most_liked': most_liked
        }
        
        return stats
        
    except Exception as e:
        logger.error(f"Ошибка при получении статистики: {e}")
        return {}


async def format_problem_for_channel(problem_id: int, problem_text: str, likes_count: int = 0) -> tuple:
    """
    Форматирование проблемы для публикации в канале
    
    Args:
        problem_id: ID проблемы
        problem_text: Текст проблемы
        likes_count: Количество лайков
        
    Returns:
        Кортеж (текст_сообщения, клавиатура)
    """
    # Форматируем текст сообщения
    channel_text = f"""
💭 **Проблема #{problem_id}**

{problem_text}

👍 {likes_count}
    """
    
    # Создаем клавиатуру с кнопкой лайка
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=f"👍 Лайк ({likes_count})", 
                callback_data=f"like_{problem_id}"
            )
        ]
    ])
    
    return channel_text, keyboard
