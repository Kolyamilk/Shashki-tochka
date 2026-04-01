// src/screens/BotGameScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { ref, set, remove, onValue, off } from 'firebase/database';
import { db } from '../firebase/config';
import Board from '../components/Board';
import { useSettings } from '../context/SettingsContext';
import {
  initialBoard,
  getValidMovesForPiece,
  getCaptureMoves,
  hasAnyCapture,
  hasMoves,
  BOARD_SIZE,
} from '../utils/checkersLogic';
import { getBestMove } from '../utils/botLogic';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';

const BotGameScreen = ({ route, navigation }) => {
  const { difficulty } = route.params;
  const { myPieceColor, opponentPieceColor } = useSettings();
  const { userId } = useAuth();
  const [board, setBoard] = useState(initialBoard());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [selectedCell, setSelectedCell] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [currentPiecePos, setCurrentPiecePos] = useState(null);
  const [animatingMove, setAnimatingMove] = useState(null);
  const [pendingBoard, setPendingBoard] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const isAnimatingRef = useRef(false);
  const isBotThinkingRef = useRef(false);
  const gameIdRef = useRef(null);

  // ← При монтировании создаём запись в bot_games
  useEffect(() => {
    if (!userId) return;
    const gameId = `bot_${userId}_${Date.now()}`;
    gameIdRef.current = gameId;
    const botGameRef = ref(db, `bot_games/${gameId}`);
    set(botGameRef, {
      playerId: userId,
      difficulty: difficulty,
      status: 'active',
      startedAt: Date.now(),
    }).catch(console.error);
    console.log('✅ Создана запись bot_games:', gameId);

    return () => {
      if (gameIdRef.current) {
        remove(ref(db, `bot_games/${gameIdRef.current}`)).catch(console.error);
        console.log('🗑️ Удалена запись bot_games при размонтировании');
      }
    };
  }, [userId, difficulty]);

  // Проверка окончания игры
  useEffect(() => {
    const endGame = async (resultMessage, winner = null) => {
      if (gameOver) return;
      setGameOver(true);

      if (gameIdRef.current) {
        const botGameRef = ref(db, `bot_games/${gameIdRef.current}`);
        await set(botGameRef, {
          playerId: userId,
          difficulty: difficulty,
          status: 'finished',
          finishedAt: Date.now(),
          result: winner === 1 ? 'player_win' : (winner === 2 ? 'bot_win' : 'draw'),
        }).catch(console.error);
        console.log('📝 Обновлён статус игры в bot_games');
      }

      Alert.alert('Игра окончена', resultMessage, [
        { text: 'Ок', onPress: () => navigation.goBack() }
      ]);
    };

    if (!hasMoves(board, 1) && !hasMoves(board, 2)) {
      endGame('Ничья!', null);
    } else if (!hasMoves(board, 1)) {
      endGame('Вы проиграли!', 2);
    } else if (!hasMoves(board, 2)) {
      endGame('Вы выиграли!', 1);
    }
  }, [board, gameOver, userId, difficulty, navigation]);

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
      if (currentPlayer === 1) {
        // Игрок продолжает
        setSelectedCell({ row: move.toRow, col: move.toCol });
        setValidMoves(furtherCaptures);
      } else {
        // Бот продолжает – сбрасываем флаг, чтобы эффект бота сработал
        isBotThinkingRef.current = false;
        setBotThinking(true);
      }
    } else {
      // Нет дальнейших взятий – переключаем игрока
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      setCurrentPiecePos(null);
      setSelectedCell(null);
      setValidMoves([]);
      if (currentPlayer === 2) {
        isBotThinkingRef.current = false;
        setBotThinking(false);
      }
    }

    setPendingBoard(null);
    setPendingMove(null);
  };

  const applyMove = (move) => {
    setSelectedCell(null);
    setValidMoves([]);

    const newBoard = board.map(r => [...r]);
    const piece = newBoard[move.fromRow]?.[move.fromCol];
    if (!piece) {
      console.error('❌ Ошибка: нет фигуры в начальной клетке');
      if (currentPlayer === 2) {
        isBotThinkingRef.current = false;
        setBotThinking(false);
      }
      return;
    }

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
    });
    isAnimatingRef.current = true;
  };

  // Ход бота
  useEffect(() => {
    if (currentPlayer !== 2 || gameOver || isBotThinkingRef.current) return;

    isBotThinkingRef.current = true;
    setBotThinking(true);

    const timeout = setTimeout(() => {
      try {
        let move = null;
        if (currentPiecePos) {
          const { row, col } = currentPiecePos;
          const captures = getCaptureMoves(board, row, col, 2);
          if (captures.length > 0) {
            const capture = captures[0];
            move = {
              fromRow: row,
              fromCol: col,
              toRow: capture.row,
              toCol: capture.col,
              capturedRow: capture.capturedRow,
              capturedCol: capture.capturedCol,
            };
          }
        } else {
          move = getBestMove(board, 2, difficulty);
        }

        if (move) {
          applyMove(move);
        } else {
          setCurrentPlayer(1);
          setCurrentPiecePos(null);
          isBotThinkingRef.current = false;
          setBotThinking(false);
        }
      } catch (error) {
        console.error('Ошибка в таймере:', error);
        isBotThinkingRef.current = false;
        setBotThinking(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [currentPlayer, gameOver, board, currentPiecePos, difficulty]);

  const handleSelectCell = (row, col) => {
    if (currentPlayer !== 1 || gameOver || botThinking || animatingMove || isAnimatingRef.current) return;

    if (currentPiecePos) {
      if (row === currentPiecePos.row && col === currentPiecePos.col) {
        setCurrentPiecePos(null);
        setSelectedCell(null);
        setValidMoves([]);
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
    const anyCapture = hasAnyCapture(board, 1);

    if (piece && piece.player === 1) {
      if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
        setSelectedCell(null);
        setValidMoves([]);
      } else {
        setSelectedCell({ row, col });
        const moves = getValidMovesForPiece(board, row, col, 1, anyCapture);
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
      } else {
        setSelectedCell(null);
        setValidMoves([]);
      }
    }
  };

  let captureMap = {};
  if (currentPlayer === 1 && !gameOver && !animatingMove && !isAnimatingRef.current) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.player === 1) {
          if (getCaptureMoves(board, r, c, 1).length > 0) {
            captureMap[`${r}-${c}`] = true;
          }
        }
      }
    }
  }

  const isMyTurn = currentPlayer === 1;

  return (
    <View style={styles.container}>
      <View style={styles.turnIndicator}>
        <Text style={[styles.turnTextBig, isMyTurn ? styles.myTurn : styles.opponentTurn]}>
          {isMyTurn ? '⚡ Ваш ход' : '🤖 Думает...'}
        </Text>
      </View>

      <View style={styles.opponentInfo}>
        <Text style={styles.opponentAvatar}>🤖</Text>
        <Text style={styles.opponentName}>Компьютер</Text>
        <View style={styles.capturedBadgeSmall}>
          <Text style={styles.capturedTextSmall}>🍽️ 0</Text>
        </View>
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

      <View style={styles.playerInfo}>
        <Text style={styles.playerAvatar}>😀</Text>
        <Text style={styles.playerName}>Вы</Text>
        <View style={styles.capturedBadgeSmall}>
          <Text style={styles.capturedTextSmall}>🍽️ 0</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.giveUpButton} onPress={handleGiveUp}>
        <Text style={styles.giveUpText}>🚪 Сдаться</Text>
      </TouchableOpacity>
    </View>
  );

  function handleGiveUp() {
    Alert.alert(
      'Сдаться',
      'Вы уверены?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Да',
          style: 'destructive',
          onPress: async () => {
            if (gameIdRef.current) {
              await set(ref(db, `bot_games/${gameIdRef.current}`), {
                playerId: userId,
                difficulty: difficulty,
                status: 'finished',
                finishedAt: Date.now(),
                result: 'player_gave_up',
              }).catch(console.error);
            }
            navigation.goBack();
          },
        },
      ]
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2a3a',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 110,
  },
  turnIndicator: {
    marginTop: 30,
    marginBottom: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 40,
    backgroundColor: '#2c3e50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  turnTextBig: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  myTurn: {
    color: '#4ECDC4',
  },
  opponentTurn: {
    color: '#FF6B6B',
  },
  opponentInfo: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 40,
    marginLeft: 20,
    marginBottom: 0,
  },
  opponentAvatar: {
    fontSize: 28,
    marginRight: 8,
  },
  opponentName: {
    fontSize: 18,
    color: colors.textLight,
    fontWeight: '600',
    marginRight: 12,
  },
  playerInfo: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 40,
    marginLeft: 20,
    marginTop: 0,
  },
  playerAvatar: {
    fontSize: 28,
    marginRight: 8,
  },
  playerName: {
    fontSize: 18,
    color: colors.textLight,
    fontWeight: '600',
    marginRight: 12,
  },
  capturedBadgeSmall: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  capturedTextSmall: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  giveUpButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#FF6B6B',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  giveUpText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BotGameScreen;