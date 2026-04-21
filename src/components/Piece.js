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
      case 'star': return '⭐';
      case 'fire': return '🔥';
      case 'diamond': return '💎';
      case 'dove': return '🕊️';
      case 'heart': return '♥️';
      case 'poop': return '💩';
      case 'square': return '■';
      case 'rhombus': return '♛';
      default: return '👑';
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
          <LinearGradient
            colors={gradientColors}
            style={styles.kingPiece}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.kingEmoji}>
              {renderKingSymbol()}
            </Text>
          </LinearGradient>
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
  kingEmoji: {
    fontSize: 24,
    textAlign: 'center',
    lineHeight: 32,
    color: '#FFFFFF',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});

export default Piece;