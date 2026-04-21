import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../styles/globalStyles';
import { useGameType } from '../context/GameTypeContext';

const difficulties = [
  { name: 'Легкий', value: 'easy', description: 'Для начинающих' },
  { name: 'Средний', value: 'medium', description: 'Для опытных игроков' },
  { name: 'Тяжелый', value: 'hard', description: 'Для профессионалов' },
  { name: 'Гроссмейстер', value: 'grandmaster', description: 'Максимальная сложность' },
];

const gameTypes = [
  { id: 'russian', name: 'Русские шашки', emoji: '♟️' },
  { id: 'giveaway', name: 'Поддавки', emoji: '🎯' },
];

const BotDifficultyScreen = ({ navigation }) => {
  const { gameType, setGameType } = useGameType();
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const insets = useSafeAreaInsets();

  const handleStart = () => {
    if (selectedDifficulty) {
      navigation.navigate('BotGame', { difficulty: selectedDifficulty });
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Игра с компьютером</Text>

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
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 30,
    textAlign: 'center',
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