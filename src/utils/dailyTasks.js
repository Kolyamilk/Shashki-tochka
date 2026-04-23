// src/utils/dailyTasks.js

// Все возможные типы заданий
export const TASK_TYPES = {
  WIN_GAMES: 'win_games',
  PLAY_GAMES: 'play_games',
  WIN_ONLINE: 'win_online',
  WIN_BOT: 'win_bot',
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
    id: 'play_3_games',
    type: TASK_TYPES.PLAY_GAMES,
    title: 'Активный игрок',
    description: 'Сыграйте 3 игры',
    target: 3,
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
    id: 'win_bot_easy',
    type: TASK_TYPES.WIN_BOT,
    title: 'Победитель ботов',
    description: 'Выиграйте у бота',
    target: 1,
    icon: '🤖',
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
];

// Награда за выполнение задания
export const TASK_REWARD = 100;

// Получить дату в формате YYYY-MM-DD
export const getTodayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Генерация 3 случайных заданий на день
export const generateDailyTasks = (date = getTodayDate()) => {
  // Используем дату как seed для генерации одинаковых заданий в течение дня
  const seed = date.split('-').reduce((acc, val) => acc + parseInt(val), 0);

  // Перемешиваем задания на основе seed
  const shuffled = [...TASK_TEMPLATES].sort((a, b) => {
    const hashA = (seed + a.id.charCodeAt(0)) % 100;
    const hashB = (seed + b.id.charCodeAt(0)) % 100;
    return hashA - hashB;
  });

  // Берём первые 3 задания
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
