// src/screens/PlayersScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, get, onValue, off } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';  // ← ← ← Импортируем useAuth

const PlayersScreen = ({ navigation }) => {
  const { userId } = useAuth();  // ← ← ← Получаем текущий userId
  const insets = useSafeAreaInsets();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState({});
  const [pvpGames, setPvpGames] = useState({});
  const [botGames, setBotGames] = useState({});

  // ← Загружаем список всех пользователей (исключая текущего)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const userList = Object.keys(data)
            .filter(key => key !== userId)
            .map(key => ({
              id: key,
              ...data[key],
            }));
          setPlayers(userList);
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки пользователей:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [userId]);

  // ← Подписываемся на онлайн-статусы
  useEffect(() => {
    const statusRef = ref(db, 'status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatuses(data);
      } else {
        setStatuses({});
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      off(statusRef);
    };
  }, []);

  // ← Подписываемся на игры PvP (с проверкой status === 'active' И время создания)
  useEffect(() => {
    const gamesRef = ref(db, 'games_checkers');

    const handleGamesUpdate = (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const activeGames = {};
        const now = Date.now();

        for (const [gameId, game] of Object.entries(data)) {
          const isRecent = game.createdAt && (now - game.createdAt < 600000);

          if (game && game.status === 'active' && game.players && isRecent) {
            activeGames[gameId] = game;
          }
        }
        setPvpGames(activeGames);
      } else {
        setPvpGames({});
      }
    };

    const unsubscribe = onValue(gamesRef, handleGamesUpdate);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      off(gamesRef);
    };
  }, []);

  // ← Подписываемся на игры с ботом (с проверкой status === 'active' И время создания)
  useEffect(() => {
    const botGamesRef = ref(db, 'bot_games');

    const handleBotGamesUpdate = (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const activeBotGames = {};
        const now = Date.now();

        for (const [gameId, game] of Object.entries(data)) {
          const isRecent = game.startedAt && (now - game.startedAt < 600000);

          if (game && game.status === 'active' && game.playerId && isRecent) {
            activeBotGames[gameId] = game;
          }
        }
        setBotGames(activeBotGames);
      } else {
        setBotGames({});
      }
    };

    const unsubscribe = onValue(botGamesRef, handleBotGamesUpdate);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      off(botGamesRef);
    };
  }, []);

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

  // ← ← ← Проверка: игрок в активной PvP игре
  const isInPvpGame = (playerId) => {
    if (!playerId) return false;
    for (const game of Object.values(pvpGames)) {
      if (game && game.players && typeof game.players === 'object') {
        if (game.players[playerId] === 1 || game.players[playerId] === 2) {
          return true;
        }
      }
    }
    return false;
  };

  // ← ← ← Проверка: игрок в активной игре с ботом
  const isInBotGame = (playerId) => {
    if (!playerId) return false;
    for (const game of Object.values(botGames)) {
      if (game && game.playerId === playerId) {
        return true;
      }
    }
    return false;
  };

  // ← Получаем текст статуса игры
  const getGameStatusText = (playerId) => {
    if (!playerId) return null;
    if (isInPvpGame(playerId)) return '🎮 Играет против игрока';
    if (isInBotGame(playerId)) return '🤖 Играет против компьютера';
    return null;
  };

  // ← Сортировка: онлайн сначала, потом по времени последнего входа
  const sortPlayers = (playersList, statusesData) => {
    return [...playersList].sort((a, b) => {
      const statusA = statusesData?.[a.id];
      const statusB = statusesData?.[b.id];
      const onlineA = statusA?.online === true;
      const onlineB = statusB?.online === true;
      
      if (onlineA && !onlineB) return -1;
      if (!onlineA && onlineB) return 1;
      
      const lastSeenA = statusA?.lastSeen || 0;
      const lastSeenB = statusB?.lastSeen || 0;
      return lastSeenB - lastSeenA;
    });
  };

  const sortedPlayers = sortPlayers(players, statuses);

  const showPlayerStats = (player) => {
    const totalGames = player?.stats?.totalGames || 0;
    const wins = player?.stats?.wins || 0;
    const winRate = totalGames === 0 ? 0 : ((wins / totalGames) * 100).toFixed(1);
    Alert.alert(
      player?.name || 'Игрок',
      `Сыграно игр: ${totalGames}\nПобед: ${wins}\nПроцент побед: ${winRate}%`,
      [{ text: 'OK' }]
    );
  };

  const renderPlayer = ({ item }) => {
    const status = statuses?.[item.id];
    const isOnline = status?.online === true;
    const lastSeen = status?.lastSeen;
    const gameStatusText = getGameStatusText(item.id);

    return (
      <TouchableOpacity 
        style={styles.playerItem} 
        onPress={() => navigation.navigate('PlayerProfile', { playerId: item.id })}
        onLongPress={() => showPlayerStats(item)}
      >
        <View style={styles.playerInfo}>
          <Text style={styles.avatar}>{item?.avatar || '😀'}</Text>
          <View style={styles.playerDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item?.name || 'Неизвестный'}</Text>
            </View>
            
            {/* ← Показываем статус игры если есть */}
            {gameStatusText ? (
              <View style={styles.gameStatusContainer}>
                <Text style={styles.gameStatusText}>{gameStatusText}</Text>
              </View>
            ) : (
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
                <Text style={styles.statusText}>
                  {isOnline ? 'В сети' : `был(а) ${formatLastSeen(lastSeen)}`}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (sortedPlayers.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Игроки не найдены</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Игроки</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={sortedPlayers}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        renderItem={renderPlayer}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Нет других игроков</Text>
        }
      />
    </View>
  );
};


// ← ← ← СТИЛИ (оставьте ваши существующие стили)

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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2c3e50',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    fontSize: 32,
    marginRight: 12,
  },
  playerDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  // ← Новый стиль для статуса игры
  gameStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  gameStatusText: {
    fontSize: 12,
    color: '#f39c12',
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  onlineDot: {
    backgroundColor: '#4ECDC4',
  },
  offlineDot: {
    backgroundColor: '#888',
  },
  statusText: {
    fontSize: 12,
    color: '#aaa',
  },
  arrow: {
    fontSize: 18,
    color: colors.textLight,
    marginLeft: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default PlayersScreen;