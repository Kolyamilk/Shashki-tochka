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
  const [lastManualRefreshTimestamp, setLastManualRefreshTimestamp] = useState(null); // число (ms)
  const [loading, setLoading] = useState(true);
  const [newlyCompletedTask, setNewlyCompletedTask] = useState(null);
  const [pendingReward, setPendingReward] = useState(null);
  const [userLevel, setUserLevel] = useState(1);
  const [nextRefreshTime, setNextRefreshTime] = useState(null);
  const [canRefresh, setCanRefresh] = useState(false);

  // Вспомогательная: конвертация старого строкового формата в timestamp
  const convertLegacyRefreshDate = (dateStr) => {
    if (!dateStr) return null;
    // Ожидаемый формат: "2025-04-26 14:35:22"
    const parts = dateStr.split(' ');
    if (parts.length !== 2) return null;
    const [datePart, timePart] = parts;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const legacyDate = new Date(year, month - 1, day, hours, minutes, seconds);
    return legacyDate.getTime();
  };

  // Проверка, можно ли обновить задания вручную
  const canManualRefresh = useCallback(() => {
    if (userLevel < 10) return false;
    if (!lastManualRefreshTimestamp) return true; // никогда не обновлял
    const now = Date.now();
    const hoursPassed = (now - lastManualRefreshTimestamp) / (1000 * 60 * 60);
    return hoursPassed >= 24;
  }, [userLevel, lastManualRefreshTimestamp]);

  // Оставшееся время до следующего ручного обновления (в миллисекундах)
  const getTimeUntilNextRefresh = useCallback(() => {
    if (userLevel < 10) return null;        // недоступно
    if (!lastManualRefreshTimestamp) return null; // никогда не обновлял, можно сейчас
    if (canManualRefresh()) return null;     // уже можно обновить
    const nextAvailable = lastManualRefreshTimestamp + 24 * 60 * 60 * 1000;
    const remaining = nextAvailable - Date.now();
    return remaining > 0 ? remaining : 0;
  }, [userLevel, lastManualRefreshTimestamp, canManualRefresh]);

  // Принудительное обновление заданий (по кнопке)
  const refreshDailyTasks = useCallback(async () => {
    if (!userId) return;
    if (userLevel < 10) {

      return;
    }
    if (!canManualRefresh()) {

      return;
    }


    const today = getTodayDate();
    const nowTimestamp = Date.now();

    // Генерируем новые задания (используем timestamp как seed для разнообразия)
    let newTasks = generateDailyTasks(today, nowTimestamp, userId);

    // Избегаем полного повторения ID (если вдруг совпали с текущими)
    if (tasks.length > 0) {
      const oldIds = tasks.map(task => task.id).join(',');
      let attempt = 0;
      while (newTasks.map(task => task.id).join(',') === oldIds && attempt < 5) {
        newTasks = generateDailyTasks(today, nowTimestamp + attempt);
        attempt += 1;
      }
    }

    try {
      await update(ref(db, `users/${userId}`), {
        dailyTasks: {
          tasks: newTasks,
          lastUpdateDate: today,
          lastManualRefreshTimestamp: nowTimestamp,
          version: DAILY_TASKS_VERSION,
        },
      });
      setTasks(newTasks);
      setLastUpdateDate(today);
      setLastManualRefreshTimestamp(nowTimestamp);
    } catch (error) {
    }
  }, [userId, tasks, userLevel, canManualRefresh]);

  // Обновление заданий с помощью жетона
  const refreshWithToken = useCallback(async () => {
    if (!userId) return false;

    try {
      const userRef = ref(db, `users/${userId}`);
      const userSnap = await get(userRef);
      const userData = userSnap.val() || {};
      const currentTokens = userData.taskRefreshTokens || 0;

      if (currentTokens <= 0) {
        return false;
      }

      const today = getTodayDate();
      const nowTimestamp = Date.now();

      // Генерируем новые задания
      let newTasks = generateDailyTasks(today, nowTimestamp, userId);

      // Избегаем полного повторения ID
      if (tasks.length > 0) {
        const oldIds = tasks.map(task => task.id).join(',');
        let attempt = 0;
        while (newTasks.map(task => task.id).join(',') === oldIds && attempt < 5) {
          newTasks = generateDailyTasks(today, nowTimestamp + attempt);
          attempt += 1;
        }
      }

      await update(userRef, {
        taskRefreshTokens: currentTokens - 1,
        dailyTasks: {
          tasks: newTasks,
          lastUpdateDate: today,
          lastManualRefreshTimestamp: userData.dailyTasks?.lastManualRefreshTimestamp || null,
          version: DAILY_TASKS_VERSION,
        },
      });

      setTasks(newTasks);
      setLastUpdateDate(today);
      return true;
    } catch (error) {
      console.error('Ошибка обновления заданий с помощью жетона:', error);
      return false;
    }
  }, [userId, tasks]);

  // Загрузка заданий из Firebase (при старте и смене userId)
  useEffect(() => {
    if (!userId) {

      setLoading(false);
      setUserLevel(1);
      return;
    }


    const loadTasks = async () => {
      try {
        const tasksRef = ref(db, `users/${userId}/dailyTasks`);
        const snapshot = await get(tasksRef);
        const data = snapshot.val();

        const today = getTodayDate();

        // Преобразуем legacy поле lastManualRefreshDate в timestamp, если нужно
        let refreshTimestamp = null;
        if (data?.lastManualRefreshTimestamp) {
          refreshTimestamp = data.lastManualRefreshTimestamp;
        } else if (data?.lastManualRefreshDate) {
          refreshTimestamp = convertLegacyRefreshDate(data.lastManualRefreshDate);
        }

        // Если нет данных или сменился день (или версия устарела)
        if (!data || shouldUpdateTasks(data.lastUpdateDate) || data.version !== DAILY_TASKS_VERSION) {
          const newTasks = generateDailyTasks(today, null, userId);
          await update(ref(db, `users/${userId}`), {
            dailyTasks: {
              tasks: newTasks,
              lastUpdateDate: today,
              lastManualRefreshTimestamp: refreshTimestamp,
              version: DAILY_TASKS_VERSION,
            },
          });
          setTasks(newTasks);
          setLastUpdateDate(today);
          setLastManualRefreshTimestamp(refreshTimestamp);
        } else {
          // Загружаем существующие задания
          setTasks(data.tasks || []);
          setLastUpdateDate(data.lastUpdateDate);
          setLastManualRefreshTimestamp(refreshTimestamp);
        }

        // Получаем уровень пользователя
        const statsRef = ref(db, `users/${userId}/stats`);
        const statsSnap = await get(statsRef);
        const stats = statsSnap.val() || { exp: 0 };
        const levelInfo = getLevelFromExp(stats.exp || 0);
        setUserLevel(levelInfo.level);
      } catch (error) {
        console.error('Ошибка загрузки ежедневных заданий:', error);
      } finally {
        setLoading(false);
        
      }
    };

    loadTasks();
  }, [userId]);

  // Периодическое обновление уровня пользователя и статуса canRefresh
  useEffect(() => {
    if (!userId) return;

    const updateUserLevel = async () => {
      try {
        const statsRef = ref(db, `users/${userId}/stats`);
        const statsSnap = await get(statsRef);
        const stats = statsSnap.val() || { exp: 0 };
        const levelInfo = getLevelFromExp(stats.exp || 0);
        setUserLevel(levelInfo.level);
      } catch (error) {
        console.error('Ошибка обновления уровня:', error);
      }
    };

    const updateRefreshStatus = async () => {
      try {
        const tasksRef = ref(db, `users/${userId}/dailyTasks`);
        const snapshot = await get(tasksRef);
        const data = snapshot.val();

        // Обновляем lastManualRefreshTimestamp из Firebase
        let refreshTimestamp = null;
        if (data?.lastManualRefreshTimestamp) {
          refreshTimestamp = data.lastManualRefreshTimestamp;
        } else if (data?.lastManualRefreshDate) {
          refreshTimestamp = convertLegacyRefreshDate(data.lastManualRefreshDate);
        }

        setLastManualRefreshTimestamp(refreshTimestamp);
        setCanRefresh(canManualRefresh());
      } catch (error) {
        console.error('Ошибка обновления статуса обновления:', error);
      }
    };

    // Обновляем уровень и статус каждые 5 секунд
    updateUserLevel();
    updateRefreshStatus();
    const interval = setInterval(() => {
      updateUserLevel();
      updateRefreshStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [userId, canManualRefresh]);

  // Обработка награды за выполненное задание
  useEffect(() => {
    if (!pendingReward || !userId) return;

    const { task } = pendingReward;
    setNewlyCompletedTask(task);

    (async () => {
      try {
        const userStatsRef = ref(db, `users/${userId}/stats`);
        const statsSnap = await get(userStatsRef);
        const stats = statsSnap.val() || { exp: 0 };
        const newExp = (stats.exp || 0) + TASK_REWARD;

        await update(userStatsRef, { exp: newExp });
        const levelInfo = getLevelFromExp(newExp);
        setUserLevel(levelInfo.level);

        // Проверяем, все ли задания выполнены
        const allCompleted = tasks.every(t => t.completed);
        if (allCompleted) {
          // Даем жетон обновления заданий
          const userRef = ref(db, `users/${userId}`);
          const userSnap = await get(userRef);
          const userData = userSnap.val() || {};
          const currentTokens = userData.taskRefreshTokens || 0;

          await update(userRef, {
            taskRefreshTokens: currentTokens + 1,
          });
        }
      } catch (error) {
        console.error('Ошибка начисления награды за задание:', error);
      }
    })();

    setPendingReward(null);
  }, [pendingReward, userId, tasks]);

  // Обновление прогресса задания (без изменений)
  const updateProgress = async (taskType, increment = 1, gameType = null) => {
    if (!userId) {
      return;
    }


    let updatedTasksForDb = null;
    let newlyCompleted = null;

    setTasks(prevTasks => {
      if (prevTasks.length === 0) {
        return prevTasks;
      }


      const updatedTasks = updateTaskProgress(prevTasks, taskType, increment, gameType);


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
      } catch (error) {
        console.error('Ошибка сохранения прогресса заданий:', error);
      }
    }
  };

  const clearCompletedTask = () => {
    setNewlyCompletedTask(null);
  };

  const getCompletedCount = () => {
    return tasks.filter(task => task.completed).length;
  };

  const value = {
    tasks,
    loading,
    updateProgress,
    refreshDailyTasks,
    refreshWithToken,
    newlyCompletedTask,
    clearCompletedTask,
    getCompletedCount,
    TASK_TYPES,
    userLevel,
    canRefreshTasks: canRefresh,
    getTimeUntilNextRefresh,
    nextRefreshTime,
  };

  return (
    <DailyTasksContext.Provider value={value}>
      {children}
    </DailyTasksContext.Provider>
  );
};