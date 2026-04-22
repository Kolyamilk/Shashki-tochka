// src/screens/MenuScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, get, onValue, off } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';
import { getLevelFromExp, getRankName, getLevelColor } from '../utils/levelSystem';

const MenuScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState(null);
  const [topPlayers, setTopPlayers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [hasNewGifts, setHasNewGifts] = useState(false);
  const [latestGiftEmoji, setLatestGiftEmoji] = useState('');

  // Загружаем данные текущего пользователя
  const fetchUserData = useCallback(async () => {
    if (!userId) return;
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      setUserData(snapshot.val());
    }
  }, [userId]);

  // Подписка на изменения данных пользователя (для обновления имени)
  useEffect(() => {
    if (!userId) return;
    const userRef = ref(db, `users/${userId}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setUserData(data);

        // Проверяем наличие новых подарков
        const newGifts = data.newGifts || [];
        setHasNewGifts(newGifts.length > 0);

        // Получаем эмодзи последнего подарка
        if (newGifts.length > 0) {
          const latestGiftId = newGifts[newGifts.length - 1];
          const level = parseInt(latestGiftId.replace('gift_level_', ''));
          const { LEVEL_GIFTS } = require('../utils/giftSystem');
          const gift = LEVEL_GIFTS[level];
          if (gift) {
            setLatestGiftEmoji(gift.emoji);
          }
        }
      }
    });
    return () => off(userRef);
  }, [userId]);

  // Загружаем топ-3 игроков
  const fetchTopPlayers = useCallback(async () => {
    try {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const users = Object.values(snapshot.val());
        const sorted = users.sort((a, b) => {
          const rateA = a.stats?.totalGames === 0 ? 0 : a.stats?.wins / a.stats?.totalGames;
          const rateB = b.stats?.totalGames === 0 ? 0 : b.stats?.wins / b.stats?.totalGames;
          return rateB - rateA;
        });
        setTopPlayers(sorted.slice(0, 3));
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Загружаем только при первом фокусе
  useFocusEffect(
    useCallback(() => {
      if (!userData) fetchUserData();
      if (topPlayers.length === 0) fetchTopPlayers();
    }, [userData, topPlayers.length, fetchUserData, fetchTopPlayers])
  );

  // ← ← ← ИСПРАВЛЕННЫЙ useEffect для подсчета онлайн
  useEffect(() => {
    console.log('📡 Подписка на статусы игроков');
    
    const statusRef = ref(db, 'status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      console.log('📊 Status data:', data ? Object.keys(data).length : 'empty');
      
      if (data) {
        const now = Date.now();
        
        // ← ← ← КРИТИЧНО: считаем онлайн только если:
        // 1. online === true
        // 2. lastSeen < 5 минут назад (игрок действительно активен)
        const online = Object.entries(data)
          .filter(([id, status]) => {
            const isOnline = status.online === true;
            const isRecent = status.lastSeen && (now - status.lastSeen < 300000); // 5 минут
            console.log(`User ${id}: online=${isOnline}, recent=${isRecent}, lastSeen=${status.lastSeen}`);
            return isOnline && isRecent;
          })
          .map(([id]) => id);
        
        setOnlineUsers(online);
        setOnlineCount(online.length);
        console.log(`✅ Online count: ${online.length}`);
      } else {
        setOnlineUsers([]);
        setOnlineCount(0);
        console.log('✅ Online count: 0 (no data)');
      }
    });
    
    return () => {
      console.log('🧹 Очистка подписки на статусы');
      off(statusRef);
    };
  }, []);  // ← ← ← Пустые зависимости - подписка создаётся один раз!

  const renderTopPlayer = ({ item, index }) => {
    const winRate = item.stats?.totalGames === 0 ? 0 : ((item.stats.wins / item.stats.totalGames) * 100).toFixed(1);
    return (
      <View style={styles.topPlayer}>
        <Text style={styles.topRank}>{index + 1}</Text>
        <Text style={styles.topAvatar}>{item.avatar}</Text>
        <Text style={styles.topName}>{item.name}</Text>
        <Text style={styles.topRate}>{winRate}%</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Онлайн бейдж */}
      <TouchableOpacity
        style={[styles.onlineContainer, { top: insets.top + 10 }]}
        onPress={() => navigation.navigate('Players')}
        activeOpacity={0.7}
      >
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Онлайн: {onlineCount}</Text>
        </View>
      </TouchableOpacity>

      {/* Основной контент */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Заголовок */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Шашки и точка</Text>
        </View>

        {/* Кнопки меню */}
        <View style={styles.centerContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => navigation.navigate('OnlineGameSetup')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>🎯 Найти соперника</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => navigation.navigate('BotDifficulty')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>🤖 Играть с компьютером</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.localButton]}
            onPress={() => navigation.navigate('LocalGameSetup')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>👥 Локальная игра</Text>
          </TouchableOpacity>
        </View>

        {/* Топ-3 игроков */}
        {topPlayers.length > 0 && (
          <View style={styles.topContainer}>
            <Text style={styles.topTitle}>🏆 Топ-3 игроков</Text>
            <View style={styles.topPlayersList}>
              <FlatList
                data={topPlayers}
                renderItem={renderTopPlayer}
                keyExtractor={(_, index) => index.toString()}
                scrollEnabled={false}
              />
            </View>
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => navigation.navigate('Leaderboard')}
              activeOpacity={0.8}
            >
              <Text style={styles.showAllText}>Показать весь рейтинг →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Нижняя панель */}
        <View style={styles.bottomPanel}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {userData ? (
              <View style={styles.profileInfo}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatar}>{userData.avatar}</Text>
                  {hasNewGifts && (
                    <View style={styles.giftBadge}>
                      <Text style={styles.giftBadgeEmoji}>{latestGiftEmoji}</Text>
                      <View style={styles.giftBadgePlus}>
                        <Text style={styles.giftBadgePlusText}>+</Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>{userData.name}</Text>
                  <View style={styles.levelContainer}>
                    <Text style={[styles.levelText, { color: getLevelColor(getLevelFromExp(userData.stats?.exp || 0).level) }]}>
                      ⭐ Ур. {getLevelFromExp(userData.stats?.exp || 0).level}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <ActivityIndicator size="small" color={colors.textLight} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.8}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
};

// ← ← ← СТИЛИ (оставьте ваши существующие)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  
  /* Онлайн бейдж */
  onlineContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
    marginRight: 6,
  },
  onlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Заголовок */
  headerSection: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    color: colors.textLight,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  /* Кнопки меню */
  centerContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  button: {
    width: '100%',
    maxWidth: 300,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  localButton: {
    backgroundColor: '#27ae60',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  /* Топ-3 игроков */
  topContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 12,
  },
  topPlayersList: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a4a5a',
  },
  topPlayer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3a4a5a',
  },
  topRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    width: 30,
  },
  topAvatar: {
    fontSize: 22,
    marginHorizontal: 8,
  },
  topName: {
    flex: 1,
    fontSize: 15,
    color: colors.textLight,
    fontWeight: '500',
  },
  topRate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4ECDC4',
    width: 50,
    textAlign: 'right',
  },
  showAllButton: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  showAllText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Нижняя панель */
  bottomPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    marginTop: 'auto',
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  avatar: {
    fontSize: 28,
  },
  giftBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#1a2a3a',
  },
  giftBadgeEmoji: {
    fontSize: 14,
  },
  giftBadgePlus: {
    marginLeft: 2,
  },
  giftBadgePlusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a2a3a',
  },
  userInfo: {
    flexDirection: 'column',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    maxWidth: 120,
  },
  levelContainer: {
    marginTop: 2,
  },
  levelText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  settingsButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsIcon: {
    fontSize: 22,
  },
});

export default MenuScreen;