// src/screens/PlayerProfileScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { ref, get, push, set, remove, onValue, off, update } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';
import { sendPushNotification } from '../utils/notifications';
import { useInvite } from '../context/InviteContext';

const PlayerProfileScreen = ({ route, navigation }) => {
  const { playerId } = route.params;
  const { userId } = useAuth();
  const { resetInviteFlags } = useInvite();

  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [sentInviteId, setSentInviteId] = useState(null);
  const [playerGameStatus, setPlayerGameStatus] = useState({
    inGame: false,
    gameType: null, // 'pvp', 'bot', 'solo'
    gameId: null,
  });
  const [hasPendingInvite, setHasPendingInvite] = useState(false);

  const gameCreatedRef = useRef(false);
  const subscriptionsRef = useRef({
    games: null,
    botGames: null,
  });

  // ← ← ← ИСПРАВЛЕННАЯ функция проверки статуса игры (с useCallback)
  const checkPlayerGameStatus = useCallback(async () => {
    try {
      // 1. Проверяем игры PvP
      const gamesRef = ref(db, 'games_checkers');
      const gamesSnap = await get(gamesRef);
      if (gamesSnap.exists()) {
        const games = gamesSnap.val();
        for (const [gid, game] of Object.entries(games)) {
          const isRecent = game.createdAt && (Date.now() - game.createdAt < 600000);
          if (game.status === 'active' && game.players && game.players[playerId] && isRecent) {
            setPlayerGameStatus({ inGame: true, gameType: 'pvp', gameId: gid });
            return;
          }
        }
      }

      // 2. Проверяем игры с ботом
      const botGamesRef = ref(db, 'bot_games');
      const botSnap = await get(botGamesRef);
      if (botSnap.exists()) {
        const botGames = botSnap.val();
        for (const [gid, game] of Object.entries(botGames)) {
          const isRecent = game.startedAt && (Date.now() - game.startedAt < 600000);
          if (game.status === 'active' && game.playerId === playerId && isRecent) {
            setPlayerGameStatus({ inGame: true, gameType: 'bot', gameId: gid });
            return;
          }
        }
      }

      setPlayerGameStatus({ inGame: false, gameType: null, gameId: null });
    } catch (error) {
      console.error('Ошибка проверки статуса игры:', error);
      setPlayerGameStatus({ inGame: false, gameType: null, gameId: null });
    }
  }, [playerId]);

  // Получение данных игрока и его статуса
  useEffect(() => {
    // Пересоздаём подписку при входе на экран
    console.log('🔄 PlayerProfileScreen: пересоздаём подписку на приглашения');
    resetInviteFlags();

    const fetchPlayerData = async () => {
      try {
        const userRef = ref(db, `users/${playerId}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          setPlayerData(snapshot.val());
        }

        const statusRef = ref(db, `status/${playerId}`);
        const statusSnap = await get(statusRef);
        if (statusSnap.exists()) {
          const status = statusSnap.val();
          setIsOnline(status.online === true);
          setLastSeen(status.lastSeen);
        }

        await checkSentInvite();
        await checkPlayerGameStatus();
        await checkPlayerHasPendingInvite();

        // Проверяем, вернулись ли мы с экрана выбора режима
        if (route.params?.sendInvite && route.params?.selectedGameType) {
          await sendInviteWithGameType(route.params.selectedGameType);
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Ошибка', 'Не удалось загрузить данные игрока');
      } finally {
        setLoading(false);
      }
    };
    fetchPlayerData();
  }, [playerId, userId, route.params]); 

  // Подписка на изменения приглашений (отправленные мной)
  useEffect(() => {
    const invitationsRef = ref(db, 'invitations');
    const unsubscribe = onValue(invitationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        for (const [id, inv] of Object.entries(data)) {
          if (inv.from === userId && inv.to === playerId && inv.status === 'pending') {
            setSentInviteId(id);
            return;
          }
        }
      }
      setSentInviteId(null);
    });
    return () => off(invitationsRef);
  }, [userId, playerId]);

  // ← ← ← ИСПРАВЛЕННЫЙ useEffect для подписки на статус игры
  useEffect(() => {
    checkPlayerGameStatus();

    const gamesRef = ref(db, 'games_checkers');
    const unsubscribeGames = onValue(gamesRef, async () => {
      await checkPlayerGameStatus();
    });

    const botGamesRef = ref(db, 'bot_games');
    const unsubscribeBot = onValue(botGamesRef, async () => {
      await checkPlayerGameStatus();
    });

    subscriptionsRef.current = {
      games: unsubscribeGames,
      botGames: unsubscribeBot,
    };

    return () => {
      if (typeof unsubscribeGames === 'function') unsubscribeGames();
      if (typeof unsubscribeBot === 'function') unsubscribeBot();
      off(gamesRef);
      off(botGamesRef);
      setPlayerGameStatus({ inGame: false, gameType: null, gameId: null });
    };
  }, [playerId, checkPlayerGameStatus]);

  // Подписка на входящие приглашения для этого игрока
  useEffect(() => {
    const invitationsRef = ref(db, 'invitations');
    const unsubscribe = onValue(invitationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const hasPending = Object.values(data).some(
          inv => inv.to === playerId && inv.status === 'pending'
        );
        setHasPendingInvite(hasPending);
      } else {
        setHasPendingInvite(false);
      }
    });
    return () => off(invitationsRef);
  }, [playerId]);

  // Автоматический переход в игру, если появилась активная игра для текущего пользователя
  useEffect(() => {
    const gamesRef = ref(db, 'games_checkers');
    const unsubscribe = onValue(gamesRef, (snapshot) => {
      const games = snapshot.val();
      if (!games) return;
      for (const [gid, game] of Object.entries(games)) {
        if (game.status === 'active' && game.players && game.players[userId]) {
          if (navigation.isFocused() && !gameCreatedRef.current) {
            gameCreatedRef.current = true;
            const myRole = game.players[userId];
            navigation.replace('OnlineGame', { gameId: gid, playerKey: userId, myRole });
            break;
          }
        }
      }
    });
    return () => off(gamesRef);
  }, [userId, navigation]);

  // ... остальные функции без изменений ...
  const checkSentInvite = async () => {
    try {
      const invitationsRef = ref(db, 'invitations');
      const snapshot = await get(invitationsRef);
      if (snapshot.exists()) {
        const invites = snapshot.val();
        for (const [id, inv] of Object.entries(invites)) {
          if (inv.from === userId && inv.to === playerId && inv.status === 'pending') {
            setSentInviteId(id);
            return;
          }
        }
      }
      setSentInviteId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const checkPlayerHasPendingInvite = async () => {
    try {
      const invitationsRef = ref(db, 'invitations');
      const snapshot = await get(invitationsRef);
      if (snapshot.exists()) {
        const invites = snapshot.val();
        const hasPending = Object.values(invites).some(
          inv => inv.to === playerId && inv.status === 'pending'
        );
        setHasPendingInvite(hasPending);
      } else {
        setHasPendingInvite(false);
      }
    } catch (error) {
      console.error(error);
      setHasPendingInvite(false);
    }
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'неизвестно';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    return `${days} д назад`;
  };

  const proposeGame = async () => {
    if (playerId === userId) {
      Alert.alert('Ошибка', 'Нельзя отправить приглашение самому себе.');
      return;
    }
    if (playerGameStatus.inGame) {
      Alert.alert('Нельзя отправить приглашение', 'Этот игрок сейчас в игре.');
      return;
    }
    if (hasPendingInvite) {
      Alert.alert('Нельзя отправить приглашение', 'У игрока уже есть приглашение.');
      return;
    }
    if (sentInviteId) {
      Alert.alert('Приглашение уже отправлено', 'Вы уже отправили приглашение.');
      return;
    }

    // Переход на экран выбора режима игры
    navigation.navigate('InviteGameSetup', {
      playerId,
      playerName: playerData?.name || 'Игрок'
    });
  };

  const sendInviteWithGameType = async (gameType) => {
    try {
      const myUserRef = ref(db, `users/${userId}`);
      const mySnapshot = await get(myUserRef);
      const myData = mySnapshot.exists() ? mySnapshot.val() : {};

      // Получаем уровень отправителя
      const { getLevelFromExp } = require('../utils/levelSystem');
      const myLevel = getLevelFromExp(myData.stats?.exp || 0).level;

      // Удаляем старые приглашения между этими игроками
      const invitationsRef = ref(db, 'invitations');
      const snapshot = await get(invitationsRef);
      if (snapshot.exists()) {
        const invites = snapshot.val();
        for (const [id, inv] of Object.entries(invites)) {
          if ((inv.from === userId && inv.to === playerId) ||
              (inv.from === playerId && inv.to === userId)) {
            await remove(ref(db, `invitations/${id}`));
          }
        }
      }

      const newInviteRef = push(ref(db, 'invitations'));
      const inviteData = {
        from: userId,
        to: playerId,
        fromName: myData.name || 'Игрок',
        fromAvatar: myData.avatar || '😀',
        fromLevel: myLevel,
        gameType: gameType,
        status: 'pending',
        createdAt: Date.now(),
        gameId: `private_${userId}_${playerId}_${Date.now()}`,
      };

      await set(newInviteRef, inviteData);

      await sendPushNotification(
        playerId,
        'Приглашение в игру',
        `${myData.name || 'Игрок'} приглашает вас сыграть!`,
        { type: 'game_invite', from: userId, inviteId: newInviteRef.key }
      );

      Alert.alert('Приглашение отправлено', 'Игрок получит уведомление');

      navigation.setParams({ sendInvite: false, selectedGameType: null });
    } catch (err) {
      console.error('❌ Error sending invite:', err);
      Alert.alert('Ошибка', 'Не удалось отправить приглашение');
    }
  };

  const cancelInvite = async () => {
    if (!sentInviteId) return;
    try {
      await remove(ref(db, `invitations/${sentInviteId}`));
      setSentInviteId(null);

      // Принудительно пересоздаём подписку на приглашения
      console.log('🔄 Отменено приглашение, пересоздаём подписку');
      resetInviteFlags();

      Alert.alert('Приглашение отменено', 'Подписка на приглашения обновлена.');
    } catch (err) {
      console.error(err);
      Alert.alert('Ошибка', 'Не удалось отменить приглашение');
    }
  };

  const sendGift = () => {
    Alert.alert('Подарок', 'Функция в разработке.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!playerData) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Игрок не найден</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { name, avatar, stats } = playerData;
  const totalGames = stats?.totalGames || 0;
  const wins = stats?.wins || 0;
  const winRate = totalGames === 0 ? 0 : ((wins / totalGames) * 100).toFixed(1);
  const isOwnProfile = playerId === userId;

  // Определяем текст статуса игры
  let gameStatusText = '';
  if (playerGameStatus.inGame) {
    if (playerGameStatus.gameType === 'pvp') gameStatusText = '🎮 В игре с соперником';
    else if (playerGameStatus.gameType === 'bot') gameStatusText = '🤖 Играет с компьютером';
    else if (playerGameStatus.gameType === 'solo') gameStatusText = '🎯 В одиночной игре';
    else gameStatusText = '🎮 В игре';
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Профиль</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.profileContent}>
        <Text style={styles.avatar}>{avatar}</Text>
        <Text style={styles.name}>{name}</Text>

        {isOwnProfile && (
          <TouchableOpacity
            style={[styles.actionButton, styles.messageButton]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.actionButtonText}>👤 Перейти в профиль</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
          <Text style={styles.statusText}>
            {isOnline ? 'В сети' : `Был(а) ${formatLastSeen(lastSeen)}`}
          </Text>
        </View>

        {playerGameStatus.inGame && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>{gameStatusText}</Text>
          </View>
        )}

        {hasPendingInvite && !playerGameStatus.inGame && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>⏳ Ждёт ответа на приглашение</Text>
          </View>
        )}

        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>📊 Сыграно игр: {totalGames}</Text>
          <Text style={styles.statsText}>🏆 Побед: {wins}</Text>
          <Text style={styles.statsText}>📈 Процент побед: {winRate}%</Text>
        </View>

        <View style={styles.buttonsContainer}>
          {!isOwnProfile && (
            <>
              {sentInviteId ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelInviteButton]}
                  onPress={cancelInvite}
                >
                  <Text style={styles.actionButtonText}>↺ Отменить приглашение</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.inviteButton,
                    (!isOnline || playerGameStatus.inGame || hasPendingInvite) && styles.disabledButton
                  ]}
                  onPress={proposeGame}
                  disabled={!isOnline || playerGameStatus.inGame || hasPendingInvite}
                >
                  <Text style={styles.actionButtonText}>
                    {!isOnline ? '⛔ Игрок офлайн' :
                     playerGameStatus.inGame ? gameStatusText :
                     hasPendingInvite ? '⏳ Есть приглашение' :
                     '🎮 Предложить игру'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity style={[styles.actionButton, styles.giftButton]} onPress={sendGift}>
            <Text style={styles.actionButtonText}>🎁 Отправить подарок</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // ... ваши стили без изменений ...
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  profileContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  avatar: {
    fontSize: 80,
    marginBottom: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  onlineDot: {
    backgroundColor: '#4ECDC4',
  },
  offlineDot: {
    backgroundColor: '#888',
  },
  statusText: {
    fontSize: 14,
    color: '#aaa',
  },
  warningBadge: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  warningText: {
    color: '#f39c12',
    fontSize: 13,
    fontWeight: '600',
  },
  statsContainer: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 30,
  },
  statsText: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: 8,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  inviteButton: {
    backgroundColor: '#4ECDC4',
  },
  cancelInviteButton: {
    backgroundColor: '#e74c3c',
  },
  messageButton: {
    backgroundColor: '#9b59b6',
  },
  giftButton: {
    backgroundColor: '#FF6B6B',
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.textLight,
    fontSize: 18,
    marginBottom: 20,
  },
});

export default PlayerProfileScreen;