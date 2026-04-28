// src/screens/LocalGameScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import Board from '../components/Board';
import { useSettings } from '../context/SettingsContext';
import { useGameType } from '../context/GameTypeContext';
import { useAuth } from '../context/AuthContext';
import { useDailyTasks } from '../context/DailyTasksContext';
import {
  initialBoard,
  getValidMovesForPiece,
  getCaptureMoves,
  hasAnyCapture,
  hasMoves,
  checkGiveawayWinner,
  BOARD_SIZE,
  checkDrawByTwoKings,
} from '../utils/checkersLogic';
import { colors } from '../styles/globalStyles';

const LocalGameScreen = ({ navigation }) => {
  const { myPieceColor, opponentPieceColor } = useSettings();
  const { gameType } = useGameType();
  const { userId } = useAuth();
  const { updateProgress, TASK_TYPES } = useDailyTasks();

  const [board, setBoard] = useState(initialBoard());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [selectedCell, setSelectedCell] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [currentPiecePos, setCurrentPiecePos] = useState(null);
  const [animatingMove, setAnimatingMove] = useState(null);
  const [pendingBoard, setPendingBoard] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);

  const isAnimatingRef = useRef(false);
  const gameStartedRef = useRef(false);

  // Подсчёт съеденных шашек
  const initialPiecesCount = 12;
  const player1Pieces = board.flat().filter(p => p && p.player === 1).length;
  const player2Pieces = board.flat().filter(p => p && p.player === 2).length;
  const player1Captured = initialPiecesCount - player2Pieces;
  const player2Captured = initialPiecesCount - player1Pieces;

  // Проверка окончания игры
  useEffect(() => {
    const endGame = async (resultMessage) => {
      if (gameOver) return;
      setGameOver(true);

      // Отслеживаем локальную игру только если пользователь авторизован
      if (userId && gameStartedRef.current) {
        try {
          await updateProgress(TASK_TYPES.PLAY_GAMES, 1);
          await updateProgress(TASK_TYPES.PLAY_LOCAL, 1);
        } catch (error) {
          console.error('Ошибка отслеживания локальной игры:', error);
        }
      }

      Alert.alert('Игра окончена', resultMessage, [
        { text: 'Ок', onPress: () => navigation.goBack() }
      ]);
    };

    if (gameType === 'giveaway') {
      const winner1 = checkGiveawayWinner(board, 1);
      const winner2 = checkGiveawayWinner(board, 2);

      if (winner1 && winner2) {
        endGame('Ничья!');
      } else if (winner1) {
        endGame('Игрок 1 победил! (отдал все фигуры)');
      } else if (winner2) {
        endGame('Игрок 2 победил! (отдал все фигуры)');
      }
    } else {
      // Проверка на ничью (две дамки)
      if (checkDrawByTwoKings(board)) {
        endGame('Ничья! (остались две дамки)');
        return;
      }

      if (!hasMoves(board, 1) && !hasMoves(board, 2)) {
        endGame('Ничья!');
      } else if (!hasMoves(board, 1)) {
        endGame('Игрок 2 победил!');
      } else if (!hasMoves(board, 2)) {
        endGame('Игрок 1 победил!');
      }
    }
  }, [board, gameOver, navigation, gameType]);

  const onAnimationFinish = () => {
    if (!pendingMove) return;
    const finalBoard = pendingBoard.map(r => [...r]);
    const { move, wasCapture, furtherCaptures, willBeKing } = pendingMove;

    if (willBeKing) {
      const piece = finalBoard[move.toRow][move.toCol];
      if (piece) piece.king = true;
    }

    setBoard(finalBoard);
    setAnimatingMove(null);
    isAnimatingRef.current = false;

    if (furtherCaptures.length > 0 && wasCapture) {
      setCurrentPiecePos({ row: move.toRow, col: move.toCol });
      setSelectedCell({ row: move.toRow, col: move.toCol });
      setValidMoves(furtherCaptures);
    } else {
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      setCurrentPiecePos(null);
      setSelectedCell(null);
      setValidMoves([]);
    }

    setPendingBoard(null);
    setPendingMove(null);
  };

  const applyMove = (move) => {
    setSelectedCell(null);
    setValidMoves([]);

    const newBoard = board.map(r => [...r]);
    const piece = newBoard[move.fromRow]?.[move.fromCol];
    if (!piece) return;

    const willBeKing = (!piece.king && ((piece.player === 1 && move.toRow === 7) || (piece.player === 2 && move.toRow === 0)));
    const newKing = piece.king ? true : willBeKing;

    newBoard[move.fromRow][move.fromCol] = null;
    newBoard[move.toRow][move.toCol] = piece;

    if (move.capturedRow !== undefined && move.capturedCol !== undefined) {
      newBoard[move.capturedRow][move.capturedCol] = null;
    }

    if (willBeKing) {
      newBoard[move.toRow][move.toCol].king = true;
    }

    const furtherCaptures = getCaptureMoves(newBoard, move.toRow, move.toCol, currentPlayer);
    const wasCapture = move.capturedRow !== undefined && move.capturedCol !== undefined;

    setPendingBoard(newBoard);
    setPendingMove({ move, wasCapture, furtherCaptures, willBeKing });

    setAnimatingMove({
      from: { row: move.fromRow, col: move.fromCol },
      to: { row: move.toRow, col: move.toCol },
      piece: { ...piece, king: newKing },
      wasCapture: wasCapture,
    });
    isAnimatingRef.current = true;
  };

  const handleSelectCell = (row, col) => {
    if (gameOver || animatingMove || isAnimatingRef.current) return;

    // Отмечаем, что игра началась (первый ход)
    if (!gameStartedRef.current) {
      gameStartedRef.current = true;
    }

    // Проверяем, что клетка игровая (темная)
    const isPlayableCell = (row + col) % 2 === 1;
    if (!isPlayableCell) return;

    if (currentPiecePos) {
      if (row === currentPiecePos.row && col === currentPiecePos.col) {
        return;
      }
      const move = validMoves.find(m => m.row === row && m.col === col);
      if (move) {
        applyMove({
          fromRow: currentPiecePos.row,
          fromCol: currentPiecePos.col,
          toRow: move.row,
          toCol: move.col,
          capturedRow: move.capturedRow,
          capturedCol: move.capturedCol,
        });
      }
      return;
    }

    const piece = board[row][col];
    const anyCapture = hasAnyCapture(board, currentPlayer);

    if (piece && piece.player === currentPlayer) {
      if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
        return;
      } else {
        setSelectedCell({ row, col });
        const moves = getValidMovesForPiece(board, row, col, currentPlayer, anyCapture);
        setValidMoves(moves);
      }
      return;
    }

    if (selectedCell) {
      const move = validMoves.find(m => m.row === row && m.col === col);
      if (move) {
        applyMove({
          fromRow: selectedCell.row,
          fromCol: selectedCell.col,
          toRow: move.row,
          toCol: move.col,
          capturedRow: move.capturedRow,
          capturedCol: move.capturedCol,
        });
      }
    }
  };

  let captureMap = {};
  if (!gameOver && !animatingMove && !isAnimatingRef.current) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.player === currentPlayer) {
          if (getCaptureMoves(board, r, c, currentPlayer).length > 0) {
            captureMap[`${r}-${c}`] = true;
          }
        }
      }
    }
  }

  const gameTypeName = gameType === 'giveaway' ? '🎯 Поддавки' : '♟️ Русские шашки';

  return (
    <View style={styles.container}>
      {/* Режим игры */}
      <View style={styles.header}>
        <View style={styles.gameTypeIndicator}>
          <Text style={styles.gameTypeText}>{gameTypeName}</Text>
        </View>
      </View>

      {/* Игрок 2 */}
      <View style={styles.player2Info}>
        <Text style={styles.player2Avatar}>⚫</Text>
        <Text style={styles.player2Name}>Игрок 2</Text>
        {currentPlayer === 2 && (
          <View style={styles.turnBadge}>
            <Text style={styles.turnBadgeText}>⚡ Ход</Text>
          </View>
        )}
      </View>

      {/* Съеденные шашки игрока 2 (сверху) - игрок 2 съел шашки игрока 1 */}
      <View style={styles.capturedRow}>
        {Array.from({ length: player2Captured }).map((_, index) => (
          <View
            key={`player2-${index}`}
            style={[
              styles.capturedPiece,
              { backgroundColor: myPieceColor, borderColor: myPieceColor }
            ]}
          />
        ))}
      </View>

      <Board
        board={board}
        selectedCell={selectedCell}
        validMoves={validMoves}
        onSelectCell={handleSelectCell}
        myRole={1}
        captureMap={captureMap}
        animatingMove={animatingMove}
        onAnimationFinish={onAnimationFinish}
      />

      {/* Съеденные шашки игрока 1 (снизу) - игрок 1 съел шашки игрока 2 */}
      <View style={styles.capturedRow}>
        {Array.from({ length: player1Captured }).map((_, index) => (
          <View
            key={`player1-${index}`}
            style={[
              styles.capturedPiece,
              { backgroundColor: opponentPieceColor, borderColor: opponentPieceColor }
            ]}
          />
        ))}
      </View>

      {/* Игрок 1 */}
      <View style={styles.player1Info}>
        <Text style={styles.playerAvatar}>⚪</Text>
        <Text style={styles.playerName}>Игрок 1</Text>
        {currentPlayer === 1 && (
          <View style={styles.turnBadge}>
            <Text style={styles.turnBadgeText}>⚡ Ход</Text>
          </View>
        )}
      </View>

      {/* Кнопка выхода */}
      <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
        <Text style={styles.exitText}>← Выход</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 50,
    alignItems: 'center',
    zIndex: 10,
  },
  gameTypeIndicator: {
    backgroundColor: '#2c3e50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  gameTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  player2Info: {
    position: 'absolute',
    top: 110,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    zIndex: 5,
    transform: [{ rotate: '180deg' }],
  },
  player1Info: {
    position: 'absolute',
    bottom: 90,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    zIndex: 5,
  },
  player2Avatar: {
    fontSize: 24,
    marginRight: 8,
  },
  player2Name: {
    fontSize: 16,
    color: colors.textLight,
    fontWeight: '600',
    marginRight: 10,
  },
  playerAvatar: { fontSize: 24, marginRight: 8 },
  playerName: { fontSize: 16, color: colors.textLight, fontWeight: '600', marginRight: 10 },
  capturedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginVertical: 10,
    maxWidth: 380,
    minHeight: 50,
    zIndex: 1,
  },
  capturedPiece: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 3,
    marginVertical: 3,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  turnBadge: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  turnBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  exitButton: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  exitText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});

export default LocalGameScreen;
