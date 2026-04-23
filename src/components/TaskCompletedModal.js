// src/components/TaskCompletedModal.js
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors } from '../styles/globalStyles';
import { TASK_REWARD } from '../utils/dailyTasks';

const TaskCompletedModal = ({ visible, task, onClose }) => {
  if (!task) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.icon}>🎉</Text>
          <Text style={styles.title}>Задание выполнено!</Text>

          <View style={styles.taskInfo}>
            <Text style={styles.taskIcon}>{task.icon}</Text>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskDescription}>{task.description}</Text>
          </View>

          <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>Награда:</Text>
            <Text style={styles.rewardValue}>+{TASK_REWARD} опыта</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Отлично!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#2c3e50',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    width: '100%',
    maxWidth: 350,
    borderWidth: 3,
    borderColor: '#4ECDC4',
  },
  icon: {
    fontSize: 60,
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 20,
    textAlign: 'center',
  },
  taskInfo: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#1a2a3a',
    padding: 15,
    borderRadius: 15,
    width: '100%',
  },
  taskIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 5,
    textAlign: 'center',
  },
  taskDescription: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  rewardBox: {
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  rewardLabel: {
    fontSize: 14,
    color: '#1a2a3a',
    fontWeight: '600',
    marginBottom: 3,
  },
  rewardValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a2a3a',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default TaskCompletedModal;
