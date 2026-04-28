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
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Игра с компьютером</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Текущий уровень */}
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>Ваш уровень: {currentLevel}</Text>
        </View>

        {/* Выбор режима игры */}
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

        {/* Выбор сложности */}
        <Text style={styles.subtitle}>Выберите сложность</Text>
        {difficulties.map((diff) => (
          <TouchableOpacity
            key={diff.value}
            style={[
              styles.difficultyButton,
              selectedDifficulty === diff.value && styles.difficultyButtonSelected,
            ]}
            onPress={() => setSelectedDifficulty(diff.value)}
          >
            <View style={styles.difficultyContent}>
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

        {/* Кнопка старта */}
        <TouchableOpacity
          style={[styles.startButton, !selectedDifficulty && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!selectedDifficulty}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>
            {selectedDifficulty ? '🎮 Начать игру' : 'Выберите сложность'}
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
    paddingBottom: 8, // уменьшено
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  levelBadge: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 12,
  },
  levelBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a2a3a',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: 10,
    textAlign: 'center',
  },
  gameTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  gameTypeButton: {
    flex: 1,
    backgroundColor: '#2c3e50',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gameTypeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#3a4a5a',
  },
  gameTypeEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  gameTypeText: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    fontWeight: '600',
  },
  gameTypeTextSelected: {
    color: colors.textLight,
  },
  difficultyButton: {
    backgroundColor: '#2c3e50',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
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
  difficultyContent: {
    flex: 1,
  },
  difficultyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: 2,
  },
  difficultyNameSelected: {
    color: colors.textLight,
  },
  difficultyDescription: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  expInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  expText: {
    fontSize: 10,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  startButtonDisabled: {
    backgroundColor: '#555',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
});

export default BotDifficultyScreen;