"""
Обработчики для модерации проблем
Обрабатывает кнопки одобрения/отклонения от модераторов
"""

from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, Message
from aiogram.filters import Command
import logging

from services.google_sheets import GoogleSheetsService

logger = logging.getLogger(__name__)

# Создаем роутер для модерации
moderation_router = Router()


async def send_to_moderators(bot, mod_chat_id: int, problem_id: int, problem_text: str, moderator_ids: list = None):
    """
    Отправка проблемы модераторам для рассмотрения
    Только в ЛС модераторам, не в групповой чат.
    """
    try:
        moderation_text = f"""
🔍 **Новая проблема для модерации**

**ID:** #{problem_id}
**Текст:** {problem_text}

Выберите действие:
        """
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Одобрить", 
                    callback_data=f"approve_{problem_id}"
                ),
                InlineKeyboardButton(
                    text="❌ Отклонить", 
                    callback_data=f"reject_{problem_id}"
                )
            ]
        ])
        if not moderator_ids:
            moderator_ids = [719991464]  # Fallback, если context не передан
        # Отправляем только в ЛС модераторам
        for moderator_id in moderator_ids:
            try:
                await bot.send_message(
                    chat_id=moderator_id,
                    text=moderation_text,
                    reply_markup=keyboard,
                    parse_mode="Markdown"
                )
                logger.info(f"Проблема #{problem_id} отправлена модератору {moderator_id}")
            except Exception as mod_error:
                logger.error(f"Ошибка отправки модератору {moderator_id}: {mod_error}")
        # Исключаем публикацию в модераторский чат:
        # if mod_chat_id:
        #     try:
        #         await bot.send_message(
        #             chat_id=mod_chat_id,
        #             text=moderation_text,
        #             reply_markup=keyboard,
        #             parse_mode="Markdown"
        #         )
        #         logger.info(f"Проблема #{problem_id} отправлена в чат модераторов")
        #     except Exception as chat_error:
        #         logger.error(f"Ошибка отправки в чат модераторов: {chat_error}")
    except Exception as e:
        logger.error(f"Ошибка при отправке модераторам: {e}")


@moderation_router.callback_query(F.data.startswith("approve_"))
async def approve_problem(callback: CallbackQuery, sheets_service: GoogleSheetsService, 
                         bot, channel_id: str):
    """
    Обработчик одобрения проблемы модератором
    
    Args:
        callback: Callback от inline-кнопки
        sheets_service: Сервис для работы с Google Sheets
        bot: Экземпляр бота
        channel_id: ID канала для публикации
    """
    try:
        # Извлекаем ID проблемы из callback_data
        problem_id = int(callback.data.split("_")[1])
        
        # Обновляем статус в Google Sheets
        success = sheets_service.update_status(problem_id, "approved")
        
        if success:
            # Получаем данные проблемы
            problem_data = sheets_service.get_problem_by_id(problem_id)
            
            if problem_data:
                # Публикуем в канал
                await publish_to_channel(
                    bot, int(channel_id), problem_id, 
                    problem_data['Текст проблемы']
                )
                
                # Уведомляем модератора
                await callback.answer("✅ Проблема одобрена и опубликована в канале!")
                await callback.message.edit_text(
                    f"✅ **Одобрено**\n\n**ID:** #{problem_id}\n**Статус:** Опубликовано в канале"
                )
                
                logger.info(f"Проблема #{problem_id} одобрена и опубликована")
            else:
                await callback.answer("❌ Ошибка: данные проблемы не найдены")
        else:
            await callback.answer("❌ Ошибка при обновлении статуса")
            
    except Exception as e:
        logger.error(f"Ошибка при одобрении проблемы: {e}")
        await callback.answer("❌ Произошла ошибка")


@moderation_router.callback_query(F.data.startswith("reject_"))
async def reject_problem(callback: CallbackQuery, sheets_service: GoogleSheetsService):
    """
    Обработчик отклонения проблемы модератором
    
    Args:
        callback: Callback от inline-кнопки
        sheets_service: Сервис для работы с Google Sheets
    """
    try:
        # Извлекаем ID проблемы из callback_data
        problem_id = int(callback.data.split("_")[1])
        
        # Обновляем статус в Google Sheets
        success = sheets_service.update_status(problem_id, "rejected")
        
        if success:
            # Уведомляем модератора
            await callback.answer("❌ Проблема отклонена")
            await callback.message.edit_text(
                f"❌ **Отклонено**\n\n**ID:** #{problem_id}\n**Статус:** Отклонено модератором"
            )
            
            logger.info(f"Проблема #{problem_id} отклонена")
        else:
            await callback.answer("❌ Ошибка при обновлении статуса")
            
    except Exception as e:
        logger.error(f"Ошибка при отклонении проблемы: {e}")
        await callback.answer("❌ Произошла ошибка")


async def publish_to_channel(bot, channel_id: int, problem_id: int, problem_text: str):
    """
    Публикация одобренной проблемы в канал
    
    Args:
        bot: Экземпляр бота
        channel_id: ID канала
        problem_id: ID проблемы
        problem_text: Текст проблемы
    """
    try:
        # Форматируем сообщение для канала
        channel_text = f"""
💭 **Проблема #{problem_id}**

{problem_text}

👍 0
        """
        
        # Создаем inline-кнопку для лайков (изначально "Лайк")
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="👍 Лайк (0)", 
                    callback_data=f"like_{problem_id}"
                )
            ]
        ])
        
        # Публикуем в канал
        await bot.send_message(
            chat_id=channel_id,
            text=channel_text,
            reply_markup=keyboard,
            parse_mode="Markdown"
        )
        
        logger.info(f"Проблема #{problem_id} опубликована в канале")
        
    except Exception as e:
        logger.error(f"Ошибка при публикации в канал: {e}")


@moderation_router.message(Command("modstats"))
async def moderation_stats(message: Message, sheets_service: GoogleSheetsService):
    """
    Команда для получения статистики модерации
    Доступна только в чате модераторов
    """
    try:
        # Получаем статистику из Google Sheets
        all_records = sheets_service.worksheet.get_all_records()
        
        total_problems = len(all_records)
        pending_count = len([r for r in all_records if r.get('Статус') == 'pending'])
        approved_count = len([r for r in all_records if r.get('Статус') == 'approved'])
        rejected_count = len([r for r in all_records if r.get('Статус') == 'rejected'])
        
        stats_text = f"""
📊 **Статистика модерации**

**Всего проблем:** {total_problems}
**Ожидают модерации:** {pending_count}
**Одобрено:** {approved_count}
**Отклонено:** {rejected_count}
        """
        
        await message.answer(stats_text, parse_mode="Markdown")
        
    except Exception as e:
        logger.error(f"Ошибка при получении статистики: {e}")
        await message.answer("❌ Ошибка при получении статистики")


@moderation_router.message(Command("pending"))
async def show_pending_problems(message: Message, sheets_service: GoogleSheetsService):
    """Показать все проблемы, ожидающие модерации"""
    try:
        pending_problems = sheets_service.get_pending_problems()
        
        if not pending_problems:
            await message.answer("📭 Нет проблем, ожидающих модерации")
            return
        
        text = f"⏳ **Проблемы на модерации ({len(pending_problems)}):**\n\n"
        
        for problem in pending_problems:
            text += f"**#{problem.get('ID')}** - {problem.get('Текст проблемы', '')[:100]}{'...' if len(problem.get('Текст проблемы', '')) > 100 else ''}\n"
            text += f"📅 {problem.get('Дата создания', '')}\n\n"
        
        # Разбиваем на части, если сообщение слишком длинное
        if len(text) > 4000:
            parts = [text[i:i+4000] for i in range(0, len(text), 4000)]
            for part in parts:
                await message.answer(part, parse_mode="Markdown")
        else:
            await message.answer(text, parse_mode="Markdown")
            
    except Exception as e:
        logger.error(f"Ошибка при получении ожидающих проблем: {e}")
        await message.answer("❌ Ошибка при получении данных")


@moderation_router.message(Command("approve"))
async def approve_problem_command(message: Message, sheets_service: GoogleSheetsService, bot, channel_id: str):
    """Команда для одобрения проблемы: /approve <ID>"""
    try:
        command_text = message.text.split()
        if len(command_text) < 2:
            await message.answer("❌ Использование: /approve <ID_проблемы>")
            return
        
        try:
            problem_id = int(command_text[1])
        except ValueError:
            await message.answer("❌ ID должен быть числом")
            return
        
        problem_data = sheets_service.get_problem_by_id(problem_id)
        if not problem_data:
            await message.answer(f"❌ Проблема #{problem_id} не найдена")
            return
        
        if problem_data.get('Статус') != 'pending':
            await message.answer(f"❌ Проблема #{problem_id} уже обработана")
            return
        
        success = sheets_service.update_status(problem_id, "approved")
        
        if success:
            await publish_to_channel(bot, int(channel_id), problem_id, problem_data['Текст проблемы'])
            await message.answer(f"✅ Проблема #{problem_id} одобрена и опубликована в канале!")
        else:
            await message.answer(f"❌ Ошибка при одобрении проблемы #{problem_id}")
            
    except Exception as e:
        logger.error(f"Ошибка при одобрении: {e}")
        await message.answer("❌ Произошла ошибка")


@moderation_router.message(Command("reject"))
async def reject_problem_command(message: Message, sheets_service: GoogleSheetsService):
    """Команда для отклонения проблемы: /reject <ID>"""
    try:
        command_text = message.text.split()
        if len(command_text) < 2:
            await message.answer("❌ Использование: /reject <ID_проблемы>")
            return
        
        try:
            problem_id = int(command_text[1])
        except ValueError:
            await message.answer("❌ ID должен быть числом")
            return
        
        problem_data = sheets_service.get_problem_by_id(problem_id)
        if not problem_data:
            await message.answer(f"❌ Проблема #{problem_id} не найдена")
            return
        
        if problem_data.get('Статус') != 'pending':
            await message.answer(f"❌ Проблема #{problem_id} уже обработана")
            return
        
        success = sheets_service.update_status(problem_id, "rejected")
        
        if success:
            await message.answer(f"❌ Проблема #{problem_id} отклонена")
        else:
            await message.answer(f"❌ Ошибка при отклонении проблемы #{problem_id}")
            
    except Exception as e:
        logger.error(f"Ошибка при отклонении: {e}")
        await message.answer("❌ Произошла ошибка")
