// src/screens/OnlineGameSetupScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameType } from '../context/GameTypeContext';
import { useAuth } from '../context/AuthContext';
import { ref, get } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { EXP_REWARDS, getLevelFromExp } from '../utils/levelSystem';

const gameTypes = [
  { id: 'russian', name: 'Русские шашки', emoji: '♟️' },
  { id: 'giveaway', name: 'Поддавки', emoji: '🎯' },
];

const OnlineGameSetupScreen = ({ navigation }) => {
  const { gameType, setGameType, backgroundColor } = useGameType();
  const { userId } = useAuth();
  const [currentLevel, setCurrentLevel] = useState(1);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadUserLevel = async () => {
      if (!userId) return;
      try {
        const userStatsRef = ref(db, `users/${userId}/stats`);
        const snapshot = await get(userStatsRef);
        if (snapshot.exists()) {
          const stats = snapshot.val();
          const levelInfo = getLevelFromExp(stats.exp || 0);
          setCurrentLevel(levelInfo.level);
        }
      } catch (error) {
        console.error('Ошибка загрузки уровня:', error);
      }
    };
    loadUserLevel();
  }, [userId]);

  const handleStart = () => {
    navigation.navigate('FindOpponent');
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Онлайн игра</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {/* Текущий уровень */}
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>Ваш уровень: {currentLevel}</Text>
        </View>

        {/* Награды за игру (стилизовано как блок информации) */}
        <View style={styles.rewardBox}>
          <View style={styles.rewardHeader}>
            <Text style={styles.rewardTitle}>💎 Награды за онлайн игру</Text>
          </View>
          <View style={styles.expRow}>
            <Text style={styles.expText}>Победа: +{EXP_REWARDS.WIN_ONLINE} опыта</Text>
          </View>
          <View style={styles.expRow}>
            <Text style={styles.expText}>Поражение: +{EXP_REWARDS.LOSE_ONLINE} опыта</Text>
          </View>
        </View>

        {/* Выбор режима игры (горизонтальные кнопки, как в BotDifficultyScreen) */}
        <Text style={styles.subtitle}>Выберите режим игры</Text>
        <View style={styles.gameTypeContainer}>
          {gameTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.gameTypeButton,
                gameType === type.id && styles.gameTypeButtonSelected,
              ]}
              onPress={() => setGameType(type.id)}
            >
              <Text style={styles.gameTypeEmoji}>{type.emoji}</Text>
              <Text style={[
                styles.gameTypeText,
                gameType === type.id && styles.gameTypeTextSelected,
              ]}>
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Информационный блок (как подсказка) */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Как это работает</Text>
          <Text style={styles.infoText}>
            • Система найдёт вам соперника онлайн{'\n'}
            • Если поиск затянется, начнётся игра с ботом{'\n'}
            • Играйте и побеждайте!
          </Text>
        </View>

        {/* Кнопка старта (такая же, как в BotDifficultyScreen) */}
        <TouchableOpacity
          style={[styles.startButton, !gameType && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!gameType}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>
            {gameType ? '🎮 Найти соперника' : 'Выберите режим'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  content: {
    padding: 16,
  },
  levelBadge: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  levelBadgeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a2a3a',
  },
  rewardBox: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  rewardHeader: {
    marginBottom: 10,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    textAlign: 'center',
  },
  expRow: {
    marginBottom: 6,
  },
  expText: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: 16,
    textAlign: 'center',
  },
  gameTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  gameTypeButton: {
    flex: 1,
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gameTypeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#3a4a5a',
  },
  gameTypeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  gameTypeText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    fontWeight: '600',
  },
  gameTypeTextSelected: {
    color: colors.textLight,
  },
  infoBox: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.5)',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 10,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 22,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginTop: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonDisabled: {
    backgroundColor: '#555',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
});

export default OnlineGameSetupScreen;