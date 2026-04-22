// src/screens/BotGameScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ref, set, remove, update } from 'firebase/database';
import { db } from '../firebase/config';
import Board from '../components/Board';
import VictoryModal from '../components/VictoryModal';
import { useSettings } from '../context/SettingsContext';
import { useGameType } from '../context/GameTypeContext';
import {
  initialBoard,
  getValidMovesForPiece,
  getCaptureMoves,
  hasAnyCapture,
  hasMoves,
  checkGiveawayWinner,
  BOARD_SIZE,
} from '../utils/checkersLogic';
import { getBestMove } from '../utils/botLogic';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';
import { EXP_REWARDS, getLevelFromExp, getLevelColor } from '../utils/levelSystem';
import { get } from 'firebase/database';

const BotGameScreen = ({ route, navigation }) => {
  const { difficulty } = route.params;
  const { myPieceColor, opponentPieceColor } = useSettings();
  const { userId } = useAuth();
  const { gameType } = useGameType();
  
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
  const [victoryModalVisible, setVictoryModalVisible] = useState(false);
  const [victoryData, setVictoryData] = useState({ isWin: false, expGained: 0, oldExp: 0 });
  const [myLevel, setMyLevel] = useState(1);
  const [myName, setMyName] = useState('Вы');
  const [myAvatar, setMyAvatar] = useState('😀');

  const isAnimatingRef = useRef(false);
  const isBotThinkingRef = useRef(false);
  const gameIdRef = useRef(null);
  const botTurnTriggerRef = useRef(0);

  // Подсчёт съеденных шашек
  const initialPiecesCount = 12;
  const player1Pieces = board.flat().filter(p => p && p.player === 1).length;
  const player2Pieces = board.flat().filter(p => p && p.player === 2).length;
  const player1Captured = initialPiecesCount - player2Pieces;
  const player2Captured = initialPiecesCount - player1Pieces;  // ← ← ← НОВОЕ: триггер для хода бота

  // ← При монтировании создаём запись в bot_games
  useEffect(() => {
    if (!userId) return;

    // Загружаем данные игрока
    const loadPlayerData = async () => {
      const userRef = ref(db, `users/${userId}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setMyName(data.name || 'Вы');
        setMyAvatar(data.avatar || '😀');
        setMyLevel(getLevelFromExp(data.stats?.exp || 0).level);
      }
    };
    loadPlayerData();

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

      let expGained = 0;
      let oldExp = 0;
      const isWin = winner === 1;

      // Начисление опыта
      if (userId && winner !== null) {
        try {
          const userStatsRef = ref(db, `users/${userId}/stats`);
          const statsSnap = await get(userStatsRef);
          const stats = statsSnap.val() || { totalGames: 0, wins: 0, exp: 0 };

          oldExp = stats.exp || 0;

          if (winner === 1) {
            // Победа игрока
            if (difficulty === 'easy') expGained = EXP_REWARDS.WIN_BOT_EASY;
            else if (difficulty === 'medium') expGained = EXP_REWARDS.WIN_BOT_MEDIUM;
            else if (difficulty === 'hard') expGained = EXP_REWARDS.WIN_BOT_HARD;
            else if (difficulty === 'grandmaster') expGained = EXP_REWARDS.WIN_BOT_GRANDMASTER;
          } else if (winner === 2) {
            // Поражение от бота
            expGained = EXP_REWARDS.LOSE_BOT;
          }

          await update(userStatsRef, {
            exp: oldExp + expGained,
          });
          console.log(`✨ Начислено ${expGained} опыта`);
        } catch (error) {
          console.error('Ошибка начисления опыта:', error);
        }
      }

      if (gameIdRef.current) {
        const botGameRef = ref(db, `bot_games/${gameIdRef.current}`);
       await update(botGameRef, {
      status: 'finished',
      finishedAt: Date.now(),
      result: winner === 1 ? 'player_win' : (winner === 2 ? 'bot_win' : 'draw'),
    }).catch(console.error);
    console.log('📝 Обновлён статус игры в bot_games');
      }

      // Показываем модальное окно победы
      setVictoryData({ isWin, expGained, oldExp });
      setVictoryModalVisible(true);
    };

    if (gameType === 'giveaway') {
      // Режим поддавков: побеждает тот, кто первым отдал все фигуры или не может ходить
      const winner1 = checkGiveawayWinner(board, 1);
      const winner2 = checkGiveawayWinner(board, 2);

      if (winner1 && winner2) {
        endGame('Ничья!', null);
      } else if (winner1) {
        endGame('Вы победили! (отдали все фигуры)', 1);
      } else if (winner2) {
        endGame('Компьютер победил! (отдал все фигуры)', 2);
      }
    } else {
      // Обычный режим: побеждает тот, кто съел все фигуры противника
      if (!hasMoves(board, 1) && !hasMoves(board, 2)) {
        endGame('Ничья!', null);
      } else if (!hasMoves(board, 1)) {
        endGame('Вы проиграли!', 2);
      } else if (!hasMoves(board, 2)) {
        endGame('Вы выиграли!', 1);
      }
    }
  }, [board, gameOver, userId, difficulty, navigation, gameType]);

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
      // ← ← ← ЕСТЬ дальнейшие взятия – продолжаем серию
      console.log('🔁 Продолжение серии взятий');
      setCurrentPiecePos({ row: move.toRow, col: move.toCol });
      
      if (currentPlayer === 1) {
        // Игрок продолжает
        setSelectedCell({ row: move.toRow, col: move.toCol });
        setValidMoves(furtherCaptures);
      } else {
        // Бот продолжает – сбрасываем флаг
        isBotThinkingRef.current = false;
        setBotThinking(false);
      }
    } else {
      // ← ← ← НЕТ дальнейших взятий – переключаем игрока
      const nextPlayer = currentPlayer === 1 ? 2 : 1;
      console.log('🔄 Переключаем игрока: Игрок', currentPlayer, '→ Игрок', nextPlayer);
      
      setCurrentPlayer(nextPlayer);
      
      // ← ← ← КРИТИЧНО: Очищаем ВСЁ при смене игрока!
      setCurrentPiecePos(null);
      setSelectedCell(null);
      setValidMoves([]);
      
      // ← ← ← КРИТИЧНО: Сбрасываем флаг бота!
      isBotThinkingRef.current = false;
      setBotThinking(false);
      
      // ← ← ← НОВОЕ: Триггерим ход бота если сейчас его очередь
      if (nextPlayer === 2) {
        botTurnTriggerRef.current += 1;
        console.log('🤖 Триггер хода бота:', botTurnTriggerRef.current);
      }
    }

    setPendingBoard(null);
    setPendingMove(null);
  };

  const applyMove = (move) => {
    console.log('🎯 Применяем ход:', move);
    
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
    
    console.log('🎬 Анимация запущена');
  };

  // ← ← ← Ход бота (ИСПРАВЛЕННЫЙ)
  useEffect(() => {
    console.log('🤖 Bot useEffect сработал:', { 
      currentPlayer, 
      gameOver, 
      isBotThinking: isBotThinkingRef.current,
      currentPiecePos,
      botTurnTrigger: botTurnTriggerRef.current
    });
    
    // ← ← ← ПРОВЕРКИ: когда бот должен ходить
    if (currentPlayer !== 2) {
      console.log('🤖 Пропуск: не ход бота (currentPlayer:', currentPlayer, ')');
      return;
    }
    
    if (gameOver) {
      console.log('🤖 Пропуск: игра окончена');
      return;
    }
    
    if (isAnimatingRef.current) {
      console.log('🤖 Пропуск: идёт анимация');
      return;
    }
    
    if (isBotThinkingRef.current) {
      console.log('🤖 Пропуск: бот уже думает');
      return;
    }

    // ← ← ← ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ – бот ходит!
    console.log('🤖 Бот начинает думать...');
    isBotThinkingRef.current = true;
    setBotThinking(true);

    const timeout = setTimeout(() => {
      try {
        let move = null;

        // ← ← ← Если есть продолжение серии взятий
        if (currentPiecePos) {
          console.log('🤖 Бот продолжает серию взятий с позиции:', currentPiecePos);
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
          // ← ← ← Обычный ход бота
          console.log('🤖 Бот ищет лучший ход...');
          move = getBestMove(board, 2, difficulty, gameType);
        }

        if (move) {
          console.log('🤖 Бот делает ход:', move);
          applyMove(move);
        } else {
          console.log('🤖 У бота нет ходов – передаём ход игроку');
          setCurrentPlayer(1);
          setCurrentPiecePos(null);
          isBotThinkingRef.current = false;
          setBotThinking(false);
        }
      } catch (error) {
        console.error('❌ Ошибка в таймере бота:', error);
        isBotThinkingRef.current = false;
        setBotThinking(false);
      }
    }, difficulty === 'easy' ? 400 : difficulty === 'medium' ? 500 : difficulty === 'hard' ? 700 : 900);
    
    return () => clearTimeout(timeout);
  }, [
    currentPlayer, 
    gameOver, 
    board, 
    currentPiecePos, 
    difficulty,
    botTurnTriggerRef.current  // ← ← ← НОВОЕ: триггер
  ]);

  const handleSelectCell = (row, col) => {
    if (currentPlayer !== 1 || gameOver || botThinking || animatingMove || isAnimatingRef.current) {
      console.log('⚠️ Ход заблокирован:', {
        currentPlayer,
        gameOver,
        botThinking,
        animatingMove: !!animatingMove,
        isAnimating: isAnimatingRef.current
      });
      return;
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
    const anyCapture = hasAnyCapture(board, 1);

    if (piece && piece.player === 1) {
      if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
        return;
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
      }
    }
  };

  const handleVictoryClose = () => {
    setVictoryModalVisible(false);
    navigation.goBack();
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

  const gameTypeName = gameType === 'giveaway' ? '🎯 Поддавки' : '♟️ Русские шашки';

  return (
    <View style={styles.container}>
      {/* Режим игры вверху */}
      <View style={styles.header}>
        <View style={styles.gameTypeIndicator}>
          <Text style={styles.gameTypeText}>{gameTypeName}</Text>
        </View>
      </View>

      {/* Инфо о противнике с индикатором хода */}
      <View style={styles.opponentInfo}>
        <Text style={styles.opponentAvatar}>🤖</Text>
        <Text style={styles.opponentName}>Бот</Text>
        {!isMyTurn && (
          <View style={styles.turnBadge}>
            <Text style={styles.turnBadgeText}>🤖 Думает...</Text>
          </View>
        )}
      </View>

      {/* Съеденные шашки бота (сверху) - бот съел мои шашки */}
      <View style={styles.capturedRow}>
        {Array.from({ length: player2Captured }).map((_, index) => (
          <View
            key={`bot-${index}`}
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

      {/* Съеденные шашки игрока (снизу) - я съел шашки бота */}
      <View style={styles.capturedRow}>
        {Array.from({ length: player1Captured }).map((_, index) => (
          <View
            key={`player-${index}`}
            style={[
              styles.capturedPiece,
              { backgroundColor: opponentPieceColor, borderColor: opponentPieceColor }
            ]}
          />
        ))}
      </View>

      <View style={styles.playerInfo}>
        <Text style={styles.playerAvatar}>{myAvatar}</Text>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{myName}</Text>
          <Text style={[styles.levelBadge, { color: getLevelColor(myLevel) }]}>
            ⭐ Ур. {myLevel}
          </Text>
        </View>
        {isMyTurn && (
          <View style={styles.turnBadge}>
            <Text style={styles.turnBadgeText}>⚡ Ваш ход</Text>
          </View>
        )}
      </View>

      {/* Кнопка сдаться */}
      <TouchableOpacity style={styles.giveUpButton} onPress={handleGiveUp}>
        <Text style={styles.giveUpText}>🚪 Сдаться</Text>
      </TouchableOpacity>

      <VictoryModal
        visible={victoryModalVisible}
        isWin={victoryData.isWin}
        expGained={victoryData.expGained}
        oldExp={victoryData.oldExp}
        onClose={handleVictoryClose}
      />
    </View>
  );

  // Обработка кнопки "Назад"
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGiveUp();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  function handleGiveUp() {
    Alert.alert(
      'Выйти из игры',
      'Вы уверены, что хотите выйти из игры?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
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
    justifyContent: 'center',
  },
  capturedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    maxWidth: 380,
    height: 80,
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
  opponentInfo: {
    position: 'absolute',
    top: 110,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    zIndex: 10,
  },
  opponentAvatar: { fontSize: 24, marginRight: 8 },
  opponentName: { fontSize: 16, color: colors.textLight, fontWeight: '600', marginRight: 10 },
  playerInfo: {
    position: 'absolute',
    bottom: 90,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    zIndex: 10,
  },
  playerAvatar: { fontSize: 24, marginRight: 8 },
  playerName: { fontSize: 14, color: colors.textLight, fontWeight: '600' },
  playerDetails: {
    flexDirection: 'column',
    marginRight: 10,
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
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
  giveUpButton: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: '#FF6B6B',
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
  giveUpText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});

export default BotGameScreen;