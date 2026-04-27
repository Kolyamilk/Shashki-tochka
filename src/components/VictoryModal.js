// src/components/VictoryModal.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity } from 'react-native';
import { colors } from '../styles/globalStyles';
import { getLevelFromExp, getRankName, getLevelColor } from '../utils/levelSystem';
import { shouldReceiveGift, getGiftForLevel } from '../utils/giftSystem';
import GiftReceivedModal from './GiftReceivedModal';
import TaskCompletedModal from './TaskCompletedModal';
import { useDailyTasks } from '../context/DailyTasksContext';

const VictoryModal = ({ visible, isWin, expGained, oldExp, onClose, opponentLeft = false, navigation, hasNewGift = false, playerSurrendered = false }) => {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [receivedGift, setReceivedGift] = useState(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const { newlyCompletedTask, clearCompletedTask } = useDailyTasks();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const levelUpAnim = useRef(new Animated.Value(0)).current;

  const oldLevelInfo = getLevelFromExp(oldExp);
  const newLevelInfo = getLevelFromExp(oldExp + expGained);
  const leveledUp = newLevelInfo.level > oldLevelInfo.level;

  const oldProgress = oldLevelInfo.currentLevelExp / oldLevelInfo.expForNextLevel;
  const newProgress = leveledUp ? 1 : (newLevelInfo.currentLevelExp / newLevelInfo.expForNextLevel);

  const levelColor = getLevelColor(newLevelInfo.level);
  const rankName = getRankName(newLevelInfo.level);

  useEffect(() => {
    if (visible) {
      // Проверяем, получил ли игрок подарок (используем переданный параметр hasNewGift)
      if (leveledUp && hasNewGift) {
        const gift = getGiftForLevel(newLevelInfo.level);
        if (gift) {
          setReceivedGift(gift);
        }
      }

      // Проверяем, есть ли выполненное задание
      if (newlyCompletedTask) {
        setShowTaskModal(true);
      }

      // Появление модального окна
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Анимация заполнения прогресс-бара
      setTimeout(() => {
        Animated.timing(progressAnim, {
          toValue: newProgress,
          duration: 1500,
          useNativeDriver: false,
        }).start(() => {
          // Если повысился уровень, показываем анимацию
          if (leveledUp) {
            setTimeout(() => {
              setShowLevelUp(true);
              Animated.sequence([
                Animated.spring(levelUpAnim, {
                  toValue: 1,
                  friction: 6,
                  tension: 40,
                  useNativeDriver: true,
                }),
                Animated.timing(levelUpAnim, {
                  toValue: 1,
                  duration: 1000,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                // Показываем модальное окно подарка после анимации уровня
                if (receivedGift) {
                  setTimeout(() => {
                    setShowGiftModal(true);
                  }, 500);
                }
              });
            }, 300);
          }
        });
      }, 500);
    } else {
      // Сброс анимаций
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
      progressAnim.setValue(0);
      levelUpAnim.setValue(0);
      setShowLevelUp(false);
      setReceivedGift(null);
      setShowGiftModal(false);
      setShowTaskModal(false);
    }
  }, [visible, leveledUp, newlyCompletedTask]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Заголовок */}
          <Text style={styles.title}>
            {playerSurrendered ? '🏳️ Вы решили сдаться' : (opponentLeft ? '🚪 Противник покинул игру' : (isWin ? '🎉 Победа!' : '😔 Вы проиграли'))}
          </Text>

          {/* Полученный опыт */}
          <View style={styles.expContainer}>
            <Text style={styles.expLabel}>Получено опыта</Text>
            <Text style={styles.expValue}>+{expGained}</Text>
          </View>

          {/* Прогресс-бар */}
          <View style={styles.levelSection}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelText}>
                Уровень {leveledUp ? oldLevelInfo.level : newLevelInfo.level}
              </Text>
              <Text style={styles.rankText}>{leveledUp ? getRankName(oldLevelInfo.level) : rankName}</Text>
            </View>

            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressWidth,
                    backgroundColor: leveledUp ? getLevelColor(oldLevelInfo.level) : levelColor,
                  },
                ]}
              />
            </View>

            <Text style={styles.progressText}>
              {leveledUp ? `${oldLevelInfo.currentLevelExp + expGained} / ${oldLevelInfo.expForNextLevel}` : `${newLevelInfo.currentLevelExp} / ${newLevelInfo.expForNextLevel}`}
            </Text>
          </View>

          {/* Анимация повышения уровня */}
          {showLevelUp && (
            <Animated.View
              style={[
                styles.levelUpContainer,
                {
                  opacity: levelUpAnim,
                  transform: [
                    {
                      scale: levelUpAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.levelUpTitle}>⭐ НОВЫЙ УРОВЕНЬ! ⭐</Text>
              <Text style={styles.levelUpNumber}>{newLevelInfo.level}</Text>
              <Text style={styles.levelUpRank}>{rankName}</Text>
              {receivedGift && (
                <View style={styles.giftNotification}>
                  <Text style={styles.giftEmoji}>{receivedGift.emoji}</Text>
                  <Text style={styles.giftText}>Вам подарок!</Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Кнопка закрытия */}
          {receivedGift ? (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                onClose();
                if (navigation) {
                  navigation.navigate('GiftScreen');
                }
              }}
            >
              <Text style={styles.closeButtonText}>🎁 Посмотреть подарок</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Продолжить</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>

      {/* Модальное окно подарка */}
      <GiftReceivedModal
        visible={showGiftModal}
        gift={receivedGift}
        onClose={() => {
          setShowGiftModal(false);
          onClose();
        }}
      />

      {/* Модальное окно выполненного задания */}
      <TaskCompletedModal
        visible={showTaskModal}
        task={newlyCompletedTask}
        onClose={() => {
          setShowTaskModal(false);
          clearCompletedTask();
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#2c3e50',
    borderRadius: 24,
    padding: 30,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 20,
    textAlign: 'center',
  },
  expContainer: {
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  expLabel: {
    fontSize: 16,
    color: '#8e8e93',
    marginBottom: 8,
  },
  expValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  levelSection: {
    width: '100%',
    marginBottom: 20,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  progressBarContainer: {
    height: 16,
    backgroundColor: '#1a2a3a',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },
  levelUpContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  levelUpTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
  },
  levelUpNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  levelUpRank: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textLight,
  },
  giftNotification: {
    marginTop: 16,
    alignItems: 'center',
  },
  giftEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  giftText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  closeButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a2a3a',
  },
});

export default VictoryModal;
