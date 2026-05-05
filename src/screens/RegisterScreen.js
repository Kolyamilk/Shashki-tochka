// src/screens/RegisterScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, push, set } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';

const avatars = [
  '😀', '😎', '🥳', '😇', '🤓', '👻', '🐱', '🐶', '🦊', '🐼',
  '🤠', '🥸', '🤡', '👽', '🤖', '🎃', '🐵', '🐯', '🦁', '🐻',
  '🐨', '🐸', '🦄', '🐷', '🐮', '🐔', '🐧', '🦉', '🦅', '🐺'
];

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);
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

  const handleRegister = async () => {
    if (!name.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Введите имя и пароль');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const usersRef = ref(db, 'users');
      const newUserRef = push(usersRef);
      const userId = newUserRef.key;

      const userData = {
        name: name.trim(),
        password: password.trim(),
        avatar: selectedAvatar,
        stats: {
          totalGames: 0,
          wins: 0,
          exp: 0,
        },
        settings: {
          boardLightColor: '#f0d9b5',
          boardDarkColor: '#b58863',
          myPieceColor: '#FFFFFF',
          opponentPieceColor: '#333333',
          myKingStyle: 'crown',
          opponentKingStyle: 'rhombus',
          kingCrownColor: '#FFD700',
        },
      };

      // Таймаут 5 секунд
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );

      await Promise.race([set(newUserRef, userData), timeoutPromise]);
      login(userId);
      // Успех – переход будет выполнен через useEffect
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
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Регистрация</Text>

        <TextInput
          style={styles.input}
          placeholder="Ваше имя"
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

        <Text style={styles.label}>Выберите аватар:</Text>
        <Text style={styles.hint}>💡 После регистрации будет доступно ещё больше аватаров в профиле</Text>
        <View style={styles.avatarGrid}>
          {avatars.map((avatar) => (
            <TouchableOpacity
              key={avatar}
              style={[
                styles.avatarOption,
                selectedAvatar === avatar && styles.selectedAvatar,
              ]}
              onPress={() => setSelectedAvatar(avatar)}
              disabled={loading}
            >
              <Text style={styles.avatarEmoji}>{avatar}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.registerButton, loading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Зарегистрироваться</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
          disabled={loading}
        >
          <Text style={styles.linkText}>Уже есть аккаунт? Войти</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
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
  label: {
    color: colors.textLight,
    fontSize: 18,
    marginBottom: 10,
  },
  hint: {
    color: '#4ECDC4',
    fontSize: 13,
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 30,
  },
  avatarOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2c3e50',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedAvatar: {
    borderColor: colors.primary,
    backgroundColor: '#3a4a5a',
  },
  avatarEmoji: {
    fontSize: 28,
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
  registerButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 15,
  },
  linkText: {
    color: colors.primary,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;