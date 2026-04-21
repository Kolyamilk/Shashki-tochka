import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { useGameType } from '../context/GameTypeContext';
import { colors } from '../styles/globalStyles';

const GameTypeScreen = ({ navigation }) => {
  const { gameType, setGameType, backgroundColor } = useGameType();

  const types = [
    {
      id: 'russian',
      name: 'Русские шашки',
      description: 'Классические правила: обычная шашка ходит вперёд, бьёт вперёд и назад. Обязательное взятие. Побеждает тот, кто съест все шашки соперника или лишит его ходов.',
    },
    {
      id: 'giveaway',
      name: 'Поддавки',
      description: 'Игрок, который первым отдаст все свои шашки или не сможет сделать ход — побеждает. Цель – проиграть по правилам русских шашек.',
    },
  ];

  const handleSelect = (typeId) => {
    setGameType(typeId);
    navigation.goBack();
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Тип игры</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {types.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[styles.card, gameType === type.id && styles.selectedCard]}
            onPress={() => handleSelect(type.id)}
          >
            <Text style={styles.typeName}>{type.name}</Text>
            <Text style={styles.description}>{type.description}</Text>
            {gameType === type.id && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedText}>✓ Выбрано</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
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
    paddingTop: 50,
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
  card: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: '#3a4a5a',
  },
  typeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 8,
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
});

export default GameTypeScreen;