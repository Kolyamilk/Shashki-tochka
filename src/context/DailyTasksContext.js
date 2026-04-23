// src/context/DailyTasksContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import {
  generateDailyTasks,
  getTodayDate,
  shouldUpdateTasks,
  updateTaskProgress,
  TASK_REWARD,
  TASK_TYPES,
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
  const [loading, setLoading] = useState(true);
  const [newlyCompletedTask, setNewlyCompletedTask] = useState(null);
  const [pendingReward, setPendingReward] = useState(null);

  // Загрузка заданий из Firebase
  useEffect(() => {
    if (!userId) {
      console.log('⚠️ DailyTasksContext: нет userId, пропуск загрузки');
      setLoading(false);
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

        if (!data || shouldUpdateTasks(data.lastUpdateDate)) {
          // Генерируем новые задания
          console.log('🆕 Генерация новых заданий');
          const newTasks = generateDailyTasks(today);
          console.log('📋 Новые задания:', newTasks);

          await update(ref(db, `users/${userId}`), {
            dailyTasks: {
              tasks: newTasks,
              lastUpdateDate: today,
            },
          });
          setTasks(newTasks);
          setLastUpdateDate(today);
        } else {
          // Загружаем существующие задания
          console.log('📋 Загружены существующие задания:', data.tasks);
          setTasks(data.tasks || []);
          setLastUpdateDate(data.lastUpdateDate);
        }
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

        await update(userStatsRef, {
          exp: (stats.exp || 0) + TASK_REWARD,
        });
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

    // Используем функциональное обновление для получения актуального состояния
    setTasks(prevTasks => {
      if (prevTasks.length === 0) {
        console.log('⚠️ updateProgress: нет заданий');
        return prevTasks;
      }

      console.log('📋 Текущие задания:', prevTasks);

      const updatedTasks = updateTaskProgress(prevTasks, taskType, increment, gameType);

      console.log('📋 Задания после обновления:', updatedTasks);

      // Проверяем, какие задания были только что выполнены
      const newlyCompleted = updatedTasks.find((task, index) =>
        task.completed && !prevTasks[index].completed
      );

      if (newlyCompleted) {
        // Используем Promise для отложенного обновления состояния вне рендера
        Promise.resolve().then(() => {
          setPendingReward({ task: newlyCompleted });
        });
      }

      // Сохраняем в Firebase
      (async () => {
        try {
          await update(ref(db, `users/${userId}/dailyTasks`), {
            tasks: updatedTasks,
          });
          console.log('💾 Прогресс заданий сохранён в Firebase');
        } catch (error) {
          console.error('Ошибка сохранения прогресса заданий:', error);
        }
      })();

      return updatedTasks;
    });
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
    newlyCompletedTask,
    clearCompletedTask,
    getCompletedCount,
    TASK_TYPES,
  };

  return (
    <DailyTasksContext.Provider value={value}>
      {children}
    </DailyTasksContext.Provider>
  );
};
