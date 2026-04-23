import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../context/SettingsContext';

const Piece = ({ piece, canCapture, overrideKingStyle }) => {
  const { player, king } = piece;
  const {
    myPieceColor,
    opponentPieceColor,
    myKingStyle,
    opponentKingStyle,
    kingCrownColor,
  } = useSettings();

  const baseColor = player === 1 ? myPieceColor : opponentPieceColor;
  const kingStyle = overrideKingStyle !== undefined ? overrideKingStyle : (player === 1 ? myKingStyle : opponentKingStyle);

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

  const gradientColors = [baseColor, darkenColor(baseColor)];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (canCapture) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [canCapture]);

  const renderKingSymbol = () => {
    switch (kingStyle) {
      case 'crown': return '♔';
      case 'queen': return '♕';
      case 'star': return '★';
      case 'heart': return '♡';
      case 'skull': return '☠';
      case 'shield': return '⛨';
      case 'cross': return '✚';
      case 'flower': return '✿';
      case 'peace': return '☮';
      default: return '♔';
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        {!king ? (
          <LinearGradient
            colors={gradientColors}
            style={styles.circlePiece}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ) : (
          <View style={styles.kingPieceContainer}>
            <Text style={[styles.kingEmoji, { color: baseColor }]}>
              {renderKingSymbol()}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circlePiece: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#888',
  },
  kingPiece: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#888',
  },
  kingPieceContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  kingEmoji: {
    fontSize: 32,
    textAlign: 'center',
    lineHeight: 36,
    fontWeight: '700',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
});

export default Piece;