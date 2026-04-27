import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert, BackHandler, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, push, onValue, off, set, remove, query, orderByChild, equalTo, get, runTransaction } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { initialBoard } from '../utils/checkersLogic';
import { useInvite } from '../context/InviteContext';
import { useGameType } from '../context/GameTypeContext';
import { generateRandomBotName, generateRandomLevel, generateRandomAvatar } from '../utils/botNames';

// 30 интересных фактов про шашки
const CHECKERS_FACTS = [
  'Шашки — одна из древнейших игр в мире, им более 5000 лет!',
  'В Древнем Египте играли в игру, похожую на шашки.',
  'Первый чемпионат мира по шашкам прошёл в 1894 году.',
  'Существует более 20 различных видов шашек по всему миру.',
  'В русских шашках дамка может ходить на любое расстояние.',
  'Самая длинная партия в шашки длилась более 7 часов!',
  'В поддавки нужно отдать все свои фигуры — полная противоположность.',
  'Шашки развивают логическое мышление и стратегическое планирование.',
  'В некоторых странах шашки называют "дамками".',
  'Компьютерная программа Chinook стала чемпионом мира в 1994 году.',
  'В шашках возможно более 500 миллиардов различных позиций!',
  'Шашки были популярны среди древних римлян и греков.',
  'Дамка в шашках появилась в средневековой Европе.',
  'В бразильских шашках играют на доске 8×8, но с другими правилами.',
  'Шашки помогают улучшить концентрацию и память.',
  'Первая книга о шашках была написана в 1547 году в Испании.',
  'В международных шашках используется доска 10×10 клеток.',
  'Шашки были включены в программу Всемирных интеллектуальных игр.',
  'В России шашки особенно популярны с XVIII века.',
  'Дамка может "съесть" несколько фигур за один ход.',
  'Шашки тренируют способность просчитывать ходы наперёд.',
  'В некоторых вариантах шашек можно ходить назад обычными фигурами.',
  'Шашки — официальный вид спорта во многих странах.',
  'Существуют шашки-64 и шашки-100 (по количеству клеток).',
  'В шашках нет ничьей по соглашению — только по правилам.',
  'Самый молодой чемпион мира по шашкам стал им в 18 лет.',
  'Шашки развивают терпение и умение принимать решения.',
  'В Турции популярен вариант шашек, где фигуры ходят вперёд и в стороны.',
  'Шашки упоминаются в произведениях Пушкина и Толстого.',
  'Профессиональные шашисты могут просчитать до 20 ходов вперёд!',
];

const FindOpponentScreen = ({ navigation }) => {
  const [status, setStatus] = useState('Поиск соперника...');
  const [currentFact, setCurrentFact] = useState('');
  const [factRated, setFactRated] = useState(false);
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

  // Выбираем случайный факт при монтировании
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * CHECKERS_FACTS.length);
    setCurrentFact(CHECKERS_FACTS[randomIndex]);
    setFactRated(false);
  }, []);

  const handleFactRating = (isLike) => {
    setFactRated(true);
    // Здесь можно добавить отправку оценки в Firebase для аналитики
  };

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
            gameCreatedRef.current = true;
            if (currentPlayerKey.current) {
              remove(ref(db, 'waiting_checkers/' + currentPlayerKey.current));
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
          if (currentPlayerKey.current) {
            remove(ref(db, 'waiting_checkers/' + currentPlayerKey.current));
          }
          gameCreatedRef.current = true;

          // Генерируем случайное имя, уровень и аватарку для бота
          const botName = generateRandomBotName();
          const botLevel = generateRandomLevel();
          const botAvatar = generateRandomAvatar();

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

      {/* Интересный факт */}
      <View style={styles.factContainer}>
        <Text style={styles.factTitle}>💡 Интересный факт:</Text>
        <Text style={styles.factText}>{currentFact}</Text>

        {/* Кнопки оценки */}
        {!factRated ? (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingQuestion}>Понравился факт?</Text>
            <View style={styles.ratingButtons}>
              <TouchableOpacity
                style={styles.ratingButton}
                onPress={() => handleFactRating(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.ratingButtonText}>👍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ratingButton}
                onPress={() => handleFactRating(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.ratingButtonText}>👎</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.thanksContainer}>
            <Text style={styles.thanksText}>✨ Спасибо за оценку!</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: colors.textLight,
    fontSize: 18,
    marginBottom: 20,
  },
  factContainer: {
    marginTop: 40,
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 20,
    maxWidth: '90%',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  factTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  factText: {
    color: colors.textLight,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  ratingContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  ratingQuestion: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 8,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  ratingButton: {
    backgroundColor: '#34495e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingButtonText: {
    fontSize: 24,
  },
  thanksContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  thanksText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FindOpponentScreen;