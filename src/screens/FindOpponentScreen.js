import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, push, onValue, off, set, remove, query, orderByChild, equalTo, get, runTransaction } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { initialBoard } from '../utils/checkersLogic';
import { useInvite } from '../context/InviteContext';
import { useGameType } from '../context/GameTypeContext';
import { generateRandomBotName, generateRandomLevel, generateRandomAvatar } from '../utils/botNames';

const FindOpponentScreen = ({ navigation }) => {
  const [status, setStatus] = useState('Поиск соперника...');
  const { gameType } = useGameType();
  const waitingRef = useRef(null);
  const currentPlayerKey = useRef(null);
  const creationInProgress = useRef(false);
  const timeoutId = useRef(null);
  const isMounted = useRef(true);
  const userIdRef = useRef(null);
  const gameCreatedRef = useRef(false);
  const waitingUnsubscribeRef = useRef(null);
  const gamesUnsubscribeRef = useRef(null);
  const { resetInviteFlags } = useInvite();

  useFocusEffect(
    React.useCallback(() => {
      isMounted.current = true;
      gameCreatedRef.current = false;
      const onBackPress = () => {
        Alert.alert(
          'Выйти из поиска',
          'Вы уверены, что хотите отменить поиск соперника?',
          [
            { text: 'Отмена', style: 'cancel', onPress: () => {} },
            {
              text: 'Выйти',
              style: 'destructive',
              onPress: () => {
                isMounted.current = false;
                if (currentPlayerKey.current) {
                  remove(ref(db, 'waiting_checkers/' + currentPlayerKey.current));
                }
                if (timeoutId.current) clearTimeout(timeoutId.current);
                navigation.goBack();
              },
            },
          ]
        );
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => {
        subscription.remove();
        isMounted.current = false;
      };
    }, [navigation])
  );

  useEffect(() => {
    isMounted.current = true;
    gameCreatedRef.current = false;

    const init = async () => {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        navigation.replace('Register');
        return;
      }
      userIdRef.current = userId;

      // Удаляем старые записи
      const waitingRefGlobal = ref(db, 'waiting_checkers');
      const userQuery = query(waitingRefGlobal, orderByChild('userId'), equalTo(userId));
      const snapshot = await get(userQuery);
      if (snapshot.exists()) {
        const oldKeys = Object.keys(snapshot.val());
        for (let key of oldKeys) {
          await remove(ref(db, `waiting_checkers/${key}`));
        }
      }

      // Добавляем себя в очередь
      waitingRef.current = ref(db, 'waiting_checkers');
      const newPlayerRef = push(waitingRef.current);
      const key = newPlayerRef.key;
      currentPlayerKey.current = key;
      await set(newPlayerRef, { userId, timestamp: Date.now(), gameType: gameType || 'russian' });
      console.log('✅ Заявка создана в waiting_checkers:', key, 'режим:', gameType);

      // ---------- 1. Слушаем waiting_checkers ----------
      const handleWaiting = (snapshot) => {
        if (!isMounted.current || creationInProgress.current || gameCreatedRef.current) return;
        const waiting = snapshot.val();
        if (!waiting) return;
        const entries = Object.entries(waiting);
        if (entries.length >= 2) {
          // Ищем первую пару с одинаковым gameType
          for (let i = 0; i < entries.length - 1; i++) {
            const [key1, data1] = entries[i];
            for (let j = i + 1; j < entries.length; j++) {
              const [key2, data2] = entries[j];

              // Проверяем: разные пользователи И одинаковый режим игры
              if (data1.userId !== data2.userId &&
                  (data1.gameType || 'russian') === (data2.gameType || 'russian')) {

                // Удаляем заявки немедленно
                remove(ref(db, 'waiting_checkers/' + key1));
                remove(ref(db, 'waiting_checkers/' + key2));
                console.log('🗑️ Заявки удалены из очереди:', key1, key2);

                const gameId = `checkers_${key1}_${key2}`;
                const gameRef = ref(db, 'games_checkers/' + gameId);
                creationInProgress.current = true;
                runTransaction(gameRef, (currentData) => {
                  if (currentData !== null) return undefined;
                  return {
                    players: { [data1.userId]: 1, [data2.userId]: 2 },
                    board: initialBoard(),
                    turn: data1.userId,
                    currentPlayer: data1.userId,
                    status: 'active',
                    gameType: data1.gameType || 'russian',
                    createdAt: Date.now(),
                  };
                }).then((result) => {
                  if (result.committed && isMounted.current) {
                    gameCreatedRef.current = true;
                    const myUserId = userIdRef.current;
                    const myRole = data1.userId === myUserId ? 1 : 2;
                    console.log('🚀 Переход в игру:', { gameId, myRole, gameType: data1.gameType });
                    if (timeoutId.current) clearTimeout(timeoutId.current);
                    navigation.replace('OnlineGame', { gameId, playerKey: myUserId, myRole });
                  }
                  creationInProgress.current = false;
                }).catch((error) => {
                  console.error('❌ Ошибка транзакции:', error);
                  creationInProgress.current = false;
                });
                return; // Выходим после создания игры
              }
            }
          }
        }
      };

      waitingUnsubscribeRef.current = onValue(waitingRef.current, handleWaiting);

      // ---------- 2. Слушаем games_checkers ----------
      const gamesRef = ref(db, 'games_checkers');
      const handleGames = (snapshot) => {
        if (gameCreatedRef.current || !isMounted.current) return;
        const games = snapshot.val();
        if (!games) return;
        const myUserId = userIdRef.current;
        for (const [gid, game] of Object.entries(games)) {
          if (game.players && game.players[myUserId] && game.status === 'active') {
            console.log('✅ Найдена активная игра в games_checkers:', gid);
            gameCreatedRef.current = true;
            if (currentPlayerKey.current) {
              remove(ref(db, 'waiting_checkers/' + currentPlayerKey.current));
              console.log('🗑️ Удалена заявка из waiting_checkers:', currentPlayerKey.current);
            }
            if (timeoutId.current) clearTimeout(timeoutId.current);
            const myRole = game.players[myUserId];
            navigation.replace('OnlineGame', { gameId: gid, playerKey: myUserId, myRole });
            return;
          }
        }
      };
      gamesUnsubscribeRef.current = onValue(gamesRef, handleGames);

      timeoutId.current = setTimeout(() => {
        if (isMounted.current && !gameCreatedRef.current) {
          console.log('⏰ Таймаут поиска - начинаем игру с ботом');
          if (currentPlayerKey.current) {
            remove(ref(db, 'waiting_checkers/' + currentPlayerKey.current));
          }
          gameCreatedRef.current = true;

          // Генерируем случайное имя, уровень и аватарку для бота
          const botName = generateRandomBotName();
          const botLevel = generateRandomLevel();
          const botAvatar = generateRandomAvatar();

          console.log('🤖 Создаём игру с ботом:', { botName, botLevel, botAvatar });

          // Переходим на экран игры с ботом, передавая имя, уровень и аватарку
          navigation.replace('BotGame', {
            difficulty: 'grandmaster',
            botName: botName,
            botLevel: botLevel,
            botAvatar: botAvatar,
            isFakeOpponent: true
          });
        }
      }, 25000);

      return () => {
        isMounted.current = false;
        if (waitingUnsubscribeRef.current) {
          off(waitingRef.current, 'value', waitingUnsubscribeRef.current);
        }
        if (gamesUnsubscribeRef.current) {
          off(gamesRef, 'value', gamesUnsubscribeRef.current);
        }
        if (timeoutId.current) clearTimeout(timeoutId.current);
        if (currentPlayerKey.current) {
          remove(ref(db, 'waiting_checkers/' + currentPlayerKey.current));
        }
      };
    };

    init();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textLight,
    fontSize: 18,
    marginBottom: 20,
  },
});

export default FindOpponentScreen;