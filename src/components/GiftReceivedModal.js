// src/components/GiftReceivedModal.js
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity } from 'react-native';
import { colors } from '../styles/globalStyles';
import { RARITY_COLORS, RARITY_NAMES } from '../utils/giftSystem';

const GiftReceivedModal = ({ visible, gift, onClose }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const emojiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && gift) {
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

      // Анимация эмодзи подарка
      setTimeout(() => {
        Animated.sequence([
          Animated.spring(emojiAnim, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(emojiAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 300);
    } else {
      // Сброс анимаций
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
      emojiAnim.setValue(0);
    }
  }, [visible, gift]);

  if (!gift) return null;

  const rarityColor = RARITY_COLORS[gift.rarity] || '#95a5a6';
  const rarityName = RARITY_NAMES[gift.rarity] || 'Обычный';

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
              borderColor: rarityColor,
            },
          ]}
        >
          {/* Заголовок */}
          <Text style={styles.title}>🎉 Поздравляем! 🎉</Text>
          <Text style={styles.subtitle}>Вы получили новый подарок!</Text>

          {/* Эмодзи подарка */}
          <Animated.View
            style={[
              styles.emojiContainer,
              {
                opacity: emojiAnim,
                transform: [
                  {
                    scale: emojiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.giftEmoji}>{gift.emoji}</Text>
          </Animated.View>

          {/* Название подарка */}
          <Text style={styles.giftName}>{gift.name}</Text>

          {/* Редкость */}
          <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
            <Text style={styles.rarityText}>{rarityName}</Text>
          </View>

          {/* Описание */}
          <Text style={styles.description}>{gift.description}</Text>

          {/* Информация о подарке */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>💡 Что можно сделать с подарком?</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>
                Храните подарок в коллекции как символ вашего достижения
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>
                Продайте подарок за <Text style={styles.expValue}>{gift.sellValue} опыта</Text> в разделе "Мои подарки"
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>
                Собирайте коллекцию редких подарков и хвастайтесь друзьям!
              </Text>
            </View>
          </View>

          {/* Кнопка закрытия */}
          <TouchableOpacity style={[styles.closeButton, { backgroundColor: rarityColor }]} onPress={onClose}>
            <Text style={styles.closeButtonText}>Забрать подарок</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
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
    width: '90%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 24,
    textAlign: 'center',
  },
  emojiContainer: {
    marginBottom: 16,
  },
  giftEmoji: {
    fontSize: 80,
  },
  giftName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 12,
    textAlign: 'center',
  },
  rarityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  rarityText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  description: {
    fontSize: 15,
    color: '#bbb',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  infoContainer: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  infoBullet: {
    fontSize: 14,
    color: '#4ECDC4',
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    fontSize: 13,
    color: '#ccc',
    flex: 1,
    lineHeight: 20,
  },
  expValue: {
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  closeButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default GiftReceivedModal;
