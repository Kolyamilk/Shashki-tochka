// src/screens/DailyTasksScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { colors } from '../styles/globalStyles';
import { useDailyTasks } from '../context/DailyTasksContext';
import { TASK_REWARD } from '../utils/dailyTasks';

const DailyTasksScreen = ({ navigation }) => {
  const { 
    tasks, 
    loading, 
    getCompletedCount, 
    refreshDailyTasks, 
    userLevel, 
    canRefreshTasks 
  } = useDailyTasks();

  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [showLevelLockedModal, setShowLevelLockedModal] = useState(false);
  const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
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
            {showRefreshModal ? 'Обновляем задачи' : 'Обновить задания'}
          </Text>
        </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#4ECDC4',
    textAlign: 'center',
    marginBottom: 5,
  },
  rewardInfo: {
    fontSize: 14,
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 20,
  },
  resetInfo: {
    fontSize: 13,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  tasksContainer: {
    marginTop: 10,
  },
  taskCard: {
    backgroundColor: '#2c3e50',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
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
    marginBottom: 10,
  },
  taskIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 3,
  },
  taskDescription: {
    fontSize: 14,
    color: '#aaa',
  },
  checkmark: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 24,
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
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    marginBottom: 15,
  },
  refreshButtonText: {
    color: '#1a2a3a',
    fontSize: 14,
    fontWeight: '700',
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
  refreshStatusContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  refreshAvailableText: {
    color: '#4ECDC4',
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(78,205,196,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  refreshLockedText: {
    color: '#ff9999',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(255,107,107,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
});

export default DailyTasksScreen;