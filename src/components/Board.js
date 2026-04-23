// src/components/Board.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Square from './Square';
import AnimatedPiece from './AnimatedPiece';
import { BOARD_SIZE } from '../utils/checkersLogic';

const Board = ({ board, selectedCell, validMoves, onSelectCell, myRole, captureMap, animatingMove, onAnimationFinish }) => {
  if (!board || !Array.isArray(board) || board.length === 0) {
    return (
      <View style={styles.boardWrapper}>
        <View style={styles.board}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Загрузка доски...</Text>
          </View>
        </View>
      </View>
    );
  }

  const rowOrder = myRole === 1 ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const isSelected = (row, col) => selectedCell && selectedCell.row === row && selectedCell.col === col;
  const isValidMoveCell = (row, col) => validMoves && Array.isArray(validMoves) && validMoves.some(m => m && m.row === row && m.col === col);
  const isCaptureCell = (row, col) => captureMap && captureMap[`${row}-${col}`];
  
  const isAnimatingCell = (row, col) => {
    if (!animatingMove) return false;
    return (animatingMove.from.row === row && animatingMove.from.col === col) ||
           (animatingMove.to.row === row && animatingMove.to.col === col);
  };

  return (
    <View style={styles.boardWrapper}>
      <View style={styles.board}>
        {rowOrder.map((actualRow) => {
          const row = board[actualRow];
          if (!row || !Array.isArray(row)) {
            return (
              <View key={actualRow} style={styles.row}>
                {Array(BOARD_SIZE).fill(null).map((_, col) => (
                  <View key={`${actualRow}-${col}`} style={[styles.cell, (actualRow + col) % 2 === 0 ? styles.lightCell : styles.darkCell]} />
                ))}
              </View>
            );
          }
          
          return (
            <View key={actualRow} style={styles.row}>
              {row.map((piece, col) => {
                const shouldHidePiece = isAnimatingCell(actualRow, col);
                const pieceToShow = shouldHidePiece ? null : (piece && typeof piece === 'object' ? piece : null);
                
                return (
                  <Square
                    key={`${actualRow}-${col}`}
                    row={actualRow}
                    col={col}
                    piece={pieceToShow}
                    onPress={onSelectCell}
                    isSelected={isSelected(actualRow, col)}
                    isValidMove={isValidMoveCell(actualRow, col)}
                    isCapture={isCaptureCell(actualRow, col)}
                    myRole={myRole}
                  />
                );
              })}
            </View>
          );
        })}
      </View>
      
      {/* ← Анимация рендерится ПОВЕРХ доски */}
      {animatingMove && animatingMove.piece && (
        <AnimatedPiece
          from={animatingMove.from}
          to={animatingMove.to}
          piece={animatingMove.piece}
          onFinish={onAnimationFinish}
          myRole={myRole}
          cellSize={45}
          wasCapture={animatingMove.wasCapture}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  boardWrapper: {
    borderWidth: 4,
    borderColor: '#4a2c2c',
    borderRadius: 10,
    backgroundColor: '#4a2c2c',
    padding: 4,
    position: 'relative',  // ← Важно для absolute позиционирования!
    zIndex: 1,
  },
  board: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: 45,
    height: 45,
  },
  lightCell: {
    backgroundColor: '#F0D9B5',
  },
  darkCell: {
    backgroundColor: '#B58863',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 360,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default Board;