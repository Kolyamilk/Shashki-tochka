// src/utils/avatarSystem.js

// Типы требований для разблокировки аватарок
export const REQUIREMENT_TYPES = {
  NONE: 'none',           // Доступна сразу
  LEVEL: 'level',         // Требуется уровень
  TOTAL_GAMES: 'games',   // Требуется количество игр
  WINS: 'wins',           // Требуется количество побед
};

// Конфигурация аватарок с требованиями
export const AVATAR_CONFIG = [
  // Базовые аватарки (доступны сразу)
  { emoji: '😀', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '😎', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🤓', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '😇', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🥳', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🤠', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🤡', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '👻', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🤖', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '👽', requirement: { type: REQUIREMENT_TYPES.NONE } },

  // Животные (базовые)
  { emoji: '🐶', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐱', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐼', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦊', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐯', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦁', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐸', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐵', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐨', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐷', requirement: { type: REQUIREMENT_TYPES.NONE } },

  // Требуют 10 уровень
  { emoji: '🦄', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 10 } },
  { emoji: '🐉', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 10 } },
  { emoji: '🦖', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 10 } },
  { emoji: '🦕', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 10 } },
  { emoji: '🐲', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 10 } },

  // Требуют 20 уровень
  { emoji: '👑', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 20 } },
  { emoji: '💎', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 20 } },
  { emoji: '💍', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 20 } },
  { emoji: '🔥', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 20 } },
  { emoji: '⚡', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 20 } },

  // Требуют 30 уровень
  { emoji: '⭐', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 30 } },
  { emoji: '🌟', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 30 } },
  { emoji: '✨', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 30 } },
  { emoji: '💫', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 30 } },
  { emoji: '🌈', requirement: { type: REQUIREMENT_TYPES.LEVEL, value: 30 } },

  // Требуют 50 побед
  { emoji: '🏆', requirement: { type: REQUIREMENT_TYPES.WINS, value: 50 } },
  { emoji: '🥇', requirement: { type: REQUIREMENT_TYPES.WINS, value: 50 } },
  { emoji: '🥈', requirement: { type: REQUIREMENT_TYPES.WINS, value: 50 } },
  { emoji: '🥉', requirement: { type: REQUIREMENT_TYPES.WINS, value: 50 } },
  { emoji: '🎖️', requirement: { type: REQUIREMENT_TYPES.WINS, value: 50 } },

  // Требуют 100 побед
  { emoji: '🎯', requirement: { type: REQUIREMENT_TYPES.WINS, value: 100 } },
  { emoji: '🎪', requirement: { type: REQUIREMENT_TYPES.WINS, value: 100 } },
  { emoji: '🎭', requirement: { type: REQUIREMENT_TYPES.WINS, value: 100 } },
  { emoji: '🎨', requirement: { type: REQUIREMENT_TYPES.WINS, value: 100 } },

  // Требуют 500 игр
  { emoji: '🚀', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 500 } },
  { emoji: '🛸', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 500 } },
  { emoji: '🛰️', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 500 } },
  { emoji: '🪐', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 500 } },
  { emoji: '💥', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 500 } },

  // Требуют 1000 игр
  { emoji: '🌍', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 1000 } },
  { emoji: '🌎', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 1000 } },
  { emoji: '🌏', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 1000 } },
  { emoji: '🌙', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 1000 } },
  { emoji: '☀️', requirement: { type: REQUIREMENT_TYPES.TOTAL_GAMES, value: 1000 } },

  // Остальные животные и объекты (базовые)
  { emoji: '🐮', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐔', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐧', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦅', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦉', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦇', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐺', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐗', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐴', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦓', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦒', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦘', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦙', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦥', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦦', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦨', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦡', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐘', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦏', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐢', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐊', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐍', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦎', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐙', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦑', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦞', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦀', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐡', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐠', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐟', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐬', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐳', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦈', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦭', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🐋', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🦛', requirement: { type: REQUIREMENT_TYPES.NONE } },

  // Спорт и игры (базовые)
  { emoji: '⚽', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🏀', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🏈', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '⚾', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎾', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🏐', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🏉', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎱', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🏓', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🏸', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🥊', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🥋', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎮', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎲', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎰', requirement: { type: REQUIREMENT_TYPES.NONE } },

  // Музыка (базовые)
  { emoji: '🎸', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎹', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎺', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎻', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🥁', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎤', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎧', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎼', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎵', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎶', requirement: { type: REQUIREMENT_TYPES.NONE } },

  // Еда (базовые)
  { emoji: '🍕', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🍔', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🍟', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🌭', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🍿', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🧁', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🍰', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🎂', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🍩', requirement: { type: REQUIREMENT_TYPES.NONE } },
  { emoji: '🍪', requirement: { type: REQUIREMENT_TYPES.NONE } },
];

// Проверка, разблокирована ли аватарка
export const isAvatarUnlocked = (avatarConfig, userStats, userLevel) => {
  const { requirement } = avatarConfig;

  switch (requirement.type) {
    case REQUIREMENT_TYPES.NONE:
      return true;

    case REQUIREMENT_TYPES.LEVEL:
      return userLevel >= requirement.value;

    case REQUIREMENT_TYPES.TOTAL_GAMES:
      return (userStats?.totalGames || 0) >= requirement.value;

    case REQUIREMENT_TYPES.WINS:
      return (userStats?.wins || 0) >= requirement.value;

    default:
      return false;
  }
};

// Получить текст требования для аватарки
export const getRequirementText = (requirement) => {
  switch (requirement.type) {
    case REQUIREMENT_TYPES.NONE:
      return null;

    case REQUIREMENT_TYPES.LEVEL:
      return `Требуется ${requirement.value} уровень`;

    case REQUIREMENT_TYPES.TOTAL_GAMES:
      return `Требуется ${requirement.value} игр`;

    case REQUIREMENT_TYPES.WINS:
      return `Требуется ${requirement.value} побед`;

    default:
      return 'Заблокировано';
  }
};
