"""
Middleware для передачи контекста в обработчики
"""

from aiogram import BaseMiddleware
from typing import Callable, Dict, Any, Awaitable
from aiogram.types import Message, CallbackQuery


class ContextMiddleware(BaseMiddleware):
    """Middleware для передачи контекста в обработчики"""
    
    def __init__(self, **kwargs):
        self.context = kwargs
    
    async def __call__(
        self,
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        event: Message | CallbackQuery,
        data: Dict[str, Any]
    ) -> Any:
        # Добавляем контекст в data
        data.update(self.context)
        return await handler(event, data)
