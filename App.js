import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, Alert, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsProvider } from './src/context/SettingsContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import { initSounds } from './src/utils/soundManager';
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
import DailyTasksScreen from './src/screens/DailyTasksScreen';
import { colors } from './src/styles/globalStyles';
import { GameTypeProvider } from './src/context/GameTypeContext';
import GameTypeScreen from './src/screens/GameTypeScreen';
import { InviteProvider } from './src/context/InviteContext';
import { DailyTasksProvider, useDailyTasks } from './src/context/DailyTasksContext';
import ProfileGiftScreen from './src/screens/ProfileGiftScreen';
import InviteModal from './src/screens/InviteModal';
import TaskCompletedModal from './src/components/TaskCompletedModal';

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
  const { newlyCompletedTask, clearCompletedTask } = useDailyTasks();
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
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [currentInvite, setCurrentInvite] = useState(null);

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
      return;
    }
    if (unsubscribeInvitations.current) {
      return;
    }

    hasShownAlertFor.current.clear();
    processedAccepted.current.clear();
    wasAcceptedRef.current = false;
    currentAlertVisible.current = false;
    currentAlertInvId.current = null;

    const invitationsRef = ref(db, 'invitations');
    const handler = async (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        if (currentAlertVisible.current && currentAlertInvId.current && !wasAcceptedRef.current) {
          Alert.alert('Приглашение отменено', 'Игрок отменил приглашение.', [{ text: 'OK' }]);
        }
        currentAlertVisible.current = false;
        currentAlertInvId.current = null;
        wasAcceptedRef.current = false;
        return;
      }

      for (const [invId, invData] of Object.entries(data)) {

        // 1. Входящее приглашение (получатель)
        if (invData.to === userId && invData.status === 'pending') {
          if (!currentAlertVisible.current && !hasShownAlertFor.current.has(invId)) {
            hasShownAlertFor.current.add(invId);
            currentAlertVisible.current = true;
            currentAlertInvId.current = invId;

            setCurrentInvite({
              invId,
              fromName: invData.fromName,
              fromAvatar: invData.fromAvatar,
              fromLevel: invData.fromLevel,
              gameType: invData.gameType,
              from: invData.from,
            });
            setInviteModalVisible(true);
          }
        }

        // 2. Моё приглашение принято (отправитель)
        if (invData.from === userId && invData.status === 'accepted' && invData.gameId) {
          if (processedAccepted.current.has(invId)) {
            continue;
          }
          processedAccepted.current.add(invId);
          const gameCheckRef = ref(db, `games_checkers/${invData.gameId}`);
          const gameCheckSnap = await get(gameCheckRef);
          if (!gameCheckSnap.exists()) {
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
        }
      }
    };

    const unsubscribe = onValue(invitationsRef, handler);
    unsubscribeInvitations.current = unsubscribe;
  }, [userId, isNavigationReady, navigateToGame]);

  const resetInviteFlags = useCallback(() => {
    // Очищаем все флаги
    hasShownAlertFor.current.clear();
    processedAccepted.current.clear();
    currentAlertVisible.current = false;
    currentAlertInvId.current = null;
    wasAcceptedRef.current = false;
    setInviteModalVisible(false);
    setCurrentInvite(null);

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (unsubscribeInvitations.current) {
      unsubscribeInvitations.current();
      unsubscribeInvitations.current = null;
    }
    resetTimerRef.current = setTimeout(() => {
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

  // Отслеживание онлайн-статуса
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
    return () => {
      connectedUnsubscribe();
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

  // AppState handler (возврат из фона + онлайн статус)
  useEffect(() => {
    if (!userId || !isNavigationReady) return;

    const statusRef = ref(db, `status/${userId}`);
    const updateOnlineStatus = (isOnline) => {
      set(statusRef, { online: isOnline, lastSeen: Date.now() });
    };

    const handleAppStateChange = async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Устанавливаем онлайн при возврате
        updateOnlineStatus(true);

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
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // Устанавливаем офлайн при уходе в фон
        updateOnlineStatus(false);
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
        }
      }
    };
    cleanupOldGames();
    const cleanupInterval = setInterval(cleanupOldGames, 300000);
    return () => clearInterval(cleanupInterval);
  }, [userId, isNavigationReady]);

  if (loading) return null;

  const handleAcceptInvite = async () => {
    if (!currentInvite) return;

    wasAcceptedRef.current = true;
    const checkRef = ref(db, `invitations/${currentInvite.invId}`);
    const checkSnap = await get(checkRef);

    if (!checkSnap.exists() || checkSnap.val().status !== 'pending') {
      Alert.alert('Ошибка', 'Приглашение было отменено.', [{ text: 'OK' }]);
      setInviteModalVisible(false);
      setCurrentInvite(null);
      currentAlertVisible.current = false;
      currentAlertInvId.current = null;
      hasShownAlertFor.current.delete(currentInvite.invId);
      return;
    }

    const gameId = checkSnap.val().gameId || `invite_${currentInvite.from}_${userId}_${Date.now()}`;
    const gameRef = ref(db, 'games_checkers/' + gameId);

    await set(gameRef, {
      players: { [currentInvite.from]: 1, [userId]: 2 },
      board: initialBoard(),
      turn: currentInvite.from,
      currentPlayer: currentInvite.from,
      status: 'active',
      gameType: currentInvite.gameType || 'russian',
      createdAt: Date.now(),
    });

    await update(ref(db, `invitations/${currentInvite.invId}`), { status: 'accepted', gameId });
    await remove(ref(db, `invitations/${currentInvite.invId}`));

    setInviteModalVisible(false);
    setCurrentInvite(null);
    currentAlertVisible.current = false;
    currentAlertInvId.current = null;
    hasShownAlertFor.current.delete(currentInvite.invId);

    navigateToGame(gameId, userId, 2);
  };

  const handleDeclineInvite = async () => {
    if (!currentInvite) return;

    await remove(ref(db, `invitations/${currentInvite.invId}`));
    setInviteModalVisible(false);
    setCurrentInvite(null);
    currentAlertVisible.current = false;
    currentAlertInvId.current = null;
    hasShownAlertFor.current.delete(currentInvite.invId);
  };

  const handleCloseInvite = () => {
    if (!currentInvite) return;

    setInviteModalVisible(false);
    setCurrentInvite(null);
    currentAlertVisible.current = false;
    currentAlertInvId.current = null;
    hasShownAlertFor.current.delete(currentInvite.invId);
  };

  return (
    <InviteProvider resetInviteFlags={resetInviteFlags}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} translucent={true} />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          setIsNavigationReady(true);
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
              <Stack.Screen name="DailyTasks" component={DailyTasksScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      <InviteModal
        visible={inviteModalVisible}
        onClose={handleCloseInvite}
        onAccept={handleAcceptInvite}
        onDecline={handleDeclineInvite}
        fromName={currentInvite?.fromName}
        fromAvatar={currentInvite?.fromAvatar}
        fromLevel={currentInvite?.fromLevel}
        gameType={currentInvite?.gameType}
      />

      <TaskCompletedModal
        visible={!!newlyCompletedTask}
        task={newlyCompletedTask}
        onClose={clearCompletedTask}
      />
    </InviteProvider>
  );
}

export default function App() {
  // Инициализация звуков при запуске приложения
  useEffect(() => {
    initSounds();
  }, []);

  return (
    <AuthProvider>
      <SettingsProvider>
        <GameTypeProvider>
          <DailyTasksProvider>
            <AppNavigator />
          </DailyTasksProvider>
        </GameTypeProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}