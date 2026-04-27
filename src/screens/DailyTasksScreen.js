// src/screens/DailyTasksScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { colors } from '../styles/globalStyles';
import { useDailyTasks } from '../context/DailyTasksContext';
import { TASK_REWARD } from '../utils/dailyTasks';
import { useAuth } from '../context/AuthContext';
import { ref, get } from 'firebase/database';
import { db } from '../firebase/config';

const DailyTasksScreen = ({ navigation }) => {
  const {
    tasks,
    loading,
    getCompletedCount,
    refreshDailyTasks,
    refreshWithToken,
    userLevel,
    canRefreshTasks
  } = useDailyTasks();
  const { userId } = useAuth();

  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [showLevelLockedModal, setShowLevelLockedModal] = useState(false);
  const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showTokenInfoModal, setShowTokenInfoModal] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [dotCount, setDotCount] = useState(0);

  // Анимация точек при обновлении
  React.useEffect(() => {
    if (!showRefreshModal) {
      setDotCount(0);
      return;
    }
    const interval = setInterval(() => {
      setDotCount((c) => (c + 1) % 4);
    }, 300);
    return () => clearInterval(interval);
  }, [showRefreshModal]);

  // Загрузка количества жетонов
  useEffect(() => {
    if (!userId) return;

    const loadTokens = async () => {
      try {
        const userRef = ref(db, `users/${userId}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val() || {};

        // Инициализация taskRefreshTokens если его нет (для существующих пользователей)
        if (userData.taskRefreshTokens === undefined) {
          await update(userRef, {
            taskRefreshTokens: 0,
          });
          setTokenCount(0);
        } else {
          setTokenCount(userData.taskRefreshTokens || 0);
        }

        const tokens = userData.taskRefreshTokens || 0;
        console.log('Загружено жетонов:', tokens, 'для userId:', userId);
        setTokenCount(tokens);
      } catch (error) {
        console.error('Ошибка загрузки жетонов:', error);
      }
    };

    loadTokens();
    const interval = setInterval(loadTokens, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleRefresh = async () => {
    if (showRefreshModal) return;
    if (userLevel < 10) {
      setShowLevelLockedModal(true);
      return;
    }
    if (!canRefreshTasks) {
      setShowAlreadyUsedModal(true);
      return;
    }
    setShowRefreshModal(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await refreshDailyTasks();
    setShowRefreshModal(false);
  };

  const handleTokenRefresh = async () => {
    if (showRefreshModal) return;
    setShowTokenModal(false); // Закрываем модалку с жетоном
    setShowRefreshModal(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const success = await refreshWithToken();
    setShowRefreshModal(false);
    if (success) {
      setTokenCount(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Загрузка заданий...</Text>
      </View>
    );
  }

  const completedCount = getCompletedCount();

  return (
    <View style={styles.container}>
      {/* Модалка: обновление в процессе */}
      <Modal visible={showRefreshModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>
              Обновляем задачи{'.'.repeat(dotCount)}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Модалка: уровень ниже 10 */}
      <Modal visible={showLevelLockedModal} transparent animationType="fade" onRequestClose={() => setShowLevelLockedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalText, { fontSize: 22, marginBottom: 15 }]}>🔒 Доступ ограничен</Text>
            <Text style={styles.modalText}>Функция «Обновить задания» станет доступна после достижения</Text>
            <Text style={[styles.modalText, { fontSize: 28, fontWeight: 'bold', color: '#FFD700', marginVertical: 10 }]}>10 уровня</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowLevelLockedModal(false)}>
              <Text style={styles.modalButtonText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка: уже использовано сегодня */}
      <Modal visible={showAlreadyUsedModal} transparent animationType="fade" onRequestClose={() => setShowAlreadyUsedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalText, { fontSize: 22, marginBottom: 15 }]}>⏳ Уже использовано</Text>
            <Text style={styles.modalText}>Вы уже обновляли задания сегодня.</Text>
            <Text style={[styles.modalText, { marginTop: 15, fontSize: 14, color: '#aaa' }]}>Новое ручное обновление станет доступно завтра после 00:00.</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowAlreadyUsedModal(false)}>
              <Text style={styles.modalButtonText}>Ок</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка: использование жетона */}
      <Modal visible={showTokenModal} transparent animationType="fade" onRequestClose={() => setShowTokenModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalText, { fontSize: 28, marginBottom: 10 }]}>🎫</Text>
            <Text style={[styles.modalText, { fontSize: 22, marginBottom: 15 }]}>Жетон обновления</Text>
            <Text style={styles.modalText}>У вас есть жетонов: {tokenCount}</Text>
            <Text style={[styles.modalText, { marginTop: 15, fontSize: 14, color: '#aaa' }]}>Использовать жетон для обновления заданий?</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={[styles.modalButton, { marginRight: 10 }]} onPress={handleTokenRefresh}>
                <Text style={styles.modalButtonText}>Использовать</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#ff6b6b' }]} onPress={() => setShowTokenModal(false)}>
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модалка: информация о жетонах */}
      <Modal visible={showTokenInfoModal} transparent animationType="fade" onRequestClose={() => setShowTokenInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalText, { fontSize: 28, marginBottom: 10 }]}>🎫</Text>
            <Text style={[styles.modalText, { fontSize: 22, marginBottom: 15 }]}>Как получить жетоны?</Text>
            <Text style={[styles.modalText, { fontSize: 15, marginBottom: 12, textAlign: 'left' }]}>
              Жетоны обновления позволяют обновить задания в любое время!
            </Text>
            <Text style={[styles.modalText, { fontSize: 14, color: '#4ECDC4', marginBottom: 8, textAlign: 'left' }]}>
              🎁 За каждый новый уровень
            </Text>
            <Text style={[styles.modalText, { fontSize: 14, color: '#4ECDC4', marginBottom: 8, textAlign: 'left' }]}>
              ✅ За выполнение всех 3 заданий
            </Text>
            <Text style={[styles.modalText, { fontSize: 14, color: '#4ECDC4', marginBottom: 15, textAlign: 'left' }]}>
              👥 Другие игроки могут подарить вам жетоны
            </Text>
            <Text style={[styles.modalText, { fontSize: 13, color: '#aaa', marginTop: 10 }]}>
              Жетоны хранятся в разделе "Мои подарки"
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowTokenInfoModal(false)}>
              <Text style={styles.modalButtonText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>📋 Ежедневные задания</Text>
        <Text style={styles.subtitle}>Выполнено: {completedCount} / {tasks.length}</Text>
        <Text style={styles.rewardInfo}>💰 Награда за задание: +{TASK_REWARD} опыта</Text>

        <View style={styles.tasksContainer}>
          {tasks.map((task) => (
            <View key={task.id} style={[styles.taskCard, task.completed && styles.taskCardCompleted]}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskIcon}>{task.icon}</Text>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDescription}>{task.description}</Text>
                </View>
                {task.completed && <View style={styles.checkmark}><Text style={styles.checkmarkText}>✓</Text></View>}
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min((task.progress / task.target) * 100, 100)}%` }]} />
                </View>
                <Text style={styles.progressText}>{task.progress} / {task.target}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.resetInfo}>🕐 Задания обновляются автоматически каждый день в 00:00 (МСК)</Text>

        <View style={styles.buttonsContainer}>
          {userLevel >= 10 && (
            <View style={styles.refreshStatusContainer}>
              {canRefreshTasks ? (
                <Text style={styles.refreshAvailableText}>✨ Можно обновить задания сегодня</Text>
              ) : (
                <Text style={styles.refreshLockedText}>🔁 Сегодня вы уже обновляли задания</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.refreshButton, (!canRefreshTasks || userLevel < 10) && styles.refreshButtonDisabled]}
            onPress={handleRefresh}
            disabled={showRefreshModal}
          >
            <Text style={styles.refreshButtonText}>
              {showRefreshModal ? 'Обновляем задачи' : 'Бесплатное обновление (1 раз в день)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tokenButton, tokenCount === 0 && styles.tokenButtonDisabled]}
            onPress={() => tokenCount > 0 ? setShowTokenModal(true) : setShowTokenInfoModal(true)}
            disabled={showRefreshModal}
          >
            <Text style={styles.tokenButtonText}>
              🎫 Обновить с помощью жетона ({tokenCount})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Назад</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingText: {
    color: colors.textLight,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4ECDC4',
    textAlign: 'center',
    marginBottom: 4,
  },
  rewardInfo: {
    fontSize: 13,
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 15,
  },
  resetInfo: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  tasksContainer: {
    marginTop: 10,
  },
  taskCard: {
    backgroundColor: '#2c3e50',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  taskCardCompleted: {
    borderColor: '#4ECDC4',
    backgroundColor: '#1e3a3a',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 2,
  },
  taskDescription: {
    fontSize: 13,
    color: '#aaa',
  },
  checkmark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 10,
    backgroundColor: '#1a2a3a',
    borderRadius: 5,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'right',
  },
  refreshButton: {
    alignSelf: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    width: '90%',
  },
  refreshButtonText: {
    color: '#1a2a3a',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.7,
  },
  refreshButtonDisabledLocked: {
    opacity: 0.5,
  },
  refreshAvailableContainer: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    borderWidth: 1,
    borderColor: '#4ECDC4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  refreshAvailableText: {
    color: '#4ECDC4',
    fontSize: 15,
    fontWeight: '600',
  },
  refreshLockedContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: '#ff6b6b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  refreshLockedText: {
    color: '#ff9999',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#213245',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4ECDC4',
    minWidth: '70%',
    alignItems: 'center',
  },
  modalText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 20,
  },
  modalButtonText: {
    color: '#1a2a3a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  tokenButton: {
    alignSelf: 'center',
    backgroundColor: '#9b59b6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 0,
    marginBottom: 10,
    width: '90%',
  },
  tokenButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  tokenButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#666',
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  refreshStatusContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  refreshAvailableText: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(78,205,196,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  refreshLockedText: {
    color: '#ff9999',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(255,107,107,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
});

export default DailyTasksScreen;