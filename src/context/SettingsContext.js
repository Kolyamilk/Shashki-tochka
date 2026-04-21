import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

const SETTINGS_KEY = '@checkers_settings';

export const SettingsProvider = ({ children }) => {
  const [boardLightColor, setBoardLightColor] = useState('#f0d9b5');
  const [boardDarkColor, setBoardDarkColor] = useState('#b58863');
  const [myPieceColor, setMyPieceColor] = useState('#FFFFFF');
  const [opponentPieceColor, setOpponentPieceColor] = useState('#333333');
  const [myKingStyle, setMyKingStyle] = useState('crown');
  const [opponentKingStyle, setOpponentKingStyle] = useState('rhombus');
  const [kingCrownColor, setKingCrownColor] = useState('#FFD700');
  const [isLoaded, setIsLoaded] = useState(false);

  // Загрузка настроек при монтировании
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.boardLightColor) setBoardLightColor(settings.boardLightColor);
          if (settings.boardDarkColor) setBoardDarkColor(settings.boardDarkColor);
          if (settings.myPieceColor) setMyPieceColor(settings.myPieceColor);
          if (settings.opponentPieceColor) setOpponentPieceColor(settings.opponentPieceColor);
          if (settings.myKingStyle) setMyKingStyle(settings.myKingStyle);
          if (settings.opponentKingStyle) setOpponentKingStyle(settings.opponentKingStyle);
          if (settings.kingCrownColor) setKingCrownColor(settings.kingCrownColor);
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Сохранение настроек при изменении
  useEffect(() => {
    if (!isLoaded) return;
    const saveSettings = async () => {
      try {
        const settings = {
          boardLightColor,
          boardDarkColor,
          myPieceColor,
          opponentPieceColor,
          myKingStyle,
          opponentKingStyle,
          kingCrownColor,
        };
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
      }
    };
    saveSettings();
  }, [boardLightColor, boardDarkColor, myPieceColor, opponentPieceColor, myKingStyle, opponentKingStyle, kingCrownColor, isLoaded]);

  return (
    <SettingsContext.Provider
      value={{
        boardLightColor,
        boardDarkColor,
        setBoardLightColor,
        setBoardDarkColor,
        myPieceColor,
        setMyPieceColor,
        opponentPieceColor,
        setOpponentPieceColor,
        myKingStyle,
        setMyKingStyle,
        opponentKingStyle,
        setOpponentKingStyle,
        kingCrownColor,
        setKingCrownColor,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};