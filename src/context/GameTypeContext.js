import React, { createContext, useState, useContext, useRef, useEffect } from 'react';
import { Animated } from 'react-native';

const GameTypeContext = createContext();

export const useGameType = () => useContext(GameTypeContext);

// Цвета фона для разных режимов
export const GAME_TYPE_COLORS = {
  russian: '#1a2a3a', 
  giveaway: '#636363', 
};

export const GameTypeProvider = ({ children }) => {
  const [gameType, setGameType] = useState('russian'); // 'russian' или 'giveaway'
  const backgroundAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(backgroundAnim, {
      toValue: gameType === 'giveaway' ? 1 : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [gameType]);

  const backgroundColor = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [GAME_TYPE_COLORS.russian, GAME_TYPE_COLORS.giveaway],
  });

  return (
    <GameTypeContext.Provider value={{ gameType, setGameType, backgroundColor }}>
      {children}
    </GameTypeContext.Provider>
  );
};