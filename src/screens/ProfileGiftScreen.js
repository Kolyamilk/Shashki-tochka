import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { colors } from '../styles/globalStyles';

// Статичные данные подарков (позже заменятся на данные из БД)
const giftsData = [
  {
    id: '1',
    name: 'Розовый мишка',
    emoji: '🧸',
    from: 'Анна',
    date: '2 марта 2025',
  },
  {
    id: '2',
    name: 'Торт с сюрпризом',
    emoji: '🎂',
    from: 'Дмитрий',
    date: '14 фев 2025',
  },
  {
    id: '3',
    name: 'Букет лаванды',
    emoji: '💐',
    from: 'Елена',
    date: '8 мар 2025',
  },
  {
    id: '4',
    name: 'Коробка конфет',
    emoji: '🍫',
    from: 'Максим',
    date: '23 фев 2025',
  },
  {
    id: '5',
    name: 'Воздушный шар',
    emoji: '🎈',
    from: 'Ольга',
    date: '1 мар 2025',
  },
  {
    id: '6',
    name: 'Игровой набор',
    emoji: '🎮',
    from: 'Сергей',
    date: '10 мар 2025',
  },
  {
    id: '7',
    name: 'Книга-квест',
    emoji: '📚',
    from: 'Наталья',
    date: '5 мар 2025',
  },
  {
    id: '8',
    name: 'Плед с рукавами',
    emoji: '🧣',
    from: 'Ирина',
    date: '12 мар 2025',
  },
  {
    id: '9',
    name: 'Фоторамка',
    emoji: '🖼️',
    from: 'Алексей',
    date: '18 мар 2025',
  },
];

const ProfileGiftScreen = ({ navigation }) => {
  const renderGiftItem = ({ item }) => (
    <TouchableOpacity
      style={styles.giftCard}
      activeOpacity={0.8}
      onPress={() => alert(`${item.emoji} ${item.name}\n\nОт: ${item.from}\nДата: ${item.date}`)}
    >
      <View style={styles.giftEmojiContainer}>
        <Text style={styles.giftEmoji}>{item.emoji}</Text>
      </View>
      <Text style={styles.giftName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.giftFrom} numberOfLines={1}>от {item.from}</Text>
      <Text style={styles.giftDate}>{item.date}</Text>
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
              <Text style={styles.countText}>{giftsData.length}</Text>
            </View>
          </View>
          <View style={styles.placeholderRight} />
        </View>

        {/* Сетка подарков */}
        <FlatList
          data={giftsData}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          renderItem={renderGiftItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎁</Text>
              <Text style={styles.emptyText}>Пока нет подарков</Text>
              <Text style={styles.emptySubtext}>Подарки от других игроков появятся здесь</Text>
            </View>
          }
        />
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
  },
  giftEmojiContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
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
  giftFrom: {
    fontSize: 11,
    color: '#4ECDC4',
    textAlign: 'center',
    marginBottom: 2,
    fontWeight: '500',
  },
  giftDate: {
    fontSize: 10,
    color: '#8e8e93',
    textAlign: 'center',
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