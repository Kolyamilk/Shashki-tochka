// src/screens/BotGameScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, BackHandler, AppState } from 'react-native';
import { getLevelColor } from '../utils/levelSystem';
import { useFocusEffect } from '@react-navigation/native';
import { ref, set, remove, update, get, onValue, off } from 'firebase/database';
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
  checkDrawByTwoKings,
} from '../utils/checkersLogic';
import { getBestMove } from '../utils/botLogic';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';
import { useInvite } from '../context/InviteContext';
import { useDailyTasks } from '../context/DailyTasksContext';
import { EXP_REWARDS, getLevelFromExp } from '../utils/levelSystem';

const BotGameScreen = ({ route, navigation }) => {
  const { difficulty, botName, botLevel, botAvatar, isFakeOpponent } = route.params;
  const { myPieceColor, opponentPieceColor } = useSettings();
  const { userId } = useAuth();
  const { gameType } = useGameType();
  const { resetInviteFlags } = useInvite();
  const { updateProgress, TASK_TYPES } = useDailyTasks();

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
  const [victoryData, setVictoryData] = useState({ isWin: false, expGained: 0, oldExp: 0, hasNewGift: false, playerSurrendered: false });
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [myLevel, setMyLevel] = useState(1);
  const [myName, setMyName] = useState('Вы');
  const [myAvatar, setMyAvatar] = useState('😀');
  const [opponentName, setOpponentName] = useState(botName || 'Бот');
  const [opponentLevel, setOpponentLevel] = useState(botLevel || 1);
  const [opponentAvatar, setOpponentAvatar] = useState(botAvatar || '🤖');

  const isAnimatingRef = useRef(false);
  const isBotThinkingRef = useRef(false);
  const gameIdRef = useRef(null);
  const botTurnTriggerRef = useRef(0);
  const lastMoveTimeRef = useRef(Date.now());
  const appStateRef = useRef(AppState.currentState);
  const backgroundTimeRef = useRef(null);
  const hasPlayerMovedRef = useRef(false);

  // Реальное состояние подключения к Firebase (чтобы endGame не зависал в офлайне)
  const isFirebaseConnectedRef = useRef(true);

  // Реальное подключение к Firebase (интернет/соединение пропало — endGame не должен зависать)
  useEffect(() => {
    const firebaseConnectionRef = ref(db, '.info/connected');
    const unsubscribe = onValue(
      firebaseConnectionRef,
      (snapshot) => {
        const connected = snapshot.val() === true;
        isFirebaseConnectedRef.current = connected;
      },
      (error) => {
        console.error('Ошибка слушателя .info/connected:', error);
        isFirebaseConnectedRef.current = false;
      }
    );

    return () => {
      off(firebaseConnectionRef);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Количество съеденных шашек (для отображения)
  const initialPiecesCount = 12;
  const player1Pieces = board.flat().filter(p => p && p.player === 1).length;
  const player2Pieces = board.flat().filter(p => p && p.player === 2).length;
  const player1Captured = initialPiecesCount - player2Pieces;
  const player2Captured = initialPiecesCount - player1Pieces;

  // ---- ВЫНОСИМ endGame НА УРОВЕНЬ КОМПОНЕНТА (useCallback) ----
  const endGame = useCallback(async (resultMessage, winner = null, isTimeout = false, isSurrender = false) => {
    if (gameOver) return;
    setGameOver(true);

    if (isTimeout && winner === 2) {
      Alert.alert(
        'Время вышло',
        'Вы не сделали ход в течение 1 минуты и автоматически проиграли.',
        [{ text: 'OK' }]
      );
    }

    // Если интернета нет — не выполняем любые firebase-запросы,
    // чтобы endGame не подвисал и модалка "Вы сдались/проиграли/выиграли" показывалась сразу.
    if (!isFirebaseConnectedRef.current) {
      const isWin = winner === 1;
      setVictoryData({
        isWin,
        expGained: 0,
        oldExp: 0,
        hasNewGift: false,
        playerSurrendered: isSurrender,
        isDraw: winner === null,
      });
      setVictoryModalVisible(true);
      return;
    }

    let expGained = 0;
    let oldExp = 0;
    let hasNewGift = false;
    const isWin = winner === 1;

    // Начисление опыта и обновление статистики
    if (userId && winner !== null) {
      try {
        const userStatsRef = ref(db, `users/${userId}/stats`);
        const statsSnap = await get(userStatsRef);
        const stats = statsSnap.val() || { totalGames: 0, wins: 0, exp: 0 };
        const currentExp = stats.exp || 0;
        const currentTotalGames = stats.totalGames || 0;
        const currentWins = stats.wins || 0;
        oldExp = currentExp;

        if (winner === 1) {
          if (isFakeOpponent) {
            expGained = EXP_REWARDS.WIN_ONLINE;
          } else {
            if (difficulty === 'easy') expGained = EXP_REWARDS.WIN_BOT_EASY;
            else if (difficulty === 'medium') expGained = EXP_REWARDS.WIN_BOT_MEDIUM;
            else if (difficulty === 'hard') expGained = EXP_REWARDS.WIN_BOT_HARD;
            else if (difficulty === 'grandmaster') expGained = EXP_REWARDS.WIN_BOT_GRANDMASTER;
          }
        } else if (winner === 2) {
          // Если игрок сдался — опыт не начисляется
          if (isSurrender) {
            expGained = 0;
          } else if (isFakeOpponent) {
            expGained = EXP_REWARDS.LOSE_ONLINE;
          } else {
            expGained = EXP_REWARDS.LOSE_BOT;
          }
        }

        const updatedStats = {
          totalGames: currentTotalGames + 1,
          exp: currentExp + expGained,
        };
        if (winner === 1) updatedStats.wins = currentWins + 1;
        await update(userStatsRef, updatedStats);

        // Обновление серии побед
        try {
          const userRef = ref(db, `users/${userId}`);
          const userSnap = await get(userRef);
          const userData = userSnap.val() || {};
          const currentStreak = userData.winStreak || 0;

          if (winner === 1) {
            const newStreak = currentStreak + 1;
            await update(userRef, { winStreak: newStreak });
            await updateProgress(TASK_TYPES.WIN_GAMES, 1);
            await updateProgress(TASK_TYPES.WIN_STREAK, newStreak);
            if (isFakeOpponent) {
              await updateProgress(TASK_TYPES.WIN_ONLINE, 1);
            } else {
              await updateProgress(TASK_TYPES.WIN_BOT, 1);
              if (difficulty === 'hard' || difficulty === 'grandmaster') {
                await updateProgress(TASK_TYPES.WIN_BOT_HARD, 1);
              } else if (difficulty === 'medium') {
                await updateProgress(TASK_TYPES.WIN_BOT_MEDIUM, 1);
              }
              if (gameType === 'giveaway') {
                await updateProgress(TASK_TYPES.WIN_BOT_GIVEAWAY, 1, gameType);
              } else {
                await updateProgress(TASK_TYPES.WIN_BOT_CLASSIC, 1);
              }
            }
            if (gameType === 'giveaway') {
              await updateProgress(TASK_TYPES.WIN_GIVEAWAY, 1, gameType);
            }
          } else if (winner === 2) {
            if (currentStreak > 0) {
              await update(userRef, { winStreak: 0 });
              await updateProgress(TASK_TYPES.WIN_STREAK, 0);
            }
            if (!isFakeOpponent) {
              await updateProgress(TASK_TYPES.LOSE_BOT, 1);
            }
          }
        } catch (error) {
          console.error('Ошибка обновления серии побед:', error);
        }

        await updateProgress(TASK_TYPES.PLAY_GAMES, 1);
        if (isFakeOpponent) await updateProgress(TASK_TYPES.PLAY_ONLINE, 1);
        if (gameType === 'giveaway') await updateProgress(TASK_TYPES.PLAY_GIVEAWAY, 1, gameType);

        const capturedByPlayer = initialPiecesCount - player2Pieces;
        if (capturedByPlayer > 0) {
          await updateProgress(TASK_TYPES.CAPTURE_PIECES, capturedByPlayer);
        }

        // История опыта
        const expHistoryRef = ref(db, `users/${userId}/expHistory`);
        const historySnap = await get(expHistoryRef);
        const history = historySnap.val() || [];
        const difficultyNames = { easy: 'Легкий', medium: 'Средний', hard: 'Сложный', grandmaster: 'Гроссмейстер' };
        const newEntry = {
          timestamp: Date.now(),
          gameType: gameType === 'giveaway' ? 'Поддавки' : 'Русские шашки',
          opponent: isFakeOpponent ? `${opponentName} (Ур. ${opponentLevel})` : `Бот (${difficultyNames[difficulty]})`,
          result: winner === 1 ? 'win' : 'lose',
          expGained,
        };
        history.unshift(newEntry);
        if (history.length > 50) history.pop();

        const oldLevel = getLevelFromExp(oldExp).level;
        const newLevel = getLevelFromExp(oldExp + expGained).level;
        const leveledUp = newLevel > oldLevel;

        const updateData = { expHistory: history };
        if (leveledUp) {
          const userRef = ref(db, `users/${userId}`);
          const userSnap = await get(userRef);
          const userData = userSnap.val() || {};
          const currentTokens = userData.taskRefreshTokens || 0;
          updateData.taskRefreshTokens = currentTokens + 1;
        }
        if (leveledUp && newLevel % 5 === 0 && newLevel >= 5) {
          const { LEVEL_GIFTS } = require('../utils/giftSystem');
          if (LEVEL_GIFTS[newLevel]) {
            const userRef = ref(db, `users/${userId}`);
            const userSnap = await get(userRef);
            const userData = userSnap.val() || {};
            const newGifts = userData.newGifts || [];
            const giftId = `gift_level_${newLevel}`;
            if (!newGifts.includes(giftId)) {
              updateData.newGifts = [...newGifts, giftId];
              hasNewGift = true;
            }
          }
        }
        await update(ref(db, `users/${userId}`), updateData);
      } catch (error) {
        console.error('Ошибка начисления опыта:', error);
      }
    }

    // Ничья (обновление заданий без опыта)
    if (userId && winner === null) {
      try {
        const userRef = ref(db, `users/${userId}`);
        const userSnap = await get(userRef);
        const userData = userSnap.val() || {};
        const currentStreak = userData.winStreak || 0;
        if (currentStreak > 0) {
          await update(userRef, { winStreak: 0 });
          await updateProgress(TASK_TYPES.WIN_STREAK, 0);
        }
        await updateProgress(TASK_TYPES.PLAY_GAMES, 1);
        if (isFakeOpponent) await updateProgress(TASK_TYPES.PLAY_ONLINE, 1);
        if (gameType === 'giveaway') await updateProgress(TASK_TYPES.PLAY_GIVEAWAY, 1, gameType);
        const capturedByPlayer = initialPiecesCount - player2Pieces;
        if (capturedByPlayer > 0) {
          await updateProgress(TASK_TYPES.CAPTURE_PIECES, capturedByPlayer);
        }
      } catch (error) {
        console.error('Ошибка обновления заданий при ничьей:', error);
      }
    }

    if (gameIdRef.current) {
      const botGameRef = ref(db, `bot_games/${gameIdRef.current}`);
      await update(botGameRef, {
        status: 'finished',
        finishedAt: Date.now(),
        result: winner === 1 ? 'player_win' : (winner === 2 ? 'bot_win' : 'draw'),
      }).catch(console.error);
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    setVictoryData({ isWin, expGained, oldExp, hasNewGift, playerSurrendered: isSurrender, isDraw: winner === null });
    setVictoryModalVisible(true);
  }, [gameOver, userId, board, difficulty, gameType, opponentName, opponentLevel, isFakeOpponent, updateProgress, TASK_TYPES, player2Pieces]);

  // ---- Эффект создания игры в базе ----
  useEffect(() => {
    if (!userId) return;
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

    return () => {
      if (gameIdRef.current) {
        remove(ref(db, `bot_games/${gameIdRef.current}`)).catch(console.error);
      }
    };
  }, [userId, difficulty]);

  // ---- Проверка окончания игры (вызывает endGame) ----
  useEffect(() => {
    if (gameType === 'giveaway') {
      const winner1 = checkGiveawayWinner(board, 1);
      const winner2 = checkGiveawayWinner(board, 2);
      if (winner1 && winner2) endGame('Ничья!', null);
      else if (winner1) endGame('Вы победили!', 1);
      else if (winner2) endGame('Компьютер победил!', 2);
    } else {
      if (checkDrawByTwoKings(board)) {
        endGame('Ничья! (остались две дамки)', null);
        return;
      }
      if (!hasMoves(board, 1) && !hasMoves(board, 2)) endGame('Ничья!', null);
      else if (!hasMoves(board, 1)) endGame('Вы проиграли!', 2);
      else if (!hasMoves(board, 2)) endGame('Вы выиграли!', 1);
    }
  }, [board, gameType, endGame]);

  // ---- Таймер хода игрока (единый) ----
  useEffect(() => {
    if (gameOver || currentPlayer !== 1) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMove = now - lastMoveTimeRef.current;
      const remaining = Math.max(0, 60 - Math.floor(timeSinceLastMove / 1000));
      setTimeRemaining(remaining);
      if (timeSinceLastMove >= 60000) {
        clearInterval(interval);
        endGame('Время вышло', 2, true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [gameOver, currentPlayer, endGame]);

  // ---- Отслеживание сворачивания приложения (доп. проверка) ----
  useEffect(() => {
    if (gameOver) return;
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        backgroundTimeRef.current = Date.now();
      } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (backgroundTimeRef.current && currentPlayer === 1) {
          const timeSinceLastMove = Date.now() - lastMoveTimeRef.current;
          if (timeSinceLastMove >= 60000) {
            endGame('Время вышло', 2, true);
          }
        }
        backgroundTimeRef.current = null;
      }
      appStateRef.current = nextAppState;
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [gameOver, currentPlayer, endGame]);

  // ---- Анимация и применение хода ----
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
        setSelectedCell({ row: move.toRow, col: move.toCol });
        setValidMoves(furtherCaptures);
      } else {
        isBotThinkingRef.current = false;
        setBotThinking(false);
      }
    } else {
      const nextPlayer = currentPlayer === 1 ? 2 : 1;
      setCurrentPlayer(nextPlayer);
      if (nextPlayer === 1) {
        lastMoveTimeRef.current = Date.now();
        setTimeRemaining(60);
      }
      setCurrentPiecePos(null);
      setSelectedCell(null);
      setValidMoves([]);
      isBotThinkingRef.current = false;
      setBotThinking(false);
      if (nextPlayer === 2) {
        botTurnTriggerRef.current += 1;
      }
    }
    setPendingBoard(null);
    setPendingMove(null);
  };

  const applyMove = (move) => {
    lastMoveTimeRef.current = Date.now();
    setTimeRemaining(60);
    if (currentPlayer === 1) {
      hasPlayerMovedRef.current = true;
    }
    setSelectedCell(null);
    setValidMoves([]);

    const newBoard = board.map(r => [...r]);
    const piece = newBoard[move.fromRow]?.[move.fromCol];
    if (!piece) {
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
      wasCapture,
    });
    isAnimatingRef.current = true;
  };

  // ---- Ход бота ----
  useEffect(() => {
    if (currentPlayer !== 2) return;
    if (gameOver) return;
    if (isAnimatingRef.current) return;
    if (isBotThinkingRef.current) return;

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
          move = getBestMove(board, 2, difficulty, gameType);
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
        console.error('Ошибка в ходе бота:', error);
        isBotThinkingRef.current = false;
        setBotThinking(false);
      }
    }, difficulty === 'easy' ? 400 : difficulty === 'medium' ? 500 : difficulty === 'hard' ? 700 : 900);

    return () => clearTimeout(timeout);
  }, [currentPlayer, gameOver, board, currentPiecePos, difficulty, gameType]);

  // ---- Обработка выбора клетки игроком ----
  const handleSelectCell = (row, col) => {
    if (currentPlayer !== 1 || gameOver || botThinking || animatingMove || isAnimatingRef.current) return;
    const isPlayableCell = (row + col) % 2 === 1;
    if (!isPlayableCell) return;

    if (currentPiecePos) {
      if (row === currentPiecePos.row && col === currentPiecePos.col) return;
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
      if (selectedCell && selectedCell.row === row && selectedCell.col === col) return;
      setSelectedCell({ row, col });
      const moves = getValidMovesForPiece(board, row, col, 1, anyCapture);
      setValidMoves(moves);
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
    resetInviteFlags();
    navigation.navigate('Menu');
  };

  // Подсветка возможных взятий
  let captureMap = {};
  if (currentPlayer === 1 && !gameOver && !animatingMove && !isAnimatingRef.current) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.player === 1 && getCaptureMoves(board, r, c, 1).length > 0) {
          captureMap[`${r}-${c}`] = true;
        }
      }
    }
  }

  const isMyTurn = currentPlayer === 1;
  const gameTypeName = gameType === 'giveaway' ? '🎯 Поддавки' : '♟️ Русские шашки';

  // Кнопка сдаться
  const handleGiveUp = () => {
    Alert.alert(
      'Сдаться',
      'Вы уверены, что хотите сдаться?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сдаться',
          style: 'destructive',
          onPress: () => {
            endGame('Вы сдались', 2, false, true);
          },
        },
      ]
    );
  };

  // Кнопка "Назад" на Android
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.gameTypeIndicator}>
          <Text style={styles.gameTypeText}>{gameTypeName}</Text>
        </View>
      </View>

      <View style={styles.opponentInfo}>
        <Text style={styles.opponentAvatar}>{opponentAvatar}</Text>
        <View style={styles.opponentDetails}>
          <Text style={styles.opponentName}>{opponentName}</Text>
          {isFakeOpponent && (
            <Text style={[styles.levelBadge, { color: getLevelColor(opponentLevel) }]}>
              ⭐ Ур. {opponentLevel}
            </Text>
          )}
        </View>
        {!isMyTurn && (
          <View style={styles.turnBadge}>
            <Text style={styles.turnBadgeText}>🤖 Думает...</Text>
          </View>
        )}
      </View>

      <View style={styles.capturedRow}>
        {Array.from({ length: player2Captured }).map((_, index) => (
          <View
            key={`bot-${index}`}
            style={[styles.capturedPiece, { backgroundColor: myPieceColor, borderColor: myPieceColor }]}
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

      <View style={styles.capturedRow}>
        {Array.from({ length: player1Captured }).map((_, index) => (
          <View
            key={`player-${index}`}
            style={[styles.capturedPiece, { backgroundColor: opponentPieceColor, borderColor: opponentPieceColor }]}
          />
        ))}
      </View>

      <View style={styles.playerInfo}>
        <Text style={styles.playerAvatar}>{myAvatar}</Text>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{myName}</Text>
          <Text style={[styles.levelBadge, { color: getLevelColor(myLevel) }]}>⭐ Ур. {myLevel}</Text>
        </View>
        {isMyTurn && (
          <View style={styles.turnBadge}>
            <Text style={styles.turnBadgeText}>⚡ Ваш ход</Text>
          </View>
        )}
      </View>

      {isMyTurn && timeRemaining <= 30 && (
        <View style={[styles.timerContainer, timeRemaining < 30 && styles.timerContainerWarning]}>
          <Text style={styles.timerText}>⏱️ {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.giveUpButton} onPress={handleGiveUp}>
        <Text style={styles.giveUpText}>🚪 Сдаться</Text>
      </TouchableOpacity>

      <VictoryModal
        visible={victoryModalVisible}
        isWin={victoryData.isWin}
        expGained={victoryData.expGained}
        oldExp={victoryData.oldExp}
        onClose={handleVictoryClose}
        hasNewGift={victoryData.hasNewGift || false}
        playerSurrendered={victoryData.playerSurrendered || false}
        navigation={navigation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a2a3a', alignItems: 'center', justifyContent: 'center' },
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
  header: { position: 'absolute', top: 50, alignItems: 'center', zIndex: 10 },
  gameTypeIndicator: { backgroundColor: '#2c3e50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  gameTypeText: { fontSize: 15, fontWeight: '600', color: '#4ECDC4' },
  opponentInfo: {
    position: 'absolute',
    top: 110,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    zIndex: 5,
  },
  opponentAvatar: { fontSize: 24, marginRight: 8 },
  opponentName: { fontSize: 16, color: colors.textLight, fontWeight: '600', marginRight: 10 },
  opponentDetails: { flexDirection: 'column', marginRight: 10 },
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
  playerDetails: { flexDirection: 'column', marginRight: 10 },
  levelBadge: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  turnBadge: { backgroundColor: '#4ECDC4', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15 },
  turnBadgeText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  timerContainer: {
    position: 'absolute',
    bottom: 140,
    backgroundColor: '#FFC107',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  timerContainerWarning: { backgroundColor: '#FF6B6B', borderWidth: 2, borderColor: '#fff' },
  timerText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
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
