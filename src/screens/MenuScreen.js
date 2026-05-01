// src/screens/MenuScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView, Modal,AppState  } from 'react-native';
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
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Проверка подключения к Firebase
const checkConnection = useCallback(async () => {
  if (!userId) return;
  setCheckingConnection(true);
  try {
    const userRef = ref(db, `users/${userId}`);
    // Таймаут 8 секунд для более надёжной проверки
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 8000)
    );
    const userSnapshot = await Promise.race([get(userRef), timeoutPromise]);

    // Если запрос дошёл до Firebase и вернул snapshot — значит связь есть.
    if (userSnapshot.exists()) {
      setIsConnected(true);
      setUserData(userSnapshot.val());
    } else {
      setIsConnected(true);
      setUserData(null);
    }
  } catch (error) {
    console.warn('Проверка не удалась, пробуем ещё раз...');
    // Одна повторная попытка
    try {
      const userRef = ref(db, `users/${userId}`);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 8000)
      );
      const userSnapshot = await Promise.race([get(userRef), timeoutPromise]);

      if (userSnapshot.exists()) {
        setIsConnected(true);
        setUserData(userSnapshot.val());
      } else {
        setIsConnected(true);
        setUserData(null);
      }
    } catch (secondError) {
      console.error('Ошибка подключения после повтора:', secondError);
      setIsConnected(false);
      setUserData(null);
    }
  } finally {
    setCheckingConnection(false);
  }
}, [userId]);

  // Проверяем подключение при первой загрузке
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Слушаем реальное состояние подключения к интернету через Firebase.
  // Если интернет пропал — переключаемся в офлайн-режим (как при isConnected === false).
  useEffect(() => {
    const firebaseConnectionRef = ref(db, '.info/connected');

    const unsubscribe = onValue(
      firebaseConnectionRef,
      (snapshot) => {
        const connected = snapshot.val() === true;

        if (!connected) {
          setIsConnected(false);
          setUserData(null);
          setHasNewGifts(false);
          setLatestGiftEmoji('');
          return;
        }

        // Подключение восстановлено.
        setIsConnected(true);

        // Догружаем актуальные данные пользователя (если экран активен/пользователь есть).
        // checkConnection делает проверку get(users/:id) с таймаутом и обновляет userData.
        checkConnection();
      },
      (error) => {
        console.error('Ошибка слушателя .info/connected:', error);
      }
    );

    return () => {
      // В этой части проекта используется off(ref) вместо вызова unsubscribe()
      // — оставляю в стиле текущего кода.
      off(firebaseConnectionRef);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [checkConnection]);
  // Закрываем модальное окно при успешном подключении
  useEffect(() => {
    if (isConnected === true && showConnectionModal) {
      setShowConnectionModal(false);
    }
  }, [isConnected, showConnectionModal]);

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

  // Загружаем при каждом фокусе
  useFocusEffect(
    useCallback(() => {
      // Пересоздаём подписку на приглашения при возврате на главный экран
      resetInviteFlags();

      // Загружаем данные только если подключены
      if (isConnected) {
        if (!userData && !loadingUserData) fetchUserData();
        // Всегда обновляем топ игроков при возврате на экран
        if (!loadingTopPlayers) fetchTopPlayers();
      }
    }, [isConnected, userData, loadingUserData, loadingTopPlayers, fetchUserData, fetchTopPlayers, resetInviteFlags])
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
useEffect(() => {
  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      // При возврате в приложение пытаемся переподключиться
      checkConnection();
    }
  };
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription?.remove();
}, [checkConnection]);
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
    if (isConnected === false || isConnected === null) {
      setShowConnectionModal(true);
      return;
    }
    navigation.navigate('OnlineGameSetup');
  };

  // Обработчик для кнопки "Задачи"
  const handleDailyTasks = () => {
    if (isConnected === false || isConnected === null) {
      setShowConnectionModal(true);
      return;
    }
    navigation.navigate('DailyTasks');
  };

  // Обработчик для топ игроков
  const handleLeaderboard = () => {
    if (isConnected === false || isConnected === null) {
      setShowConnectionModal(true);
      return;
    }
    navigation.navigate('Leaderboard');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Модальное окно ошибки соединения */}
      {showConnectionModal && (
        <Modal visible={showConnectionModal} transparent animationType="fade" onRequestClose={() => setShowConnectionModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚠️ Ошибка соединения</Text>
              <Text style={styles.modalText}>Для доступа к этой функции необходимо подключение к интернету</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={async () => {
                    setShowConnectionModal(false);
                    await checkConnection();
                  }}
                  disabled={checkingConnection}
                >
                  <Text style={styles.modalButtonText}>
                    {checkingConnection ? 'Проверка...' : '🔄 Повторить'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowConnectionModal(false)}
                >
                  <Text style={styles.modalButtonText}>Закрыть</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Онлайн бейдж */}
      <TouchableOpacity
        style={[styles.onlineContainer, { top: insets.top + 10 }]}
        onPress={() => {
          if (isConnected === false || isConnected === null) {
            setShowConnectionModal(true);
            return;
          }
          navigation.navigate('Players');
        }}
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
        </View>

        {/* Кнопки меню */}
        <View style={styles.centerContainer}>
          {/* Кнопка ежедневных заданий */}
          {getCompletedCount() === 3 && isConnected === true ? (
            <TouchableOpacity
              style={[
                styles.button,
                styles.tasksButtonCompleted,
              ]}
              onPress={handleDailyTasks}
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
                (isConnected === false || isConnected === null) && styles.disabledButton
              ]}
              onPress={handleDailyTasks}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {(isConnected === false || isConnected === null) ? '🔒 Задачи на сегодня' : `📋 Задачи на сегодня (${getCompletedCount()}/3)`}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              (isConnected === false || isConnected === null) && styles.disabledButton
            ]}
            onPress={handleFindOpponent}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {(isConnected === false || isConnected === null) ? '🔒 Найти соперника' : '🎯 Найти соперника'}
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

        {/* Топ-3 игроков */}
        <View style={[styles.topContainer, isConnected === false && styles.blurredSection]}>
          <Text style={styles.topTitle}>🏆 Топ-3 игроков</Text>
          {isConnected === true && topPlayers.length > 0 ? (
            <>
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
                onPress={handleLeaderboard}
                activeOpacity={0.8}
              >
                <Text style={styles.showAllText}>Показать весь рейтинг →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.topPlayersList}>
                {[1, 2, 3].map((index) => (
                  <View key={index} style={styles.topPlayer}>
                    <Text style={styles.topRank}>{index}</Text>
                    <Text style={styles.topAvatar}>👤</Text>
                    <Text style={styles.topName}>Игрок {index}</Text>
                    <Text style={[styles.topLevel, { color: '#888' }]}>Ур. --</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.showAllButton}
                onPress={handleLeaderboard}
                activeOpacity={0.8}
              >
                <Text style={styles.showAllText}>Показать весь рейтинг →</Text>
              </TouchableOpacity>
            </>
          )}
          {(isConnected === false || isConnected === null) && (
            <TouchableOpacity
              style={styles.offlineOverlay}
              activeOpacity={1}
              onPress={() => setShowConnectionModal(true)}
            >
              <Text style={styles.offlineOverlayText}>🔒 Требуется интернет</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Нижняя панель */}
        <View style={styles.bottomPanel}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => {
              if (isConnected === true) {
                navigation.navigate('Profile');
              } else {
                setShowConnectionModal(true);
              }
            }}
            activeOpacity={0.8}
          >
            {isConnected === false || isConnected === null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.textWarning, fontSize: 16, fontWeight: '700' }}>🔒 Офлайн</Text>
              </View>
            ) : userData ? (
              <View style={styles.profileInfo}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatar}>{userData.avatar}</Text>
                  {hasNewGifts && (
                    <View style={styles.giftBadge}>
                      <Text style={styles.giftBadgeEmoji}>🎁</Text>
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName} numberOfLines={1}>{userData.name}</Text>
                    {isConnected === true && (
                      <View style={styles.connectionIndicator} />
                    )}
                  </View>
                  <View style={styles.levelContainer}>
                    <Text
                      style={[
                        styles.levelText,
                        { color: getLevelColor(getLevelFromExp(userData.stats?.exp || 0).level) },
                      ]}
                    >
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

  /* Модальное окно */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2c3e50',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e74c3c',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#7f8c8d',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  /* Топ-3 игроков */
  topContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
    position: 'relative',
  },
  blurredSection: {
    opacity: 0.9,
  },
  offlineOverlay: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  offlineOverlayText: {

    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    backgroundColor: '#ff4433',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
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
    top: -5,
    right: -5,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a2a3a',
  },
  giftBadgeEmoji: {
    fontSize: 12,
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
