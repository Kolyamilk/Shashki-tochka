// src/screens/InviteModal.js
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { colors } from '../styles/globalStyles';
import { getLevelColor } from '../utils/levelSystem';

const InviteModal = ({ visible, onClose, onAccept, onDecline, fromName, fromAvatar, fromLevel, gameType }) => {
  const gameTypeName = gameType === 'giveaway' ? 'Поддавки' : 'Русские шашки';
  const gameTypeEmoji = gameType === 'giveaway' ? '🎯' : '♟️';
  const levelColor = getLevelColor(fromLevel || 1);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Аватар */}
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{fromAvatar || '😀'}</Text>
            <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
              <Text style={styles.levelText}>⭐ {fromLevel || 1}</Text>
            </View>
          </View>

          {/* Заголовок */}
          <Text style={styles.title}>🎮 Приглашение в игру</Text>

          {/* Имя игрока */}
          <Text style={styles.playerName}>{fromName || 'Игрок'}</Text>
          <Text style={styles.message}>приглашает вас сыграть!</Text>

          {/* Тип игры */}
          <View style={styles.gameTypeContainer}>
            <Text style={styles.gameTypeEmoji}>{gameTypeEmoji}</Text>
            <Text style={styles.gameTypeName}>{gameTypeName}</Text>
          </View>

          {/* Кнопки */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={onDecline}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>❌ Отказаться</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>✅ Сыграть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#2c3e50',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    fontSize: 80,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2c3e50',
  },
  levelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 12,
  },
  playerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    marginBottom: 20,
  },
  gameTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  gameTypeEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  gameTypeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  acceptButton: {
    backgroundColor: '#4ECDC4',
  },
  declineButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default InviteModal;