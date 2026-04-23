// src/utils/notifications.js
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { ref, get, set } from 'firebase/database';
import { db } from '../firebase/config';

// Проверка среды выполнения
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications = null;

// Загружаем модуль ТОЛЬКО если это не Expo Go
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log('expo-notifications not available:', e.message);
  }
}

// Настраиваем обработчик только если модуль загружен
if (Notifications && !isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotificationsAsync(userId) {
  // В Expo Go и в режиме разработки без нативной сборки – выходим
  if (isExpoGo) {
    console.log('⚠️ Push notifications are not supported in Expo Go');
    return;
  }
  
  if (!Notifications) {
    console.log('⚠️ expo-notifications module not available');
    return;
  }

  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert('Не удалось получить разрешение на уведомления');
    return;
  }
  
  token = (await Notifications.getExpoPushTokenAsync()).data;
  
  if (userId && token) {
    await set(ref(db, `users/${userId}/pushToken`), token);
  }
  return token;
}

export async function sendPushNotification(toUserId, title, body, data = {}) {
  // В Expo Go не отправляем
  if (isExpoGo || !Notifications) {
    return;
  }

  const userRef = ref(db, `users/${toUserId}/pushToken`);
  const snapshot = await get(userRef);
  const pushToken = snapshot.val();
  
  if (!pushToken) return;

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
}