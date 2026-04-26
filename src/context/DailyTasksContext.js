// src/context/DailyTasksContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { getLevelFromExp } from '../utils/levelSystem';
import {
  generateDailyTasks,
  getTodayDate,
  shouldUpdateTasks,
  updateTaskProgress,
  TASK_REWARD,
  TASK_TYPES,
  DAILY_TASKS_VERSION,
} from '../utils/dailyTasks';

const DailyTasksContext = createContext();

export const useDailyTasks = () => {
  const context = useContext(DailyTasksContext);
  if (!context) {
    throw new Error('useDailyTasks must be used within DailyTasksProvider');
  }
  return context;
};

export const DailyTasksProvider = ({ children }) => {
  const { userId } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [lastUpdateDate, setLastUpdateDate] = useState(null);
  const [lastManualRefreshDate, setLastManualRefreshDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newlyCompletedTask, setNewlyCompletedTask] = useState(null);
  const [pendingReward, setPendingReward] = useState(null);
  const [userLevel, setUserLevel] = useState(1);
  const [nextRefreshTime, setNextRefreshTime] = useState(null);

  // Получить количество миллисекунд до следующего полуночи
  const getMillisecondsToMidnight = () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return tomorrow - now;
  };

  // Проверить, доступно ли обновление
  const canManualRefresh = useCallback(() => {
    if (userLevel < 10) return false;
    if (!lastManualRefreshDate) return true; // Первый раз
    
    const lastRefreshDate = lastManualRefreshDate.split(' ')[0]; // Получить дату из сохраненной строки
    const today = getTodayDate();
    return lastRefreshDate !== today;
  }, [userLevel, lastManualRefreshDate]);

  // Рассчитать время до следующего обновления
  const getTimeUntilNextRefresh = useCallback(() => {
    if (canManualRefresh()) {
      return null; // Обновление доступно
    }
    return getMillisecondsToMidnight();
  }, [canManualRefresh]);

  const refreshDailyTasks = useCallback(async () => {
    if (!userId) return;
    if (userLevel < 10) {
      console.log('⚠️ Refresh blocked: user level too low', { userLevel });
      return;
    }
    if (!canManualRefresh()) {
      console.log('⚠️ Refresh blocked: already refreshed today');
      return;
    }
    
    console.log('🔄 Принудительное обновление ежедневных заданий');
    const today = getTodayDate();
    const now = new Date();
    const timestamp = `${today} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    let newTasks = generateDailyTasks(today, Date.now());

    if (tasks.length > 0) {
      const oldIds = tasks.map(task => task.id).join(',');
      let attempt = 0;
      while (newTasks.map(task => task.id).join(',') === oldIds && attempt < 5) {
        newTasks = generateDailyTasks(today, Date.now() + attempt);
        attempt += 1;
      }
    }

    try {
      await update(ref(db, `users/${userId}`), {
        dailyTasks: {
          tasks: newTasks,
          lastUpdateDate: today,
          lastManualRefreshDate: timestamp,
          version: DAILY_TASKS_VERSION,
        },
      });
      setTasks(newTasks);
      setLastUpdateDate(today);
      setLastManualRefreshDate(timestamp);
      setNextRefreshTime(getMillisecondsToMidnight());
      console.log('✅ Ручное обновление заданий выполнено');
    } catch (error) {
      console.error('Ошибка принудительного обновления заданий:', error);
    }
  }, [userId, tasks, userLevel, canManualRefresh]);

  // Загрузка заданий из Firebase
  useEffect(() => {
    if (!userId) {
      console.log('⚠️ DailyTasksContext: нет userId, пропуск загрузки');
      setLoading(false);
      setUserLevel(1);
      return;
    }

    console.log('📋 DailyTasksContext: начало загрузки заданий для userId:', userId);

    const loadTasks = async () => {
      try {
        const tasksRef = ref(db, `users/${userId}/dailyTasks`);
        const snapshot = await get(tasksRef);
        const data = snapshot.val();

        const today = getTodayDate();
        console.log('📅 Сегодняшняя дата:', today);

        if (!data || shouldUpdateTasks(data.lastUpdateDate) || data.version !== DAILY_TASKS_VERSION) {
          // Генерируем новые задания
          console.log('🆕 Генерация новых заданий');
          const newTasks = generateDailyTasks(today);
          console.log('📋 Новые задания:', newTasks);

          await update(ref(db, `users/${userId}`), {
            dailyTasks: {
              tasks: newTasks,
              lastUpdateDate: today,
              lastManualRefreshDate: data?.lastManualRefreshDate || null,
              version: DAILY_TASKS_VERSION,
            },
          });
          setTasks(newTasks);
          setLastUpdateDate(today);
          setLastManualRefreshDate(data?.lastManualRefreshDate || null);
        } else {
          // Загружаем существующие задания
          console.log('📋 Загружены существующие задания:', data.tasks);
          setTasks(data.tasks || []);
          setLastUpdateDate(data.lastUpdateDate);
          setLastManualRefreshDate(data.lastManualRefreshDate || null);
        }

        const statsRef = ref(db, `users/${userId}/stats`);
        const statsSnap = await get(statsRef);
        const stats = statsSnap.val() || { exp: 0 };
        const levelInfo = getLevelFromExp(stats.exp || 0);
        setUserLevel(levelInfo.level);
      } catch (error) {
        console.error('Ошибка загрузки ежедневных заданий:', error);
      } finally {
        setLoading(false);
        console.log('✅ DailyTasksContext: загрузка завершена');
      }
    };

    loadTasks();
  }, [userId]);

  // Обработка награды за выполненное задание
  useEffect(() => {
    if (!pendingReward || !userId) return;

    const { task } = pendingReward;
    console.log('🎉 Задание выполнено:', task);
    setNewlyCompletedTask(task);

    // Начисляем награду
    (async () => {
      try {
        const userStatsRef = ref(db, `users/${userId}/stats`);
        const statsSnap = await get(userStatsRef);
        const stats = statsSnap.val() || { exp: 0 };
        const newExp = (stats.exp || 0) + TASK_REWARD;

        await update(userStatsRef, {
          exp: newExp,
        });
        const levelInfo = getLevelFromExp(newExp);
        setUserLevel(levelInfo.level);
        console.log('✨ Награда за задание начислена:', TASK_REWARD);
      } catch (error) {
        console.error('Ошибка начисления награды за задание:', error);
      }
    })();

    setPendingReward(null);
  }, [pendingReward, userId]);

  // Обновление прогресса задания
  const updateProgress = async (taskType, increment = 1, gameType = null) => {
    if (!userId) {
      console.log('⚠️ updateProgress: пропуск (нет userId)', { userId });
      return;
    }

    console.log('📋 updateProgress вызван:', { taskType, increment, gameType });

    let updatedTasksForDb = null;
    let newlyCompleted = null;

    setTasks(prevTasks => {
      if (prevTasks.length === 0) {
        console.log('⚠️ updateProgress: нет заданий');
        return prevTasks;
      }

      console.log('📋 Текущие задания:', prevTasks);

      const updatedTasks = updateTaskProgress(prevTasks, taskType, increment, gameType);

      console.log('📋 Задания после обновления:', updatedTasks);

      newlyCompleted = updatedTasks.find((task, index) =>
        task.completed && !prevTasks[index].completed
      );

      updatedTasksForDb = updatedTasks;
      return updatedTasks;
    });

    if (newlyCompleted) {
      setPendingReward({ task: newlyCompleted });
    }

    if (updatedTasksForDb) {
      try {
        await update(ref(db, `users/${userId}/dailyTasks`), {
          tasks: updatedTasksForDb,
        });
        console.log('💾 Прогресс заданий сохранён в Firebase');
      } catch (error) {
        console.error('Ошибка сохранения прогресса заданий:', error);
      }
    }
  };

  // Очистить уведомление о выполненном задании
  const clearCompletedTask = () => {
    setNewlyCompletedTask(null);
  };

  // Получить количество выполненных заданий
  const getCompletedCount = () => {
    return tasks.filter(task => task.completed).length;
  };

  const value = {
    tasks,
    loading,
    updateProgress,
    refreshDailyTasks,
    newlyCompletedTask,
    clearCompletedTask,
    getCompletedCount,
    TASK_TYPES,
    userLevel,
    canRefreshTasks: canManualRefresh(),
    getTimeUntilNextRefresh,
    nextRefreshTime,
  };

  return (
    <DailyTasksContext.Provider value={value}>
      {children}
    </DailyTasksContext.Provider>
  );
};
