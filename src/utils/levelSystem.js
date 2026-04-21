// src/utils/levelSystem.js

// Опыт за различные действия
export const EXP_REWARDS = {
  WIN_ONLINE: 300,      // Победа над реальным игроком
  LOSE_ONLINE: 50,      // Поражение от реального игрока
  WIN_BOT_EASY: 30,     // Победа над легким ботом
  WIN_BOT_MEDIUM: 50,   // Победа над средним ботом
  WIN_BOT_HARD: 80,     // Победа над сложным ботом
  WIN_BOT_GRANDMASTER: 100, // Победа над гроссмейстером
  LOSE_BOT: 20,         // Поражение от бота
  // Локальная игра не дает опыта
};

// Расчет опыта для следующего уровня
export const getExpForLevel = (level) => {
  // Формула: 100 * level (линейный рост)
  // Уровень 1->2: 100 опыта
  // Уровень 2->3: 200 опыта
  // Уровень 3->4: 300 опыта и т.д.
  return 100 * level;
};

// Получить текущий уровень по общему опыту
export const getLevelFromExp = (totalExp) => {
  let level = 1;
  let expNeeded = 0;

  while (totalExp >= expNeeded + getExpForLevel(level)) {
    expNeeded += getExpForLevel(level);
    level++;
  }

  return {
    level,
    currentLevelExp: totalExp - expNeeded,
    expForNextLevel: getExpForLevel(level),
    totalExp,
  };
};

// Получить название ранга по уровню
export const getRankName = (level) => {
  if (level >= 50) return '🏆 Легенда';
  if (level >= 40) return '💎 Мастер';
  if (level >= 30) return '⭐ Эксперт';
  if (level >= 20) return '🥇 Профи';
  if (level >= 10) return '🥈 Опытный';
  if (level >= 5) return '🥉 Любитель';
  return '🌱 Новичок';
};

// Получить цвет прогресс-бара по уровню
export const getLevelColor = (level) => {
  if (level >= 50) return '#FFD700'; // Золотой
  if (level >= 40) return '#E91E63'; // Розовый
  if (level >= 30) return '#9C27B0'; // Фиолетовый
  if (level >= 20) return '#2196F3'; // Синий
  if (level >= 10) return '#4CAF50'; // Зеленый
  if (level >= 5) return '#FF9800';  // Оранжевый
  return '#4ECDC4'; // Бирюзовый (начальный)
};
