import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, Alert, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsProvider } from './src/context/SettingsContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import Constants from 'expo-constants';
import { ref, onValue, off, update, remove, get, set, onDisconnect } from 'firebase/database';
import { db } from './src/firebase/config';
import { initialBoard } from './src/utils/checkersLogic';
import MenuScreen from './src/screens/MenuScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnlineGameSetupScreen from './src/screens/OnlineGameSetupScreen';
import InviteGameSetupScreen from './src/screens/InviteGameSetupScreen';
import FindOpponentScreen from './src/screens/FindOpponentScreen';
import OnlineGameScreen from './src/screens/OnlineGameScreen';
import BotDifficultyScreen from './src/screens/BotDifficultyScreen';
import BotGameScreen from './src/screens/BotGameScreen';
import LocalGameSetupScreen from './src/screens/LocalGameSetupScreen';
import LocalGameScreen from './src/screens/LocalGameScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import PlayersScreen from './src/screens/PlayersScreen';
import PlayerProfileScreen from './src/screens/PlayerProfileScreen';
import { colors } from './src/styles/globalStyles';
import { GameTypeProvider } from './src/context/GameTypeContext';
import GameTypeScreen from './src/screens/GameTypeScreen';
import { InviteProvider } from './src/context/InviteContext';
import ProfileGiftScreen from './src/screens/ProfileGiftScreen';

const Stack = createNativeStackNavigator();

const isExpoGo = Constants.appOwnership === 'expo';

let Notifications = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) { }
}

function AppNavigator() {
  const { userId, loading } = useAuth();
  const navigationRef = useRef(null);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const appState = useRef(AppState.currentState);
  const hasShownAlertFor = useRef(new Set());
  const pendingGameId = useRef(null);
  const processedAccepted = useRef(new Set());
  const wasAcceptedRef = useRef(false);
  const unsubscribeInvitations = useRef(null);
  const currentAlertVisible = useRef(false);
  const currentAlertInvId = useRef(null);
  const resetTimerRef = useRef(null);

  const navigateToGame = useCallback((gameId, playerKey, myRole) => {
    if (!navigationRef.current || !isNavigationReady) {
      pendingGameId.current = { gameId, playerKey, myRole };
      return false;
    }
    try {
      navigationRef.current.navigate('OnlineGame', { gameId, playerKey, myRole });
      pendingGameId.current = null;
      return true;
    } catch (error) {
      console.error('❌ Ошибка навигации:', error);
      pendingGameId.current = { gameId, playerKey, myRole };
      return false;
    }
  }, [isNavigationReady]);

  const createInvitationsSubscription = useCallback(() => {
    if (!userId || !isNavigationReady) {
      console.log('⏳ Невозможно создать подписку: userId или навигация не готовы');
      return;
    }
    if (unsubscribeInvitations.current) {
      console.log('⚠️ Подписка уже существует, пропускаем');
      return;
    }

    console.log(`📡 Создаём подписку на приглашения для userId: ${userId}`);
    hasShownAlertFor.current.clear();
    processedAccepted.current.clear();
    wasAcceptedRef.current = false;
    currentAlertVisible.current = false;
    currentAlertInvId.current = null;

    const invitationsRef = ref(db, 'invitations');
    const handler = async (snapshot) => {
      console.log('🔥 Обработчик приглашений сработал!');
      const data = snapshot.val();
      if (!data) {
        console.log('📭 invitations пуст');
        if (currentAlertVisible.current && currentAlertInvId.current && !wasAcceptedRef.current) {
          Alert.alert('Приглашение отменено', 'Игрок отменил приглашение.', [{ text: 'OK' }]);
        }
        currentAlertVisible.current = false;
        currentAlertInvId.current = null;
        wasAcceptedRef.current = false;
        return;
      }

      console.log('📨 Всего приглашений:', Object.keys(data).length);
      console.log('📨 Мой userId:', userId);
      for (const [invId, invData] of Object.entries(data)) {
        console.log(`📋 Проверка приглашения ${invId}: from=${invData.from}, to=${invData.to}, status=${invData.status}, gameType=${invData.gameType}, myUserId=${userId}`);

        // 1. Входящее приглашение (получатель)
        if (invData.to === userId && invData.status === 'pending') {
          console.log('✅ Найдено входящее приглашение!');
          if (!currentAlertVisible.current && !hasShownAlertFor.current.has(invId)) {
            hasShownAlertFor.current.add(invId);
            currentAlertVisible.current = true;
            currentAlertInvId.current = invId;

            const gameTypeName = invData.gameType === 'giveaway' ? 'Поддавки' : 'Русские шашки';
            const gameTypeEmoji = invData.gameType === 'giveaway' ? '🎯' : '♟️';

            console.log('🔔 Показываем Alert пользователю...');
            Alert.alert(
              'Приглашение в игру',
              `${invData.fromName || 'Игрок'} приглашает вас сыграть!\n\n${gameTypeEmoji} Режим: ${gameTypeName}`,
              [
                {
                  text: 'Отказаться',
                  style: 'cancel',
                  onPress: async () => {
                    console.log(`❌ Отказ от приглашения ${invId}`);
                    await remove(ref(db, `invitations/${invId}`));
                    currentAlertVisible.current = false;
                    currentAlertInvId.current = null;
                    hasShownAlertFor.current.delete(invId);
                  }
                },
                {
                  text: 'Принять',
                  onPress: async () => {
                    console.log(`✅ Принятие приглашения ${invId}`);
                    wasAcceptedRef.current = true;
                    const checkRef = ref(db, `invitations/${invId}`);
                    const checkSnap = await get(checkRef);
                    if (!checkSnap.exists() || checkSnap.val().status !== 'pending') {
                      console.log('❌ Приглашение больше не активно!');
                      Alert.alert('Ошибка', 'Приглашение было отменено.', [{ text: 'OK' }]);
                      currentAlertVisible.current = false;
                      currentAlertInvId.current = null;
                      hasShownAlertFor.current.delete(invId);
                      return;
                    }
                    const gameId = invData.gameId || `invite_${invData.from}_${userId}_${Date.now()}`;
                    const gameRef = ref(db, 'games_checkers/' + gameId);
                    await set(gameRef, {
                      players: { [invData.from]: 1, [userId]: 2 },
                      board: initialBoard(),
                      turn: invData.from,
                      currentPlayer: invData.from,
                      status: 'active',
                      gameType: invData.gameType || 'russian',
                      createdAt: Date.now(),
                    });
                    console.log('🎮 Игра создана:', gameId);
                    await update(ref(db, `invitations/${invId}`), { status: 'accepted', gameId });
                    console.log('📝 Статус обновлён на accepted');
                    await remove(ref(db, `invitations/${invId}`));
                    console.log('🗑️ Приглашение удалено');
                    currentAlertVisible.current = false;
                    currentAlertInvId.current = null;
                    hasShownAlertFor.current.delete(invId);
                    navigateToGame(gameId, userId, 2);
                  }
                }
              ],
              { cancelable: false, onDismiss: () => {
                console.log('⚠️ Alert закрыт без нажатия кнопки');
                currentAlertVisible.current = false;
                currentAlertInvId.current = null;
                hasShownAlertFor.current.delete(invId);
              }}
            );
          } else {
            console.log('⚠️ Alert уже показан или обработан');
          }
        }

        // 2. Моё приглашение принято (отправитель)
        if (invData.from === userId && invData.status === 'accepted' && invData.gameId) {
          if (processedAccepted.current.has(invId)) {
            console.log('⚠️ Это accepted уже обработано');
            continue;
          }
          processedAccepted.current.add(invId);
          console.log('✅ МОЁ ПРИГЛАШЕНИЕ ПРИНЯТО!');
          const gameCheckRef = ref(db, `games_checkers/${invData.gameId}`);
          const gameCheckSnap = await get(gameCheckRef);
          if (!gameCheckSnap.exists()) {
            console.log('❌ Игра не найдена, создаём заново...');
            const gameRef = ref(db, `games_checkers/${invData.gameId}`);
            await set(gameRef, {
              players: { [userId]: 1, [invData.to]: 2 },
              board: initialBoard(),
              turn: userId,
              currentPlayer: userId,
              status: 'active',
              gameType: invData.gameType || 'russian',
              createdAt: Date.now(),
            });
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          const navigated = navigateToGame(invData.gameId, userId, 1);
          if (!navigated) {
            console.log('⏳ Навигация не удалась, сохраняем в pendingGameId');
          }
        }
      }
    };

    const unsubscribe = onValue(invitationsRef, handler);
    unsubscribeInvitations.current = unsubscribe;
  }, [userId, isNavigationReady, navigateToGame]);

  const resetInviteFlags = useCallback(() => {
    console.log('🧹 Сброс флагов приглашений и пересоздание подписки');
    console.log('📊 Текущее состояние:', {
      hasShownAlertFor: Array.from(hasShownAlertFor.current),
      processedAccepted: Array.from(processedAccepted.current),
      currentAlertVisible: currentAlertVisible.current,
      currentAlertInvId: currentAlertInvId.current
    });

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (unsubscribeInvitations.current) {
      console.log('📡 Удаляем старую подписку');
      unsubscribeInvitations.current();
      unsubscribeInvitations.current = null;
    }
    resetTimerRef.current = setTimeout(() => {
      console.log('🔄 Пересоздаём подписку на приглашения');
      createInvitationsSubscription();
      resetTimerRef.current = null;
    }, 1000);
  }, [createInvitationsSubscription]);

  // Создаём подписку при готовности
  useEffect(() => {
    createInvitationsSubscription();
    return () => {
      if (unsubscribeInvitations.current) unsubscribeInvitations.current();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [createInvitationsSubscription]);

  // Отслеживание онлайн-статуса (без изменений)
  useEffect(() => {
    if (!userId) return;
    const statusRef = ref(db, `status/${userId}`);
    const connectedRef = ref(db, '.info/connected');
    const updateOnlineStatus = (isOnline) => {
      set(statusRef, { online: isOnline, lastSeen: Date.now() });
    };
    const connectedUnsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val()) {
        updateOnlineStatus(true);
        onDisconnect(statusRef).update({ online: false, lastSeen: Date.now() });
      }
    });
    const handleAppStateChange = (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        updateOnlineStatus(true);
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        updateOnlineStatus(false);
      }
      appState.current = nextAppState;
    };
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      connectedUnsubscribe();
      appStateSubscription.remove();
      updateOnlineStatus(false);
    };
  }, [userId]);

  // Обработчик уведомлений
  useEffect(() => {
    if (isExpoGo || !Notifications || !userId) return;
    const timer = setTimeout(() => registerForPushNotificationsAsync(userId), 1000);
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      if (response.notification.request.content.data?.type === 'new_message' && navigationRef.current) {
        navigationRef.current.navigate('Chat');
      }
    });
    return () => {
      clearTimeout(timer);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, [userId]);

  // AppState handler (возврат из фона)
  useEffect(() => {
    if (!userId || !isNavigationReady) return;
    const handleAppStateChange = async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 Приложение вернулось из фона!');
        resetInviteFlags();
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (pendingGameId.current) {
          const { gameId, playerKey, myRole } = pendingGameId.current;
          navigateToGame(gameId, playerKey, myRole);
          return;
        }
        const invitationsRef = ref(db, 'invitations');
        const invSnapshot = await get(invitationsRef);
        if (invSnapshot.exists()) {
          const data = invSnapshot.val();
          for (const [invId, invData] of Object.entries(data)) {
            if (invData.from === userId && invData.status === 'accepted' && invData.gameId) {
              navigateToGame(invData.gameId, userId, 1);
              remove(ref(db, `invitations/${invId}`)).catch(console.error);
              return;
            }
          }
        }
        const gamesRef = ref(db, 'games_checkers');
        const gamesSnapshot = await get(gamesRef);
        if (gamesSnapshot.exists()) {
          const games = gamesSnapshot.val();
          for (const [gameId, game] of Object.entries(games)) {
            if (game.status === 'active' && game.players && game.players[userId]) {
              const myRole = game.players[userId];
              navigateToGame(gameId, userId, myRole);
              return;
            }
          }
        }
        console.log('❌ Активных игр не найдено');
      }
      appState.current = nextAppState;
    };
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    return () => appStateSubscription.remove();
  }, [userId, isNavigationReady, navigateToGame, resetInviteFlags]);

  // Очистка старых игр
  useEffect(() => {
    if (!userId || !isNavigationReady) return;
    const cleanupOldGames = async () => {
      console.log('🧹 Запуск очистки старых игр...');
      const gamesRef = ref(db, 'games_checkers');
      const snapshot = await get(gamesRef);
      if (!snapshot.exists()) return;
      const games = snapshot.val();
      let deletedCount = 0;
      for (const [gameId, game] of Object.entries(games)) {
        const isFinished = game.status !== 'active';
        const isOld = game.createdAt && (Date.now() - game.createdAt > 3600000);
        if (isFinished || isOld) {
          await remove(ref(db, `games_checkers/${gameId}`));
          deletedCount++;
          console.log(`🗑️ Удалена игра ${gameId}`);
        }
      }
      console.log(`✅ Удалено ${deletedCount} старых игр`);
    };
    cleanupOldGames();
    const cleanupInterval = setInterval(cleanupOldGames, 300000);
    return () => clearInterval(cleanupInterval);
  }, [userId, isNavigationReady]);

  if (loading) return null;

  return (
    <InviteProvider resetInviteFlags={resetInviteFlags}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} translucent={true} />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          setIsNavigationReady(true);
          console.log('🚀 Navigation is ready');
          if (pendingGameId.current) {
            setTimeout(() => {
              const { gameId, playerKey, myRole } = pendingGameId.current;
              navigateToGame(gameId, playerKey, myRole);
            }, 500);
          }
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            freezeOnBlur: true,
            detachInactiveScreens: false,
            animation: 'fade'
          }}
        >
          {!userId ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Menu" component={MenuScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="OnlineGameSetup" component={OnlineGameSetupScreen} />
              <Stack.Screen name="FindOpponent" component={FindOpponentScreen} />
              <Stack.Screen name="OnlineGame" component={OnlineGameScreen} />
              <Stack.Screen name="BotDifficulty" component={BotDifficultyScreen} />
              <Stack.Screen name="BotGame" component={BotGameScreen} />
              <Stack.Screen name="LocalGameSetup" component={LocalGameSetupScreen} />
              <Stack.Screen name="LocalGame" component={LocalGameScreen} />
              <Stack.Screen name="GameType" component={GameTypeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
              <Stack.Screen name="Players" component={PlayersScreen} />
              <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
              <Stack.Screen name="InviteGameSetup" component={InviteGameSetupScreen} />
              <Stack.Screen name="GiftScreen" component={ProfileGiftScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </InviteProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <GameTypeProvider>
          <AppNavigator />
        </GameTypeProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}