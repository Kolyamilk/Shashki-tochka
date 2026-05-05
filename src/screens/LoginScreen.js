// src/screens/LoginScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, get } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';

const LoginScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { userId, login } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (userId) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Menu' }],
      });
    }
  }, [userId, navigation]);

  const handleLogin = async () => {
    if (!name.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Введите имя и пароль');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const usersRef = ref(db, 'users');

      // Таймаут 5 секунд
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );

      const snapshot = await Promise.race([get(usersRef), timeoutPromise]);

      if (!snapshot.exists()) {
        setErrorMessage('Пользователь не найден');
        setLoading(false);
        return;
      }

      const users = snapshot.val();
      let foundUserId = null;
      for (const [userId, userData] of Object.entries(users)) {
        if (userData.name === name.trim() && userData.password === password.trim()) {
          foundUserId = userId;
          break;
        }
      }

      if (foundUserId) {
        login(foundUserId);
        // Успешный вход – loading останется true до перехода, но это нормально
      } else {
        setErrorMessage('Неверное имя или пароль');
        setLoading(false);
      }
    } catch (error) {
      if (error.message !== 'TIMEOUT') {
        console.error(error);
      }
      setErrorMessage('Не получилось соединиться. Проверьте доступ к интернету.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Вход</Text>

        <TextInput
          style={styles.input}
          placeholder="Имя"
          placeholderTextColor="#aaa"
          value={name}
          onChangeText={setName}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('Register')}
          disabled={loading}
        >
          <Text style={styles.linkText}>Нет аккаунта? Зарегистрироваться</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#2c3e50',
    color: colors.textLight,
    padding: 12,
    borderRadius: 10,
    fontSize: 18,
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 50,
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerLink: {
    alignItems: 'center',
  },
  linkText: {
    color: colors.primary,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;