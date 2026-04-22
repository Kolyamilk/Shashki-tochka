import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';
import { getAvailableGifts, RARITY_COLORS, RARITY_NAMES } from '../utils/giftSystem';
import { getLevelFromExp } from '../utils/levelSystem';

const ProfileGiftScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const [gifts, setGifts] = useState([]);
  const [userGifts, setUserGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadUserGifts();
  }, [userId]);

  const loadUserGifts = async () => {
    if (!userId) return;

    try {
      const userRef = ref(db, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        const currentLevel = getLevelFromExp(userData.stats?.exp || 0).level;

        // Получаем все доступные подарки до текущего уровня
        const availableGifts = getAvailableGifts(currentLevel);

        // Получаем подарки пользователя из БД (проданные подарки)
        const soldGifts = userData.soldGifts || [];

        // Фильтруем подарки - показываем только те, что не проданы
        const userGiftsList = availableGifts.filter(
          gift => !soldGifts.includes(gift.id)
        );

        setGifts(userGiftsList);
        setUserGifts(userGiftsList);
      }
    } catch (error) {
      console.error('Ошибка загрузки подарков:', error);
    }
  };

  const handleGiftPress = (gift) => {
    setSelectedGift(gift);
    setModalVisible(true);
  };

  const handleSellGift = async () => {
    if (!selectedGift || !userId) return;

    Alert.alert(
      'Продать подарок?',
      `Вы получите ${selectedGift.sellValue} опыта за "${selectedGift.name}". Это действие нельзя отменить.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Продать',
          style: 'destructive',
          onPress: async () => {
            try {
              const userRef = ref(db, `users/${userId}`);
              const snapshot = await get(userRef);

              if (snapshot.exists()) {
                const userData = snapshot.val();
                const currentExp = userData.stats?.exp || 0;
                const soldGifts = userData.soldGifts || [];

                // Добавляем опыт и отмечаем подарок как проданный
                await update(userRef, {
                  'stats/exp': currentExp + selectedGift.sellValue,
                  soldGifts: [...soldGifts, selectedGift.id],
                });

                Alert.alert('Успешно!', `Вы получили ${selectedGift.sellValue} опыта!`);
                setModalVisible(false);
                loadUserGifts(); // Перезагружаем список
              }
            } catch (error) {
              console.error('Ошибка продажи подарка:', error);
              Alert.alert('Ошибка', 'Не удалось продать подарок');
            }
          },
        },
      ]
    );
  };
  const renderGiftItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.giftCard, { borderColor: RARITY_COLORS[item.rarity] }]}
      activeOpacity={0.8}
      onPress={() => handleGiftPress(item)}
    >
      <View style={[styles.giftEmojiContainer, { backgroundColor: `${RARITY_COLORS[item.rarity]}20` }]}>
        <Text style={styles.giftEmoji}>{item.emoji}</Text>
      </View>
      <Text style={styles.giftName} numberOfLines={2}>{item.name}</Text>
      <Text style={[styles.giftRarity, { color: RARITY_COLORS[item.rarity] }]}>
        {RARITY_NAMES[item.rarity]}
      </Text>
      <Text style={styles.giftLevel}>Уровень {item.level}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Header с кнопкой назад */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Мои подарки</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{gifts.length}</Text>
            </View>
          </View>
          <View style={styles.placeholderRight} />
        </View>

        {/* Сетка подарков */}
        <FlatList
          data={gifts}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          renderItem={renderGiftItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎁</Text>
              <Text style={styles.emptyText}>Пока нет подарков</Text>
              <Text style={styles.emptySubtext}>Получайте уникальные подарки каждые 5 уровней!</Text>
            </View>
          }
        />

        {/* Модальное окно с деталями подарка */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedGift && (
                <>
                  <Text style={styles.modalEmoji}>{selectedGift.emoji}</Text>
                  <Text style={styles.modalTitle}>{selectedGift.name}</Text>
                  <Text style={[styles.modalRarity, { color: RARITY_COLORS[selectedGift.rarity] }]}>
                    {RARITY_NAMES[selectedGift.rarity]}
                  </Text>
                  <Text style={styles.modalDescription}>{selectedGift.description}</Text>

                  <View style={styles.modalStats}>
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatLabel}>Уровень</Text>
                      <Text style={styles.modalStatValue}>{selectedGift.level}</Text>
                    </View>
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatLabel}>Цена продажи</Text>
                      <Text style={styles.modalStatValue}>{selectedGift.sellValue} опыта</Text>
                    </View>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.sellButton]}
                      onPress={handleSellGift}
                    >
                      <Text style={styles.modalButtonText}>💰 Продать</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.closeButton]}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.modalButtonText}>Закрыть</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    marginTop: 50,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 17,
    color: colors.primary || '#4ECDC4',
    fontWeight: '600',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textLight,
    marginRight: 8,
  },
  countBadge: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a2a3a',
  },
  placeholderRight: {
    width: 60,
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
  },
  giftCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#2c3e50',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    minHeight: 140,
    borderWidth: 2,
  },
  giftEmojiContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  giftEmoji: {
    fontSize: 36,
  },
  giftName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  giftRarity: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  giftLevel: {
    fontSize: 10,
    color: '#8e8e93',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2c3e50',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  modalEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalRarity: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  modalStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sellButton: {
    backgroundColor: '#f39c12',
  },
  closeButton: {
    backgroundColor: '#555',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },
});

export default ProfileGiftScreen;