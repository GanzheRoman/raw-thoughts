"""
Сервис для работы с Google Sheets API
Обрабатывает создание, обновление и получение данных из таблицы
"""

import gspread
from google.oauth2.service_account import Credentials
import os
import json
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class GoogleSheetsService:
    """Класс для работы с Google Sheets"""
    
    def __init__(self, credentials_path: str, sheet_id: str):
        """
        Инициализация сервиса Google Sheets
        
        Args:
            credentials_path: Путь к JSON файлу с учетными данными
            sheet_id: ID Google Sheets таблицы
        """
        self.sheet_id = sheet_id
        self.credentials_path = credentials_path
        self.client = None
        self.worksheet = None
        self._connect()
    
    def _connect(self):
        """Подключение к Google Sheets"""
        try:
            # Настройка области видимости для Google Sheets API
            scope = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
            
            # Загрузка учетных данных
            if os.path.exists(self.credentials_path):
                # Локальная разработка - файл существует
                credentials = Credentials.from_service_account_file(
                    self.credentials_path, 
                    scopes=scope
                )
            else:
                # Продакшн (Render) - загружаем из переменной окружения
                creds_json = os.getenv('GOOGLE_CREDENTIALS')
                if creds_json:
                    credentials_info = json.loads(creds_json)
                    credentials = Credentials.from_service_account_info(
                        credentials_info,
                        scopes=scope
                    )
                else:
                    raise FileNotFoundError(f"Credentials not found at {self.credentials_path} and GOOGLE_CREDENTIALS env var not set")
            
            # Создание клиента
            self.client = gspread.authorize(credentials)
            
            # Открытие таблицы
            spreadsheet = self.client.open_by_key(self.sheet_id)
            self.worksheet = spreadsheet.sheet1
            
            # Создание заголовков, если их нет
            self._setup_headers()
            
            logger.info("Успешно подключились к Google Sheets")
            
        except Exception as e:
            logger.error(f"Ошибка подключения к Google Sheets: {e}")
            raise
    
    def _setup_headers(self):
        """Создание заголовков в таблице, если их нет"""
        try:
            # Проверяем, есть ли заголовки
            headers = self.worksheet.row_values(1)
            expected_headers = ['ID', 'Текст проблемы', 'Лайки', 'Статус', 'Дата создания']
            
            if not headers or headers != expected_headers:
                # Добавляем заголовки
                self.worksheet.update('A1:E1', [expected_headers])
                logger.info("Заголовки таблицы созданы")
                
        except Exception as e:
            logger.error(f"Ошибка при создании заголовков: {e}")
    
    def add_problem(self, problem_text: str) -> int:
        """
        Добавление новой проблемы в таблицу
        
        Args:
            problem_text: Текст проблемы
            
        Returns:
            ID созданной записи
        """
        try:
            # Получаем следующий ID
            next_id = self._get_next_id()
            
            # Получаем текущую дату
            from datetime import datetime
            current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Добавляем новую строку
            new_row = [next_id, problem_text, 0, "pending", current_date]
            self.worksheet.append_row(new_row)
            
            logger.info(f"Добавлена новая проблема с ID {next_id}")
            return next_id
            
        except Exception as e:
            logger.error(f"Ошибка при добавлении проблемы: {e}")
            raise
    
    def _get_next_id(self) -> int:
        """Получение следующего ID для новой записи"""
        try:
            # Получаем все ID из первого столбца (кроме заголовка)
            id_column = self.worksheet.col_values(1)[1:]  # Пропускаем заголовок
            
            if not id_column:
                return 1
            
            # Находим максимальный ID
            max_id = max(int(id_val) for id_val in id_column if id_val.isdigit())
            return max_id + 1
            
        except Exception as e:
            logger.error(f"Ошибка при получении следующего ID: {e}")
            return 1
    
    def update_status(self, problem_id: int, status: str) -> bool:
        """
        Обновление статуса проблемы
        
        Args:
            problem_id: ID проблемы
            status: Новый статус ("approved" или "rejected")
            
        Returns:
            True если обновление прошло успешно
        """
        try:
            # Находим строку с нужным ID
            id_column = self.worksheet.col_values(1)
            
            for row_num, cell_id in enumerate(id_column, 1):
                if str(cell_id) == str(problem_id):
                    # Обновляем статус в столбце D (4-й столбец)
                    self.worksheet.update_cell(row_num, 4, status)
                    logger.info(f"Статус проблемы {problem_id} обновлен на {status}")
                    return True
            
            logger.warning(f"Проблема с ID {problem_id} не найдена")
            return False
            
        except Exception as e:
            logger.error(f"Ошибка при обновлении статуса: {e}")
            return False
    
    def update_likes(self, problem_id: int, new_likes_count: int) -> bool:
        """
        Обновление количества лайков
        
        Args:
            problem_id: ID проблемы
            new_likes_count: Новое количество лайков
            
        Returns:
            True если обновление прошло успешно
        """
        try:
            # Находим строку с нужным ID
            id_column = self.worksheet.col_values(1)
            
            for row_num, cell_id in enumerate(id_column, 1):
                if str(cell_id) == str(problem_id):
                    # Обновляем количество лайков в столбце C (3-й столбец)
                    self.worksheet.update_cell(row_num, 3, new_likes_count)
                    logger.info(f"Лайки проблемы {problem_id} обновлены на {new_likes_count}")
                    return True
            
            logger.warning(f"Проблема с ID {problem_id} не найдена")
            return False
            
        except Exception as e:
            logger.error(f"Ошибка при обновлении лайков: {e}")
            return False
    
    def get_problem_by_id(self, problem_id: int) -> Optional[Dict[str, Any]]:
        """
        Получение информации о проблеме по ID
        
        Args:
            problem_id: ID проблемы
            
        Returns:
            Словарь с данными проблемы или None
        """
        try:
            # Получаем все данные из таблицы
            all_records = self.worksheet.get_all_records()
            
            for record in all_records:
                if record.get('ID') == problem_id:
                    return record
            
            return None
            
        except Exception as e:
            logger.error(f"Ошибка при получении проблемы: {e}")
            return None
    
    def get_pending_problems(self) -> list:
        """
        Получение всех проблем со статусом "pending"
        
        Returns:
            Список проблем в ожидании модерации
        """
        try:
            all_records = self.worksheet.get_all_records()
            pending_problems = [
                record for record in all_records 
                if record.get('Статус') == 'pending'
            ]
            return pending_problems
            
        except Exception as e:
            logger.error(f"Ошибка при получении ожидающих проблем: {e}")
            return []
