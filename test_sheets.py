"""
Скрипт для тестирования интеграции с Google Sheets
Проверяет подключение и основные функции
"""

import os
from dotenv import load_dotenv
from services.google_sheets import GoogleSheetsService

def test_google_sheets():
    """Тестирование Google Sheets интеграции"""
    
    # Загружаем переменные окружения
    load_dotenv()
    
    # Получаем конфигурацию
    sheet_id = os.getenv('GOOGLE_SHEET_ID')
    credentials_path = os.getenv('GOOGLE_CREDENTIALS_PATH', 'credentials.json')
    
    if not sheet_id:
        print("❌ Ошибка: GOOGLE_SHEET_ID не найден в .env файле")
        return False
    
    if not os.path.exists(credentials_path):
        print(f"❌ Ошибка: Файл {credentials_path} не найден")
        return False
    
    try:
        print("🔄 Подключение к Google Sheets...")
        
        # Инициализируем сервис
        sheets_service = GoogleSheetsService(credentials_path, sheet_id)
        
        print("✅ Подключение успешно!")
        
        # Тестируем добавление проблемы
        print("🔄 Тестирование добавления проблемы...")
        test_problem = "Тестовая проблема для проверки интеграции"
        problem_id = sheets_service.add_problem(test_problem)
        
        print(f"✅ Проблема добавлена с ID: {problem_id}")
        
        # Тестируем получение проблемы
        print("🔄 Тестирование получения проблемы...")
        problem_data = sheets_service.get_problem_by_id(problem_id)
        
        if problem_data:
            print(f"✅ Проблема получена: {problem_data}")
        else:
            print("❌ Проблема не найдена")
            return False
        
        # Тестируем обновление статуса
        print("🔄 Тестирование обновления статуса...")
        success = sheets_service.update_status(problem_id, "approved")
        
        if success:
            print("✅ Статус обновлен успешно")
        else:
            print("❌ Ошибка обновления статуса")
            return False
        
        # Тестируем обновление лайков
        print("🔄 Тестирование обновления лайков...")
        success = sheets_service.update_likes(problem_id, 5)
        
        if success:
            print("✅ Лайки обновлены успешно")
        else:
            print("❌ Ошибка обновления лайков")
            return False
        
        print("\n🎉 Все тесты прошли успешно!")
        print("✅ Google Sheets интеграция работает корректно")
        
        return True
        
    except Exception as e:
        print(f"❌ Ошибка при тестировании: {e}")
        return False

if __name__ == '__main__':
    print("🧪 Тестирование Google Sheets интеграции")
    print("=" * 50)
    
    if test_google_sheets():
        print("\n✅ Интеграция настроена правильно!")
        print("Теперь можно запускать бота: python main.py")
    else:
        print("\n❌ Проблемы с интеграцией Google Sheets")
        print("Проверьте настройки в .env файле и credentials.json")
