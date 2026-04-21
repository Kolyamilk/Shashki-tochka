import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../styles/globalStyles';
import { useGameType } from '../context/GameTypeContext';
import { useAuth } from '../context/AuthContext';
import { ref, get } from 'firebase/database';
import { db } from '../firebase/config';
import { EXP_REWARDS } from '../utils/levelSystem';
import { getLevelFromExp } from '../utils/levelSystem';

const difficulties = [
  { name: 'Легкий', value: 'easy', description: 'Для начинающих', expWin: EXP_REWARDS.WIN_BOT_EASY, expLose: EXP_REWARDS.LOSE_BOT },
  { name: 'Средний', value: 'medium', description: 'Для опытных игроков', expWin: EXP_REWARDS.WIN_BOT_MEDIUM, expLose: EXP_REWARDS.LOSE_BOT },
  { name: 'Тяжелый', value: 'hard', description: 'Для профессионалов', expWin: EXP_REWARDS.WIN_BOT_HARD, expLose: EXP_REWARDS.LOSE_BOT },
  { name: 'Гроссмейстер', value: 'grandmaster', description: 'Максимальная сложность', expWin: EXP_REWARDS.WIN_BOT_GRANDMASTER, expLose: EXP_REWARDS.LOSE_BOT },
];

const gameTypes = [
  { id: 'russian', name: 'Русские шашки', emoji: '♟️' },
  { id: 'giveaway', name: 'Поддавки', emoji: '🎯' },
];

const BotDifficultyScreen = ({ navigation }) => {
  const { gameType, setGameType, backgroundColor } = useGameType();
  const { userId } = useAuth();
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
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
    if (selectedDifficulty) {
      navigation.navigate('BotGame', { difficulty: selectedDifficulty });
    }
  };

  return (
    <Animated.View style={[styles.wrapper, { backgroundColor }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Игра с компьютером</Text>

      {/* Текущий уровень */}
      <View style={styles.levelBadge}>
        <Text style={styles.levelBadgeText}>Ваш уровень: {currentLevel}</Text>
      </View>

      {/* Выбор режима игры */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Режим игры</Text>
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
      </View>

      {/* Выбор сложности */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Сложность</Text>
        {difficulties.map((diff) => (
          <TouchableOpacity
            key={diff.value}
            style={[
              styles.difficultyButton,
              selectedDifficulty === diff.value && styles.difficultyButtonSelected,
            ]}
            onPress={() => setSelectedDifficulty(diff.value)}
          >
            <View>
              <Text style={[
                styles.difficultyName,
                selectedDifficulty === diff.value && styles.difficultyNameSelected,
              ]}>
                {diff.name}
              </Text>
              <Text style={styles.difficultyDescription}>{diff.description}</Text>
              <View style={styles.expInfo}>
                <Text style={styles.expText}>Победа: +{diff.expWin} 💎</Text>
                <Text style={styles.expText}>Поражение: +{diff.expLose} 💎</Text>
              </View>
            </View>
            {selectedDifficulty === diff.value && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Кнопки действий */}
      <TouchableOpacity
        style={[styles.startButton, !selectedDifficulty && styles.startButtonDisabled]}
        onPress={handleStart}
        disabled={!selectedDifficulty}
      >
        <Text style={styles.startButtonText}>
          {selectedDifficulty ? 'Начать игру' : 'Выберите сложность'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Назад</Text>
      </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 20,
    textAlign: 'center',
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
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: 15,
  },
  gameTypeContainer: {
    flexDirection: 'row',
    gap: 12,
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
  difficultyButton: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  difficultyButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#3a4a5a',
  },
  difficultyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: 4,
  },
  difficultyNameSelected: {
    color: colors.textLight,
  },
  difficultyDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 6,
  },
  expInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  expText: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BotDifficultyScreen;