// src/utils/dailyTasks.js

// Все возможные типы заданий
export const TASK_TYPES = {
  WIN_GAMES: 'win_games',
  PLAY_GAMES: 'play_games',
  WIN_ONLINE: 'win_online',
  PLAY_ONLINE: 'play_online',
  WIN_BOT: 'win_bot',
  LOSE_BOT: 'lose_bot',
  WIN_BOT_HARD: 'win_bot_hard',
  CAPTURE_PIECES: 'capture_pieces',
  WIN_GIVEAWAY: 'win_giveaway',
  PLAY_GIVEAWAY: 'play_giveaway',
  WIN_STREAK: 'win_streak',
  PLAY_WITH_FRIEND: 'play_with_friend',
};

// Шаблоны заданий
const TASK_TEMPLATES = [
  {
    id: 'win_1_game',
    type: TASK_TYPES.WIN_GAMES,
    title: 'Победитель дня',
    description: 'Выиграйте 1 игру',
    target: 1,
    icon: '🏆',
  },
  {
    id: 'win_2_games',
    type: TASK_TYPES.WIN_GAMES,
    title: 'Двойная победа',
    description: 'Выиграйте 2 игры',
    target: 2,
    icon: '🏆',
  },
  {
    id: 'win_3_games',
    type: TASK_TYPES.WIN_GAMES,
    title: 'Тройная победа',
    description: 'Выиграйте 3 игры',
    target: 3,
    icon: '🏆',
  },
  {
    id: 'play_3_games',
    type: TASK_TYPES.PLAY_GAMES,
    title: 'Активный игрок',
    description: 'Сыграйте 3 игры',
    target: 3,
    icon: '🎮',
  },
  {
    id: 'play_5_games',
    type: TASK_TYPES.PLAY_GAMES,
    title: 'Марафон',
    description: 'Сыграйте 5 игр',
    target: 5,
    icon: '🎮',
  },
  {
    id: 'win_online_1',
    type: TASK_TYPES.WIN_ONLINE,
    title: 'Онлайн чемпион',
    description: 'Выиграйте 1 онлайн игру',
    target: 1,
    icon: '🌐',
  },
  {
    id: 'play_online_2',
    type: TASK_TYPES.PLAY_ONLINE,
    title: 'Онлайн марафон',
    description: 'Сыграйте 2 онлайн игры',
    target: 2,
    icon: '🌐',
  },
  {
    id: 'win_online_2',
    type: TASK_TYPES.WIN_ONLINE,
    title: 'Онлайн доминация',
    description: 'Выиграйте 2 онлайн игры',
    target: 2,
    icon: '🌐',
  },
  {
    id: 'win_bot_easy',
    type: TASK_TYPES.WIN_BOT,
    title: 'Победитель ботов',
    description: 'Выиграйте у бота',
    target: 1,
    icon: '🤖',
  },
  {
    id: 'lose_bot_once',
    type: TASK_TYPES.LOSE_BOT,
    title: 'Урок от машины',
    description: 'Проиграйте 1 раз против бота',
    target: 1,
    icon: '💔',
  },
  {
    id: 'capture_10_pieces',
    type: TASK_TYPES.CAPTURE_PIECES,
    title: 'Охотник',
    description: 'Съешьте 10 шашек',
    target: 10,
    icon: '🍽️',
  },
  {
    id: 'capture_15_pieces',
    type: TASK_TYPES.CAPTURE_PIECES,
    title: 'Массивный урон',
    description: 'Съешьте 15 шашек',
    target: 15,
    icon: '🍽️',
  },
  {
    id: 'win_giveaway',
    type: TASK_TYPES.WIN_GIVEAWAY,
    title: 'Мастер поддавков',
    description: 'Выиграйте в режиме поддавков',
    target: 1,
    icon: '🎯',
  },
  {
    id: 'play_giveaway_2',
    type: TASK_TYPES.PLAY_GIVEAWAY,
    title: 'Любитель поддавков',
    description: 'Сыграйте 2 игры в поддавки',
    target: 2,
    icon: '🎯',
  },
  {
    id: 'play_with_friend',
    type: TASK_TYPES.PLAY_WITH_FRIEND,
    title: 'Дружеская встреча',
    description: 'Сыграйте с другом онлайн',
    target: 1,
    icon: '👥',
  },
  {
    id: 'play_5_games_big',
    type: TASK_TYPES.PLAY_GAMES,
    title: 'Большой марафон',
    description: 'Сыграйте 5 игр',
    target: 5,
    icon: '🏃‍♂️',
  },
  {
    id: 'win_online_3',
    type: TASK_TYPES.WIN_ONLINE,
    title: 'Онлайн мастер',
    description: 'Выиграйте 3 онлайн игры',
    target: 3,
    icon: '🌟',
  },
  {
    id: 'capture_20_pieces',
    type: TASK_TYPES.CAPTURE_PIECES,
    title: 'Серийный охотник',
    description: 'Съешьте 20 шашек',
    target: 20,
    icon: '🐺',
  },
  {
    id: 'win_streak_3',
    type: TASK_TYPES.WIN_STREAK,
    title: 'Тройная серия',
    description: 'Выиграйте 3 игры подряд',
    target: 3,
    icon: '🔥',
  },
  {
    id: 'win_bot_hard',
    type: TASK_TYPES.WIN_BOT_HARD,
    title: 'Грозный соперник',
    description: 'Выиграйте у бота высокой сложности',
    target: 1,
    icon: '💪',
  },
  {
    id: 'win_streak_2',
    type: TASK_TYPES.WIN_STREAK,
    title: 'Победная серия',
    description: 'Выиграйте 2 игры подряд',
    target: 2,
    icon: '🔥',
  },
];

const getSeedHash = (input) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const createSeededRandom = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWithSeed = (items, seed) => {
  const result = [...items];
  const random = createSeededRandom(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Номер версии генератора ежедневных заданий.
// Увеличивайте, когда шаблоны или логика выбора меняются.
export const DAILY_TASKS_VERSION = 3;

// Награда за выполнение задания
export const TASK_REWARD = 100;

// Получить дату в формате YYYY-MM-DD
export const getTodayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Генерация 3 случайных заданий на день
export const generateDailyTasks = (date = getTodayDate(), seedOverride = null) => {
  const seedInput = seedOverride !== null ? `${date}:${seedOverride}` : date;
  const seed = getSeedHash(seedInput);
  const shuffled = shuffleWithSeed(TASK_TEMPLATES, seed);

  return shuffled.slice(0, 3).map((task, index) => ({
    ...task,
    progress: 0,
    completed: false,
    index,
  }));
};

// Проверка, нужно ли обновить задания
export const shouldUpdateTasks = (lastUpdateDate) => {
  return lastUpdateDate !== getTodayDate();
};

// Обновление прогресса задания
export const updateTaskProgress = (tasks, taskType, increment = 1, gameType = null) => {
  console.log('🔄 updateTaskProgress:', { taskType, increment, gameType, tasksCount: tasks.length });

  return tasks.map((task, index) => {
    if (task.completed) {
      console.log(`  Задание ${index} (${task.type}): уже выполнено, пропуск`);
      return task;
    }

    let shouldUpdate = false;

    // Проверяем соответствие типа задания
    if (task.type === taskType) {
      // Для заданий с режимом игры проверяем gameType
      if (taskType === TASK_TYPES.WIN_GIVEAWAY || taskType === TASK_TYPES.PLAY_GIVEAWAY) {
        shouldUpdate = gameType === 'giveaway';
        console.log(`  Задание ${index} (${task.type}): проверка gameType - ${gameType} === 'giveaway' = ${shouldUpdate}`);
      } else {
        shouldUpdate = true;
        console.log(`  Задание ${index} (${task.type}): совпадение типа, обновляем`);
      }
    } else {
      console.log(`  Задание ${index} (${task.type}): тип не совпадает с ${taskType}`);
    }

    if (shouldUpdate) {
      const newProgress = Math.min(task.progress + increment, task.target);
      console.log(`  ✅ Обновление: ${task.progress} + ${increment} = ${newProgress} / ${task.target}`);
      return {
        ...task,
        progress: newProgress,
        completed: newProgress >= task.target,
      };
    }

    return task;
  });
};

// Получить список выполненных заданий
export const getCompletedTasks = (tasks) => {
  return tasks.filter(task => task.completed);
};

// Проверить, все ли задания выполнены
export const areAllTasksCompleted = (tasks) => {
  return tasks.every(task => task.completed);
};
