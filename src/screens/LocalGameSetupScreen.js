// src/screens/LocalGameSetupScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameType } from '../context/GameTypeContext';
import { colors } from '../styles/globalStyles';

const gameTypes = [
  {
    id: 'russian',
    name: 'Русские шашки',
    emoji: '♟️',
    description: 'Классические правила: побеждает тот, кто съест все шашки соперника или лишит его ходов.',
  },
  {
    id: 'giveaway',
    name: 'Поддавки',
    emoji: '🎯',
    description: 'Цель – отдать все свои шашки первым. Побеждает тот, кто первым остался без фигур.',
  },
];

const LocalGameSetupScreen = ({ navigation }) => {
  const { gameType, setGameType } = useGameType();
  const insets = useSafeAreaInsets();

  const handleStart = () => {
    navigation.navigate('LocalGame');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Локальная игра</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.subtitle}>Выберите режим игры</Text>

        {gameTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.card,
              gameType === type.id && styles.selectedCard,
            ]}
            onPress={() => setGameType(type.id)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.emoji}>{type.emoji}</Text>
              <Text style={styles.typeName}>{type.name}</Text>
            </View>
            <Text style={styles.description}>{type.description}</Text>
            {gameType === type.id && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedText}>✓ Выбрано</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.startButton, !gameType && styles.startButtonDisabled]}
          onPress={handleStart}
          activeOpacity={0.8}
          disabled={!gameType}
        >
          <Text style={styles.startButtonText}>🎮 Начать игру</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Как играть</Text>
          <Text style={styles.infoText}>
            • Два игрока играют по очереди на одном устройстве{'\n'}
            • Игрок 1 (⚪) ходит снизу{'\n'}
            • Игрок 2 (⚫) ходит сверху{'\n'}
            • Передавайте телефон после каждого хода
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
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
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: '#3a4a5a',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 32,
    marginRight: 12,
  },
  typeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  description: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  selectedBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  selectedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginTop: 24,
    marginBottom: 16,
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
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
});

export default LocalGameSetupScreen;
