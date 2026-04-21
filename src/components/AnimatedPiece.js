// src/components/AnimatedPiece.js
import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../context/SettingsContext';

const AnimatedPiece = ({ from, to, piece, onFinish, myRole, cellSize }) => {
  const { 
    myPieceColor, 
    opponentPieceColor, 
    myKingStyle, 
    opponentKingStyle, 
    kingCrownColor 
  } = useSettings();

  const kingStyle = piece.player === 1 ? myKingStyle : opponentKingStyle;
  const pieceColor = piece.player === 1 ? myPieceColor : opponentPieceColor;

  // ← Создаём значения ПРЯМО в компоненте (не в useRef!)
  const translateX = new Animated.Value(0);
  const translateY = new Animated.Value(0);

  // ← Вычисляем координаты с учётом margin клеток и padding доски
  const getDisplayRow = (row) => (myRole === 1 ? 7 - row : row);

  const squareSize = 45;
  const squareMargin = 1;
  const boardPadding = 4;

  // Каждая клетка занимает squareSize + 2*margin
  const cellTotalSize = squareSize + squareMargin * 2;

  const fromX = from.col * cellTotalSize + squareMargin + boardPadding;
  const fromY = getDisplayRow(from.row) * cellTotalSize + squareMargin + boardPadding;
  const toX = to.col * cellTotalSize + squareMargin + boardPadding;
  const toY = getDisplayRow(to.row) * cellTotalSize + squareMargin + boardPadding;

  const deltaX = toX - fromX;
  const deltaY = toY - fromY;

  const darkenColor = (color) => {
    if (color?.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const darker = (c) => Math.max(0, c - 40);
      return `#${darker(r).toString(16).padStart(2, '0')}${darker(g).toString(16).padStart(2, '0')}${darker(b).toString(16).padStart(2, '0')}`;
    }
    return color;
  };

  const renderKingSymbol = () => {
    switch (kingStyle) {
      case 'star': return '⭐';
      case 'fire': return '🔥';
      case 'diamond': return '💎';
      case 'dove': return '🕊️';
      case 'heart': return '♥️';
      case 'poop': return '💩';
      default: return '👑';
    }
  };

  useEffect(() => {
    console.log('🎬 AnimatedPiece: запуск анимации', { from, to, deltaX, deltaY });

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: deltaX,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: deltaY,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      console.log('✅ AnimatedPiece: анимация завершена');
      onFinish();
    });

    // ← Очистка при размонтировании
    return () => {
      translateX.stopAnimation();
      translateY.stopAnimation();
    };
  }, [deltaX, deltaY]);

  // ← Контейнер с absolute позиционированием
  if (piece.king) {
    return (
      <View style={[styles.absoluteContainer, { left: fromX, top: fromY }]}>
        <Animated.View style={[
          styles.kingContainer,
          {
            transform: [
              { translateX },
              { translateY },
            ],
          },
        ]}>
          <Text style={[styles.kingEmoji, { color: kingCrownColor }]}>
            {renderKingSymbol()}
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.absoluteContainer, { left: fromX, top: fromY }]}>
      <Animated.View style={[
        styles.container,
        {
          transform: [
            { translateX },
            { translateY },
          ],
        },
      ]}>
        <LinearGradient
          colors={[pieceColor, darkenColor(pieceColor)]}
          style={styles.piece}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  absoluteContainer: {
    position: 'absolute',
    width: 45,
    height: 45,
    zIndex: 1000,
    elevation: 1000,
  },
  container: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  piece: {
    width: 40,
    height: 40,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#888',
  },
  kingContainer: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kingEmoji: {
    fontSize: 32,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default AnimatedPiece;