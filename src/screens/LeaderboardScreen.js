import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { ref, get, onValue, off } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { getLevelFromExp } from '../utils/levelSystem';

const LeaderboardScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const userList = Object.keys(data).map(key => ({
            id: key,
            ...data[key],
            stats: data[key].stats || { totalGames: 0, wins: 0, exp: 0 },
            level: getLevelFromExp(data[key].stats?.exp || 0).level,
          }));
          // Сортировка по уровню (опыту)
          userList.sort((a, b) => {
            const expA = a.stats.exp || 0;
            const expB = b.stats.exp || 0;
            return expB - expA;
          });
          setUsers(userList);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadLeaderboard();
  }, []);

  // Подписка на онлайн-статусы
  useEffect(() => {
    const statusRef = ref(db, 'status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        const online = Object.entries(data)
          .filter(([id, status]) => {
            const isOnline = status.online === true;
            const isRecent = status.lastSeen && (now - status.lastSeen < 300000); // 5 минут
            return isOnline && isRecent;
          })
          .map(([id]) => id);
        setOnlineUsers(online);
      } else {
        setOnlineUsers([]);
      }
    });
    return () => off(statusRef);
  }, []);

  const showPlayerStats = (user) => {
    const totalGames = user.stats?.totalGames || 0;
    const wins = user.stats?.wins || 0;
    const winRate = totalGames === 0 ? 0 : ((wins / totalGames) * 100).toFixed(1);
    Alert.alert(
      user.name,
      `Сыграно игр: ${totalGames}\nПобед: ${wins}\nПроцент побед: ${winRate}%`,
      [{ text: 'OK' }]
    );
  };

  const renderItem = ({ item, index }) => {
    const level = item.level || 1;
    const isOnline = onlineUsers.includes(item.id);
    return (
      <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('PlayerProfile', { playerId: item.id })}>
        <Text style={styles.rank}>{index + 1}</Text>
        <Text style={styles.avatar}>{item.avatar}</Text>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{item.name}</Text>
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>
        <Text style={styles.rate}>Ур. {level}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏆 Рейтинг игроков</Text>
      <FlatList
        data={users}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Menu')}>
          <Text style={styles.buttonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  rank: {
    width: 40,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
  },
  avatar: {
    fontSize: 28,
    marginHorizontal: 10,
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    color: colors.textLight,
    marginRight: 8,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ECDC4',
  },
  rate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textLight,
    width: 60,
    textAlign: 'right',
  },
  buttonContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LeaderboardScreen;