import React from 'react';
import { Pressable, View, StyleSheet, Text } from 'react-native';
import Piece from './Piece';
import { useSettings } from '../context/SettingsContext';

const Square = ({ row, col, piece, onPress, isSelected, isValidMove, isCapture, myRole }) => {
  const { boardLightColor, boardDarkColor } = useSettings();
  const isDark = (row + col) % 2 === 1;
  return (
    <Pressable
      style={[
        styles.square,
        { backgroundColor: isDark ? boardDarkColor : boardLightColor },
        isSelected && styles.selected,
        isValidMove && styles.validMove,
      ]}
      onPress={() => onPress(row, col)}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.1)' }}
    >
      {piece && <Piece piece={piece} canCapture={isCapture} myRole={myRole} />}
      {isValidMove && <View style={styles.dot} />}

    </Pressable>
  );
};

const styles = StyleSheet.create({
  square: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  selected: {
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  validMove: {
    backgroundColor: '#aaffaa80',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00FF00',
    position: 'absolute',
  },

});

export default Square;