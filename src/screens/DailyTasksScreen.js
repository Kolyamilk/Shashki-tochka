// src/screens/DailyTasksScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors } from '../styles/globalStyles';
import { useDailyTasks } from '../context/DailyTasksContext';
import { TASK_REWARD } from '../utils/dailyTasks';

const DailyTasksScreen = ({ navigation }) => {
  const { tasks, loading, getCompletedCount } = useDailyTasks();

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>📋 Ежедневные задания</Text>
        <Text style={styles.subtitle}>
          Выполнено: {completedCount} / {tasks.length}
        </Text>
        <Text style={styles.rewardInfo}>
          💰 Награда за задание: +{TASK_REWARD} опыта
        </Text>

        <View style={styles.tasksContainer}>
          {tasks.map((task, index) => (
            <View
              key={task.id}
              style={[
                styles.taskCard,
                task.completed && styles.taskCardCompleted,
              ]}
            >
              <View style={styles.taskHeader}>
                <Text style={styles.taskIcon}>{task.icon}</Text>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDescription}>{task.description}</Text>
                </View>
                {task.completed && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min((task.progress / task.target) * 100, 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {task.progress} / {task.target}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.resetInfo}>
          🕐 Задания обновляются каждый день в 00:00
        </Text>
      </ScrollView>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Назад</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    color: colors.textLight,
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
    marginTop: 20,
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
});

export default DailyTasksScreen;
