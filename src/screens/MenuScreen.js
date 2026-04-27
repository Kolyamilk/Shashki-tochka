// src/screens/MenuScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, get, onValue, off } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';
import { getLevelFromExp, getRankName, getLevelColor } from '../utils/levelSystem';
import { useDailyTasks } from '../context/DailyTasksContext';
import { useInvite } from '../context/InviteContext';

const MenuScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const { resetInviteFlags } = useInvite();
  const insets = useSafeAreaInsets();
  const { tasks, getCompletedCount } = useDailyTasks();
  const [userData, setUserData] = useState(null);
  const [topPlayers, setTopPlayers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [hasNewGifts, setHasNewGifts] = useState(false);
  const [latestGiftEmoji, setLatestGiftEmoji] = useState('');
  const [loadingTopPlayers, setLoadingTopPlayers] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [isConnected, setIsConnected] = useState(null); // null = проверяется, true = подключен, false = нет связи
  const [checkingConnection, setCheckingConnection] = useState(false);

  // Проверка подключения к Firebase
  const checkConnection = useCallback(async () => {
    if (!userId) return;
    setCheckingConnection(true);
    try {
      // Пробуем загрузить данные пользователя как тест подключения
      const userRef = ref(db, `users/${userId}`);
      const userSnapshot = await get(userRef);

      if (userSnapshot.exists()) {
        setIsConnected(true);
        setUserData(userSnapshot.val());
      } else {
        // Пользователь существует, но данных нет - все равно подключение есть
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Ошибка подключения:', error);
      setIsConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  }, [userId]);

  // Проверяем подключение при первой загрузке
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Загружаем данные текущего пользователя
  const fetchUserData = useCallback(async () => {
    if (!userId || !isConnected) return;
    setLoadingUserData(true);
    try {
      const userRef = ref(db, `users/${userId}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        setUserData(snapshot.val());
      }
    } catch (error) {
      console.error('Ошибка загрузки данных пользователя:', error);
      setIsConnected(false);
    } finally {
      setLoadingUserData(false);
    }
  }, [userId, isConnected]);

  // Подписка на изменения данных пользователя (для обновления имени)
  useEffect(() => {
    if (!userId || !isConnected) return;
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
    }, (error) => {
      console.error('Ошибка подписки на данные пользователя:', error);
      setIsConnected(false);
    });
    return () => off(userRef);
  }, [userId, isConnected]);

  // Загружаем топ-3 игроков
  const fetchTopPlayers = useCallback(async () => {
    if (!isConnected) return;
    setLoadingTopPlayers(true);
    try {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const users = Object.values(snapshot.val());
        // Сортируем по уровню (опыту)
        const sorted = users.sort((a, b) => {
          const expA = a.stats?.exp || 0;
          const expB = b.stats?.exp || 0;
          return expB - expA;
        });
        setTopPlayers(sorted.slice(0, 3));
      }
    } catch (error) {
      console.error('Ошибка загрузки топ игроков:', error);
      setIsConnected(false);
    } finally {
      setLoadingTopPlayers(false);
    }
  }, [isConnected]);

  // Загружаем только при первом фокусе
  useFocusEffect(
    useCallback(() => {
      // Пересоздаём подписку на приглашения при возврате на главный экран
      resetInviteFlags();

      // Загружаем данные только если подключены
      if (isConnected) {
        if (!userData && !loadingUserData) fetchUserData();
        if (topPlayers.length === 0 && !loadingTopPlayers) fetchTopPlayers();
      }
    }, [isConnected, userData, topPlayers.length, loadingUserData, loadingTopPlayers, fetchUserData, fetchTopPlayers, resetInviteFlags])
  );

  // ← ← ← ИСПРАВЛЕННЫЙ useEffect для подсчета онлайн
  useEffect(() => {
    const statusRef = ref(db, 'status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const now = Date.now();

        const online = Object.entries(data)
          .filter(([id, status]) => {
            const isOnline = status.online === true;
            const isRecent = status.lastSeen && (now - status.lastSeen < 300000);
            return isOnline && isRecent;
          })
          .map(([id]) => id);

        setOnlineUsers(online);
        setOnlineCount(online.length);
      } else {
        setOnlineUsers([]);
        setOnlineCount(0);
      }
    }, (error) => {
      console.error('Ошибка подписки на статус онлайн:', error);
      setOnlineUsers([]);
      setOnlineCount(0);
    });

    return () => {
      off(statusRef);
    };
  }, []);

  const renderTopPlayer = ({ item, index }) => {
    const level = getLevelFromExp(item.stats?.exp || 0).level;
    const levelColor = getLevelColor(level);
    return (
      <View style={styles.topPlayer}>
        <Text style={styles.topRank}>{index + 1}</Text>
        <Text style={styles.topAvatar}>{item.avatar}</Text>
        <Text style={styles.topName}>{item.name}</Text>
        <Text style={[styles.topLevel, { color: levelColor }]}>Ур. {level}</Text>
      </View>
    );
  };

  // Обработчик для кнопки "Найти соперника"
  const handleFindOpponent = () => {
    if (!isConnected) {
      Alert.alert(
        'Требуется интернет',
        'Для игры с соперником необходимо подключение к интернету',
        [{ text: 'Понятно' }]
      );
      return;
    }
    navigation.navigate('OnlineGameSetup');
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
          <Text style={styles.onlineText}>Онлайн</Text>
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

          {/* Индикатор подключения */}
          {isConnected === false && (
            <View style={styles.connectionWarning}>
              <Text style={styles.connectionWarningText}>⚠️ Нет подключения к интернету</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={checkConnection}
                disabled={checkingConnection}
              >
                <Text style={styles.retryButtonText}>
                  {checkingConnection ? 'Проверка...' : '🔄 Проверить подключение'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Кнопки меню */}
        {isConnected === null ? (
          // Показываем загрузку при проверке подключения
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.checkingText}>Проверка подключения...</Text>
          </View>
        ) : (
          // Показываем кнопки меню всегда (офлайн и онлайн)
          <View style={styles.centerContainer}>
          {/* Кнопка ежедневных заданий */}
          {getCompletedCount() === 3 ? (
            <TouchableOpacity
              style={[
                styles.button,
                styles.tasksButtonCompleted,
                !isConnected && styles.disabledButton
              ]}
              onPress={() => {
                if (!isConnected) {
                  Alert.alert('Требуется интернет', 'Для доступа к заданиям необходимо подключение к интернету');
                  return;
                }
                navigation.navigate('DailyTasks');
              }}
              activeOpacity={0.8}
            >
              <View style={styles.completedTasksContent}>
                <View style={styles.checkmarkCircle}>
                  <Text style={styles.checkmarkIcon}>✓</Text>
                </View>
                <View style={styles.completedTextContainer}>
                  <Text style={styles.completedMainText}>Все задачи выполнены!</Text>
                  <Text style={styles.completedSubText}>+300 опыта получено</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.button,
                styles.tasksButton,
                !isConnected && styles.disabledButton
              ]}
              onPress={() => {
                if (!isConnected) {
                  Alert.alert('Требуется интернет', 'Для доступа к заданиям необходимо подключение к интернету');
                  return;
                }
                navigation.navigate('DailyTasks');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {!isConnected ? '🔒 Задачи на сегодня' : `📋 Задачи на сегодня (${getCompletedCount()}/3)`}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              !isConnected && styles.disabledButton
            ]}
            onPress={handleFindOpponent}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {!isConnected ? '🔒 Найти соперника (требуется интернет)' : '🎯 Найти соперника'}
            </Text>
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
        )}

        {/* Топ-3 игроков */}
        {topPlayers.length > 0 && (
          <View style={[styles.topContainer, !isConnected && styles.blurredSection]}>
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
              onPress={() => {
                if (!isConnected) {
                  Alert.alert('Требуется интернет', 'Для просмотра рейтинга необходимо подключение к интернету');
                  return;
                }
                navigation.navigate('Leaderboard');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.showAllText}>Показать весь рейтинг →</Text>
            </TouchableOpacity>
            {!isConnected && (
              <View style={styles.offlineOverlay}>
                <Text style={styles.offlineOverlayText}>🔒 Требуется интернет</Text>
              </View>
            )}
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
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName} numberOfLines={1}>{userData.name}</Text>
                    {isConnected && (
                      <View style={styles.connectionIndicator} />
                    )}
                  </View>
                  <View style={styles.levelContainer}>
                    <Text style={[styles.levelText, { color: getLevelColor(getLevelFromExp(userData.stats?.exp || 0).level) }]}>
                      Ур. {getLevelFromExp(userData.stats?.exp || 0).level}
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
  connectionWarning: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderWidth: 2,
    borderColor: '#e74c3c',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
    width: '90%',
  },
  connectionWarningText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  checkingText: {
    color: colors.textLight,
    fontSize: 16,
    marginTop: 12,
  },
  offlineMessage: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
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
    backgroundColor: '#9b59b6',
  },
  tasksButton: {
    backgroundColor: '#e74c3c',
  },
  tasksButtonCompleted: {
    backgroundColor: '#27ae60',
    borderWidth: 2,
    borderColor: '#2ecc71',
  },
  completedTasksContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkmarkIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  completedTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  completedMainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completedSubText: {
    color: '#d4f1e8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#555',
  },

  /* Топ-3 игроков */
  topContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
    position: 'relative',
  },
  blurredSection: {
    opacity: 0.5,
  },
  offlineOverlay: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  offlineOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  topLevel: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 60,
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
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    maxWidth: 120,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
    marginLeft: 6,
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