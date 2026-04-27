import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set, onDisconnect, get } from 'firebase/database';
import { db } from '../firebase/config';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const storedId = await AsyncStorage.getItem('userId');
      if (storedId) setUserId(storedId);
      setLoading(false);
    };
    loadUser();
  }, []);

  // Установка статуса онлайн при входе
  useEffect(() => {
    if (userId) {
      const userStatusRef = ref(db, `status/${userId}`);
      set(userStatusRef, { online: true, lastSeen: Date.now() })
        .catch(err => console.error('Ошибка установки статуса:', err));
      onDisconnect(userStatusRef).set({ online: false, lastSeen: Date.now() });
    }
  }, [userId]);

  const login = async (id) => {
    setUserId(id);
    await AsyncStorage.setItem('userId', id);
    // Статус установится в useEffect
  };

  const logout = async () => {
    if (userId) {
      const userStatusRef = ref(db, `status/${userId}`);
      await set(userStatusRef, { online: false, lastSeen: Date.now() })
        .catch(err => console.error('Ошибка сброса статуса:', err));
    }
    setUserId(null);
    await AsyncStorage.removeItem('userId');
  };

  return (
    <AuthContext.Provider value={{ userId, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);