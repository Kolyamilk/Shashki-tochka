// src/components/ScreenLayout.js
import React from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../styles/globalStyles';

/**
 * Универсальный layout для всех экранов
 * @param {Object} props
 * @param {React.ReactNode} props.children - Контент экрана
 * @param {boolean} props.scrollable - Нужна ли прокрутка (по умолчанию false)
 * @param {boolean} props.keyboardAware - Нужно ли учитывать клавиатуру (по умолчанию false)
 * @param {Object} props.contentContainerStyle - Дополнительные стили для контента
 * @param {boolean} props.noPadding - Убрать padding (по умолчанию false)
 */
const ScreenLayout = ({
  children,
  scrollable = false,
  keyboardAware = false,
  contentContainerStyle = {},
  noPadding = false,
}) => {
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    {
      paddingTop: insets.top,
      paddingBottom: Math.max(insets.bottom, 0),
    },
  ];

  const contentStyle = [
    !noPadding && styles.content,
    contentContainerStyle,
  ];

  // Если нужна клавиатура и прокрутка
  if (keyboardAware && scrollable) {
    return (
      <KeyboardAvoidingView
        style={containerStyle}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Если только клавиатура
  if (keyboardAware) {
    return (
      <KeyboardAvoidingView
        style={containerStyle}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={contentStyle}>
          {children}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Если только прокрутка
  if (scrollable) {
    return (
      <View style={containerStyle}>
        <ScrollView
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  // Обычный экран без прокрутки и клавиатуры
  return (
    <View style={containerStyle}>
      <View style={contentStyle}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
});

export default ScreenLayout;
