// src/screens/RegisterScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, push, set } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';

const avatars = ['😀', '😎', '🥳', '😇', '🤓', '👻', '🐱', '🐶', '🦊', '🐼'];

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);
  const { userId, login } = useAuth();
  const insets = useSafeAreaInsets();

  // Если userId появился (после вызова login) – переходим в Menu
  useEffect(() => {
    if (userId) {
      // Сбрасываем стек навигации, чтобы Menu стал корневым экраном
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

    try {
      const usersRef = ref(db, 'users');
      const newUserRef = push(usersRef);
      const userId = newUserRef.key;

      const userData = {
        name: name.trim(),
        password: password.trim(), // В реальном приложении пароль нужно хэшировать!
        avatar: selectedAvatar,
        stats: {
          totalGames: 0,
          wins: 0,
          exp: 0,
        },
      };

      await set(newUserRef, userData);
      login(userId); // обновляем контекст – это вызовет useEffect выше
    } catch (error) {
      console.error(error);
      Alert.alert('Ошибка', 'Не удалось зарегистрироваться');
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
        />

        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Выберите аватар:</Text>
        <View style={styles.avatarGrid}>
          {avatars.map((avatar) => (
            <TouchableOpacity
              key={avatar}
              style={[
                styles.avatarOption,
                selectedAvatar === avatar && styles.selectedAvatar,
              ]}
              onPress={() => setSelectedAvatar(avatar)}
            >
              <Text style={styles.avatarEmoji}>{avatar}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.buttonText}>Зарегистрироваться</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
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
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 30,
  },
  avatarOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2c3e50',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedAvatar: {
    borderColor: colors.primary,
    backgroundColor: '#3a4a5a',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  registerButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
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