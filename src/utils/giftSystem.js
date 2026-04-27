// src/utils/giftSystem.js

// Специальный подарок для обновления заданий
export const TASK_REFRESH_GIFT = {
  id: 'task_refresh_token',
  name: 'Жетон обновления',
  emoji: '🎫',
  description: 'Позволяет обновить ежедневные задания в любое время',
  type: 'consumable',
  rarity: 'special',
};

// Уникальные подарки за достижение уровней (каждые 5 уровней)
export const LEVEL_GIFTS = {
  5: {
    id: 'gift_level_5',
    name: 'Бронзовая шашка',
    emoji: '🥉',
    description: 'Награда за достижение 5 уровня! Вы делаете первые шаги в мире шашек.',
    level: 5,
    sellValue: 100, // Опыт за продажу
    rarity: 'common',
  },
  10: {
    id: 'gift_level_10',
    name: 'Серебряная корона',
    emoji: '👑',
    description: 'Награда за достижение 10 уровня! Вы становитесь опытным игроком.',
    level: 10,
    sellValue: 250,
    rarity: 'uncommon',
  },
  15: {
    id: 'gift_level_15',
    name: 'Золотая дамка',
    emoji: '♛',
    description: 'Награда за достижение 15 уровня! Ваше мастерство растет с каждой игрой.',
    level: 15,
    sellValue: 400,
    rarity: 'rare',
  },
  20: {
    id: 'gift_level_20',
    name: 'Кубок чемпиона',
    emoji: '🏆',
    description: 'Награда за достижение 20 уровня! Вы стали профессионалом!',
    level: 20,
    sellValue: 600,
    rarity: 'epic',
  },
  25: {
    id: 'gift_level_25',
    name: 'Алмазная доска',
    emoji: '💎',
    description: 'Награда за достижение 25 уровня! Ваше мастерство сияет как алмаз.',
    level: 25,
    sellValue: 800,
    rarity: 'epic',
  },
  30: {
    id: 'gift_level_30',
    name: 'Звезда эксперта',
    emoji: '⭐',
    description: 'Награда за достижение 30 уровня! Вы достигли уровня эксперта!',
    level: 30,
    sellValue: 1000,
    rarity: 'legendary',
  },
  35: {
    id: 'gift_level_35',
    name: 'Магический кристалл',
    emoji: '🔮',
    description: 'Награда за достижение 35 уровня! Ваша интуиция безупречна.',
    level: 35,
    sellValue: 1200,
    rarity: 'legendary',
  },
  40: {
    id: 'gift_level_40',
    name: 'Корона мастера',
    emoji: '👸',
    description: 'Награда за достижение 40 уровня! Вы стали настоящим мастером!',
    level: 40,
    sellValue: 1500,
    rarity: 'legendary',
  },
  45: {
    id: 'gift_level_45',
    name: 'Огненный феникс',
    emoji: '🔥',
    description: 'Награда за достижение 45 уровня! Ваш дух непобедим!',
    level: 45,
    sellValue: 1800,
    rarity: 'mythic',
  },
  50: {
    id: 'gift_level_50',
    name: 'Легендарный трофей',
    emoji: '🏅',
    description: 'Награда за достижение 50 уровня! Вы вошли в историю как легенда!',
    level: 50,
    sellValue: 2500,
    rarity: 'mythic',
  },
};

// Цвета редкости
export const RARITY_COLORS = {
  common: '#95a5a6',      // Серый
  uncommon: '#27ae60',    // Зеленый
  rare: '#3498db',        // Синий
  epic: '#9b59b6',        // Фиолетовый
  legendary: '#f39c12',   // Оранжевый
  mythic: '#e74c3c',      // Красный
  special: '#4ECDC4',     // Бирюзовый
};

// Названия редкости
export const RARITY_NAMES = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
  mythic: 'Мифический',
  special: 'Особый',
};

// Получить подарок за уровень
export const getGiftForLevel = (level) => {
  return LEVEL_GIFTS[level] || null;
};

// Проверить, должен ли игрок получить подарок
export const shouldReceiveGift = (level) => {
  return level % 5 === 0 && LEVEL_GIFTS[level];
};

// Получить все доступные подарки до определенного уровня
export const getAvailableGifts = (currentLevel) => {
  const gifts = [];
  for (let level = 5; level <= currentLevel; level += 5) {
    if (LEVEL_GIFTS[level]) {
      gifts.push(LEVEL_GIFTS[level]);
    }
  }
  return gifts;
};
