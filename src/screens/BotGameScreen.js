// src/screens/BotGameScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, BackHandler } from 'react-native';
import { getLevelColor } from '../utils/levelSystem';
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
import { useInvite } from '../context/InviteContext';
import { useDailyTasks } from '../context/DailyTasksContext';
import { get } from 'firebase/database';
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

    return () => {
      if (gameIdRef.current) {
        remove(ref(db, `bot_games/${gameIdRef.current}`)).catch(console.error);
       
      }
    };
  }, [userId, difficulty]);

  // Проверка окончания игры
  useEffect(() => {
    const endGame = async (resultMessage, winner = null, isTimeout = false) => {
      if (gameOver) return;
      setGameOver(true);


      // Показываем алерт если проиграли по таймауту
      if (isTimeout && winner === 2) {
        Alert.alert(
          'Время вышло',
          'Вы не сделали ход в течение 2 минут и автоматически проиграли.',
          [{ text: 'OK' }]
        );
      }

      let expGained = 0;
      let oldExp = 0;
      let hasNewGift = false;
      const isWin = winner === 1;

      // Начисление опыта
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
            // Победа игрока
            if (isFakeOpponent) {
              // Игра с "фейковым" соперником (бот вместо реального игрока) - начисляем как за онлайн
              expGained = EXP_REWARDS.WIN_ONLINE;
            } else {
              // Обычная игра с ботом
              if (difficulty === 'easy') expGained = EXP_REWARDS.WIN_BOT_EASY;
              else if (difficulty === 'medium') expGained = EXP_REWARDS.WIN_BOT_MEDIUM;
              else if (difficulty === 'hard') expGained = EXP_REWARDS.WIN_BOT_HARD;
              else if (difficulty === 'grandmaster') expGained = EXP_REWARDS.WIN_BOT_GRANDMASTER;
            }
          } else if (winner === 2) {
            // Поражение от бота
            if (isFakeOpponent) {
              // Игра с "фейковым" соперником - начисляем как за онлайн
              expGained = EXP_REWARDS.LOSE_ONLINE;
            } else {
              // Обычная игра с ботом
              expGained = EXP_REWARDS.LOSE_BOT;
            }
          }

          const updatedStats = {
            totalGames: currentTotalGames + 1,
            exp: currentExp + expGained,
          };
          if (winner === 1) {
            updatedStats.wins = currentWins + 1;
          }

          await update(userStatsRef, updatedStats);


          // Обновляем прогресс ежедневных заданий

          // Обновление серии побед
          try {
            const userRef = ref(db, `users/${userId}`);
            const userSnap = await get(userRef);
            const userData = userSnap.val() || {};
            const currentStreak = userData.winStreak || 0;

            if (winner === 1) {
              // Победа - увеличиваем серию
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
              }
              if (gameType === 'giveaway') {
                await updateProgress(TASK_TYPES.WIN_GIVEAWAY, 1, gameType);
              }
            } else if (winner === 2) {
              // Поражение - сбрасываем серию
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

          // Сыгранная игра (независимо от результата)
          await updateProgress(TASK_TYPES.PLAY_GAMES, 1);
          if (isFakeOpponent) {
            await updateProgress(TASK_TYPES.PLAY_ONLINE, 1);
          }
          if (gameType === 'giveaway') {
            await updateProgress(TASK_TYPES.PLAY_GIVEAWAY, 1, gameType);
          }

          // Подсчёт съеденных шашек
          const initialPiecesCount = 12;
          const player2Pieces = board.flat().filter(p => p && p.player === 2).length;
          const capturedByPlayer = initialPiecesCount - player2Pieces;
          if (capturedByPlayer > 0) {
            await updateProgress(TASK_TYPES.CAPTURE_PIECES, capturedByPlayer);
          }


          // Сохраняем историю начисления опыта
          const expHistoryRef = ref(db, `users/${userId}/expHistory`);
          const historySnap = await get(expHistoryRef);
          const history = historySnap.val() || [];

          const difficultyNames = {
            easy: 'Легкий',
            medium: 'Средний',
            hard: 'Сложный',
            grandmaster: 'Гроссмейстер'
          };

          const newEntry = {
            timestamp: Date.now(),
            gameType: gameType === 'giveaway' ? 'Поддавки' : 'Русские шашки',
            opponent: isFakeOpponent ? `${opponentName} (Уровень ${opponentLevel})` : `Бот (${difficultyNames[difficulty]})`,
            result: winner === 1 ? 'win' : 'lose',
            expGained: expGained,
          };

          history.unshift(newEntry); // Добавляем в начало
          if (history.length > 50) history.pop(); // Храним последние 50 записей

          // Проверяем, получил ли игрок новый подарок
          const oldLevel = getLevelFromExp(oldExp).level;
          const newLevel = getLevelFromExp(oldExp + expGained).level;
          const leveledUp = newLevel > oldLevel;

          const updateData = {
            expHistory: history,
          };

          // Добавляем подарок только если: 1) повысился уровень, 2) новый уровень кратен 5, 3) подарок существует
          if (leveledUp && newLevel % 5 === 0 && newLevel >= 5) {
            const { LEVEL_GIFTS } = require('../utils/giftSystem');
            if (LEVEL_GIFTS[newLevel]) {
              const userRef = ref(db, `users/${userId}`);
              const userSnap = await get(userRef);
              const userData = userSnap.val() || {};
              const newGifts = userData.newGifts || [];

              // Добавляем ID подарка в список новых, если его там ещё нет
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

      if (gameIdRef.current) {
        const botGameRef = ref(db, `bot_games/${gameIdRef.current}`);
       await update(botGameRef, {
      status: 'finished',
      finishedAt: Date.now(),
      result: winner === 1 ? 'player_win' : (winner === 2 ? 'bot_win' : 'draw'),
    }).catch(console.error);
      }

      // Показываем модальное окно победы
      setVictoryData({ isWin, expGained, oldExp, hasNewGift });
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
      }
    }

    setPendingBoard(null);
    setPendingMove(null);
  };

  const applyMove = (move) => {

    // Обновляем время последнего хода
    lastMoveTimeRef.current = Date.now();

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
      wasCapture: wasCapture,
    });
    isAnimatingRef.current = true;

  };

  // ← ← ← Ход бота (ИСПРАВЛЕННЫЙ)
  useEffect(() => {
    
    
    // ← ← ← ПРОВЕРКИ: когда бот должен ходить
    if (currentPlayer !== 2) {
      return;
    }
    
    if (gameOver) {
      return;
    }
    
    if (isAnimatingRef.current) {
      return;
    }
    
    if (isBotThinkingRef.current) {
      return;
    }

    // ← ← ← ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ – бот ходит!
    isBotThinkingRef.current = true;
    setBotThinking(true);

    const timeout = setTimeout(() => {
      try {
        let move = null;

        // ← ← ← Если есть продолжение серии взятий
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
          // ← ← ← Обычный ход бота
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

  // Таймер бездействия - проверяем каждые 10 секунд
  useEffect(() => {
    if (gameOver || currentPlayer !== 1) return;

    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceLastMove = now - lastMoveTimeRef.current;
      const TWO_MINUTES = 2 * 60 * 1000;

      // Если прошло больше 2 минут и сейчас ход игрока
      if (timeSinceLastMove >= TWO_MINUTES && currentPlayer === 1) {
        endGame('Вы не сделали ход вовремя', 2, true);
      }
    };

    // Проверяем каждые 10 секунд
    const interval = setInterval(checkInactivity, 10000);

    return () => clearInterval(interval);
  }, [gameOver, currentPlayer]);

  const handleSelectCell = (row, col) => {
    if (currentPlayer !== 1 || gameOver || botThinking || animatingMove || isAnimatingRef.current) {
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
    // Сбрасываем флаги приглашений после выхода из игры
    resetInviteFlags();
    // Перенаправляем на главный экран
    navigation.navigate('Menu');
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
        hasNewGift={victoryData.hasNewGift || false}
        playerSurrendered={victoryData.playerSurrendered || false}
        navigation={navigation}
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
      'Сдаться',
      'Вы уверены, что хотите сдаться?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сдаться',
          style: 'destructive',
          onPress: async () => {
            // Вызываем endGame с флагом сдачи (победа бота)
            if (gameIdRef.current) {
              try {
                await update(ref(db, `bot_games/${gameIdRef.current}`), {
                  status: 'finished',
                  finishedAt: Date.now(),
                  result: 'player_gave_up',
                });
              } catch (error) {
                console.error('Ошибка обновления bot_games:', error);
              }
            }
            // Показываем модальное окно с сообщением о сдаче (без начисления опыта)
            setGameOver(true);
            setVictoryData({ isWin: false, expGained: 0, oldExp: 0, hasNewGift: false, playerSurrendered: true });
            setVictoryModalVisible(true);
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
    zIndex: 5,
  },
  opponentAvatar: { fontSize: 24, marginRight: 8 },
  opponentName: { fontSize: 16, color: colors.textLight, fontWeight: '600', marginRight: 10 },
  opponentDetails: {
    flexDirection: 'column',
    marginRight: 10,
  },
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