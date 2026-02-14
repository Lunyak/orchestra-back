import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Скрипт для исправления данных, где поле role содержит массив персонажей
 * вместо роли в театре
 */
async function fixRoleCharacters() {
  console.log('Начинаем миграцию данных role -> characters...');

  try {
    // Получаем всех пользователей
    const users = await prisma.userProfile.findMany();
    
    let fixedCount = 0;
    
    for (const user of users) {
      // Пропускаем, если role пустой
      if (!user.role) continue;
      
      try {
        // Пытаемся распарсить role как JSON
        const parsed = JSON.parse(user.role);
        
        // Проверяем, является ли это массивом
        if (Array.isArray(parsed)) {
          console.log(`\nИсправление пользователя: ${user.firstName} ${user.lastName}`);
          console.log(`  Email: ${user.email}`);
          console.log(`  Старое значение role: ${user.role}`);
          console.log(`  Перемещение в characters: ${JSON.stringify(parsed)}`);
          
          // Обновляем пользователя: переносим массив из role в characters, очищаем role
          await prisma.userProfile.update({
            where: { id: user.id },
            data: {
              role: null, // Очищаем роль, чтобы пользователь мог установить правильную
              characters: parsed, // Переносим персонажей
            },
          });
          
          fixedCount++;
          console.log(`  ✅ Исправлено`);
        }
      } catch (parseError) {
        // Если не удалось распарсить как JSON, значит это обычная строка - пропускаем
        continue;
      }
    }
    
    console.log(`\n✅ Миграция завершена. Исправлено записей: ${fixedCount}`);
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
fixRoleCharacters();
