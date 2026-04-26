// src/screens/OnlineGameScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ref, onValue, update, off, remove, get } from 'firebase/database';
import { db } from '../firebase/config';
import Board from '../components/Board';
import VictoryModal from '../components/VictoryModal';
import { useInvite } from '../context/InviteContext';
import { useDailyTasks } from '../context/DailyTasksContext';
import {
  initialBoard,
  getValidMovesForPiece,
  getCaptureMoves,
  hasAnyCapture,
  hasMoves,
  BOARD_SIZE
} from '../utils/checkersLogic';
import { EXP_REWARDS, getLevelFromExp, getLevelColor } from '../utils/levelSystem';
import { colors } from '../styles/globalStyles';
import { useSettings } from '../context/SettingsContext';

const cleanupGame = async (gameId) => { /* ... без изменений ... */ };
const updateStats = async (winnerId, loserId, isSurrender = false) => { /* ... без изменений ... */ };

const OnlineGameScreen = ({ route, navigation }) => {
  const { gameId, playerKey, myRole } = route.params;
  const { myPieceColor, opponentPieceColor } = useSettings();
  const [board, setBoard] = useState(initialBoard());
  const { resetInviteFlags } = useInvite();
  const { updateProgress, TASK_TYPES } = useDailyTasks();
  const [gameData, setGameData] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [captured, setCaptured] = useState({ white: 0, black: 0 });
  const [opponentName, setOpponentName] = useState('');
  const [opponentAvatar, setOpponentAvatar] = useState('');
  const [opponentLevel, setOpponentLevel] = useState(1);
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState('');
  const [myLevel, setMyLevel] = useState(1);
  const [victoryModalVisible, setVictoryModalVisible] = useState(false);
  const [victoryData, setVictoryData] = useState({ isWin: false, expGained: 0, oldExp: 0, opponentLeft: false });

  const [animatingMove, setAnimatingMove] = useState(null);
  const [pendingBoard, setPendingBoard] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [currentPiecePos, setCurrentPiecePos] = useState(null);
  
  const isAnimatingRef = useRef(false);
  const isGameEnding = useRef(false);
  const isCleanupDone = useRef(false);
  const currentGameIdRef = useRef(gameId);
  const isInitialized = useRef(false);
  const lastBoardRef = useRef(null);
  const lastMoveWasMineRef = useRef(false);

  const endGame = async (resultMessage, winnerId = null, loserId = null, isSurrender = false) => {
    if (isGameEnding.current) return;
    isGameEnding.current = true;

    let expGained = 0;
    let oldExp = 0;
    const isWin = winnerId === playerKey;

    if (winnerId && loserId) {
      try {
        const { winnerOldExp, loserOldExp, winnerExpGain } = await updateStats(winnerId, loserId, isSurrender);
        if (isWin) {
          expGained = winnerExpGain;
          oldExp = winnerOldExp;
        } else {
          expGained = 0;
          oldExp = loserOldExp;
        }
      } catch (err) {
        console.error('Ошибка обновления статистики:', err);
      }

      try {
        await update(ref(db, `games_checkers/${gameId}`), {
          status: 'finished',
          winner: winnerId,
          loser: loserId,
          surrendered: isSurrender ? loserId : null,
          finishedAt: Date.now(),
        });
      } catch (err) {
        console.error('Ошибка обновления статуса игры:', err);
      }
    }

    // Обновляем прогресс ежедневных заданий
    console.log('📋 Обновление прогресса заданий:', { isWin, gameType: gameData?.gameType });

    if (isWin) {
      // Победа
      await updateProgress(TASK_TYPES.WIN_GAMES, 1);
      await updateProgress(TASK_TYPES.WIN_ONLINE, 1);
      if (gameData?.gameType === 'giveaway') {
        await updateProgress(TASK_TYPES.WIN_GIVEAWAY, 1, 'giveaway');
      }
    }
    // Сыгранная игра (независимо от результата)
    await updateProgress(TASK_TYPES.PLAY_GAMES, 1);
    await updateProgress(TASK_TYPES.PLAY_ONLINE, 1);
    await updateProgress(TASK_TYPES.PLAY_WITH_FRIEND, 1);
    if (gameData?.gameType === 'giveaway') {
      await updateProgress(TASK_TYPES.PLAY_GIVEAWAY, 1, 'giveaway');
    }

    // Подсчёт съеденных шашек
    const myCaptured = myRole === 1 ? captured.black : captured.white;
    if (myCaptured > 0) {
      await updateProgress(TASK_TYPES.CAPTURE_PIECES, myCaptured);
    }

    console.log('✅ Прогресс заданий обновлён');

    setVictoryData({ isWin, expGained, oldExp, opponentLeft: false });
    setVictoryModalVisible(true);
  };

  const handleVictoryClose = async () => {
    setVictoryModalVisible(false);
    if (!isCleanupDone.current) {
      isCleanupDone.current = true;
      await cleanupGame(gameId);
    }
    resetInviteFlags();
    navigation.replace('Menu');
  };

  useEffect(() => {
    console.log('🎮 OnlineGameScreen загружен с params:', route.params);
    currentGameIdRef.current = gameId;
  }, []);

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
    
    lastBoardRef.current = finalBoard;
    
    console.log('✅ Анимация завершена, isAnimatingRef:', isAnimatingRef.current);

    if (furtherCaptures.length > 0 && wasCapture) {
      setCurrentPiecePos({ row: move.toRow, col: move.toCol });
      setSelectedCell(null);
      setValidMoves(furtherCaptures);
    } else {
      setCurrentPiecePos(null);
      setSelectedCell(null);
      setValidMoves([]);
    }

    setPendingBoard(null);
    setPendingMove(null);
  };

  const applyMove = (move) => {
    if (!gameData) {
      console.error('❌ Ошибка: gameData отсутствует');
      return;
    }

    setSelectedCell(null);
    setValidMoves([]);

    const newBoard = board.map(r => [...r]);
    const piece = newBoard[move.fromRow]?.[move.fromCol];
    if (!piece) {
      console.error('❌ Ошибка: нет фигуры в начальной клетке');
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

    const furtherCaptures = getCaptureMoves(newBoard, move.toRow, move.toCol, myRole);
    const wasCapture = move.capturedRow !== undefined && move.capturedCol !== undefined;

    let nextPlayer = null;
    if (!(furtherCaptures.length > 0 && wasCapture)) {
      nextPlayer = Object.keys(gameData.players).find(p => p !== playerKey);
    } else {
      nextPlayer = playerKey;
    }

    const currentCaptured = captured || { white: 0, black: 0 };
    const newCaptured = { ...currentCaptured };
    if (wasCapture) {
      if (myRole === 1) newCaptured.black += 1;
      else newCaptured.white += 1;
    }

    const updates = {
      board: newBoard,
      currentPlayer: nextPlayer,
      captured: newCaptured,
    };

    lastMoveWasMineRef.current = true;
    console.log('🎯 Мой ход отправляется в Firebase');

    update(ref(db, 'games_checkers/' + gameId), updates).catch(err => 
      console.error('Ошибка отправки хода:', err)
    );

    setPendingBoard(newBoard);
    setPendingMove({ move, wasCapture, furtherCaptures, willBeKing, nextPlayer });

    setAnimatingMove({
      from: { row: move.fromRow, col: move.fromCol },
      to: { row: move.toRow, col: move.toCol },
      piece: { ...piece, king: newKing },
      wasCapture: wasCapture,
    });
    isAnimatingRef.current = true;

    console.log('🎬 Анимация ВАШЕГО хода запущена');

    const opponentPlayer = myRole === 1 ? 2 : 1;
    const opponentHasMoves = hasMoves(newBoard, opponentPlayer);
    const currentPlayerHasMoves = hasMoves(newBoard, myRole);

    if (!opponentHasMoves) {
      const opponentId = Object.keys(gameData.players).find(p => p !== playerKey);
      endGame('Вы выиграли!', playerKey, opponentId);
    } else if (!currentPlayerHasMoves) {
      const opponentId = Object.keys(gameData.players).find(p => p !== playerKey);
      endGame('Вы проиграли!', opponentId, playerKey);
    }
  };

  useEffect(() => {
    const loadMyData = async () => {
      if (!playerKey) return;
      const userRef = ref(db, `users/${playerKey}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setMyName(data.name || 'Игрок');
        setMyAvatar(data.avatar || '😀');
        setMyLevel(getLevelFromExp(data.stats?.exp || 0).level);
      }
    };
    loadMyData();
  }, [playerKey]);

  useEffect(() => {
    if (gameData?.players) {
      const playerIds = Object.keys(gameData.players);
      const opponentId = playerIds.find(id => id !== playerKey);
      if (opponentId && !opponentName) {
        const loadOpponentData = async () => {
          const userRef = ref(db, `users/${opponentId}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const oppData = snapshot.val();
            setOpponentName(oppData.name || 'Соперник');
            setOpponentAvatar(oppData.avatar || '😎');
            setOpponentLevel(getLevelFromExp(oppData.stats?.exp || 0).level);
          }
        };
        loadOpponentData();
      }
    }
  }, [gameData, playerKey]);

  // Исправленный useEffect для подписки на Firebase
  useEffect(() => {
    const gameRef = ref(db, 'games_checkers/' + gameId);
    const unsubscribe = onValue(gameRef, async (snapshot) => {
      const data = snapshot.val();

      if (currentGameIdRef.current !== gameId) {
        console.log('⚠️ Stale listener для gameId:', gameId);
        return;
      }

      if (!data) {
        if (!isInitialized.current) {
          console.log('⏳ Ожидание создания игры...');
          return;
        }
        if (!isGameEnding.current && !isCleanupDone.current) {
          console.log('⚠️ Игра удалена из Firebase до завершения, игнорирую.');
          isCleanupDone.current = true;
        }
        return;
      }

      if (!isInitialized.current) isInitialized.current = true;

      // Проверяем, сдался ли противник
      if (data.status === 'finished' && !isGameEnding.current) {
        console.log('🏁 Игра завершена на сервере');
        isGameEnding.current = true;

        const isWin = data.winner === playerKey;
        let expGained = 0;
        let oldExp = 0;
        let opponentLeft = false;

        if (data.surrendered) {
          console.log('🚪 Противник сдался');
          opponentLeft = true;
          if (isWin) {
            const myStatsRef = ref(db, `users/${playerKey}/stats`);
            const myStatsSnap = await get(myStatsRef);
            const myStats = myStatsSnap.val() || { exp: 0 };
            oldExp = myStats.exp || 0;
            expGained = EXP_REWARDS.WIN_ONLINE;
          }
        }

        setVictoryData({ isWin, expGained, oldExp, opponentLeft });
        setVictoryModalVisible(true);
        return;
      }

      if (!data.board || !Array.isArray(data.board)) {
        console.log('⏳ Доска ещё не создана или некорректна, жду...');
        return;
      }

      setGameData(data);
      setCaptured(data.captured || { white: 0, black: 0 });

      const newBoard = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (data.board[r] && data.board[r][c]) newBoard[r][c] = data.board[r][c];
        }
      }

      const boardToCompare = lastBoardRef.current || newBoard;
      const hasChanged = lastBoardRef.current ? JSON.stringify(boardToCompare) !== JSON.stringify(newBoard) : false;

      const wasMyLastMove = lastMoveWasMineRef.current;

      console.log('📊 Firebase update:', {
        hasChanged,
        isAnimating: isAnimatingRef.current,
        wasMyLastMove,
        hasLastBoard: !!lastBoardRef.current,
        currentPlayer: data.currentPlayer,
        myKey: playerKey
      });

      // ★★★ ИСПРАВЛЕНИЕ: убрано условие data.currentPlayer !== playerKey ★★★
      if (hasChanged && !isAnimatingRef.current && !wasMyLastMove && lastBoardRef.current) {
        console.log('🎬 Запуск анимации хода соперника...');

        // Сбрасываем состояние анимации перед началом
        setAnimatingMove(null);

        let from = null, to = null, movedPiece = null;
        let capturedPositions = [];

        // Сначала находим все изменения
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const oldPiece = boardToCompare[r]?.[c];
            const newPiece = newBoard[r][c];

            // Шашка исчезла
            if (oldPiece && !newPiece) {
              // Определяем, это исходная позиция или съеденная шашка
              if (oldPiece.player !== myRole) {
                // Это шашка противника - исходная позиция
                from = { row: r, col: c };
                movedPiece = oldPiece;
              } else {
                // Это моя шашка - была съедена
                capturedPositions.push({ row: r, col: c });
              }
            }
            // Шашка появилась
            else if (!oldPiece && newPiece) {
              to = { row: r, col: c };
            }
          }
        }

        if (from && to && movedPiece) {
          const isOpponentMove = movedPiece.player !== myRole;

          console.log('📍 Найдено:', { from, to, movedPiece, isOpponentMove, capturedPositions });

          if (isOpponentMove) {
            let wasCapture = capturedPositions.length > 0;
            let capturedRow = wasCapture ? capturedPositions[0].row : null;
            let capturedCol = wasCapture ? capturedPositions[0].col : null;

            const willBeKing = (!movedPiece.king && ((movedPiece.player === 1 && to.row === 7) || (movedPiece.player === 2 && to.row === 0)));
            const newKing = movedPiece.king ? true : willBeKing;

            const tempBoard = newBoard.map(r => [...r]);
            if (willBeKing) tempBoard[to.row][to.col].king = true;
            const furtherCaptures = getCaptureMoves(tempBoard, to.row, to.col, movedPiece.player);

            setPendingBoard(newBoard);
            setPendingMove({
              move: { fromRow: from.row, fromCol: from.col, toRow: to.row, toCol: to.col, capturedRow, capturedCol },
              wasCapture,
              furtherCaptures,
              willBeKing,
              nextPlayer: data.currentPlayer,
            });
            setAnimatingMove({ from, to, piece: { ...movedPiece, king: newKing }, wasCapture });
            isAnimatingRef.current = true;
            console.log('✅ Анимация соперника запущена');
          } else {
            console.log('⚠️ Это был мой ход (уже анимирован), просто обновляем доску');
            setBoard(newBoard);
          }
        } else {
          console.log('⚠️ Не удалось определить ход соперника');
          setBoard(newBoard);
        }
      } else if (hasChanged) {
        console.log('📊 Обновление доски (ваш ход или анимация идёт)');
        setBoard(newBoard);
      }

      lastBoardRef.current = newBoard;
      lastMoveWasMineRef.current = false;
      
      console.log('💾 lastBoardRef сохранён, hasLastBoard:', !!lastBoardRef.current);

      setLoading(false);
      if (data.currentPlayer !== playerKey) {
        setSelectedCell(null);
        setValidMoves([]);
      }
    });

    return () => {
      console.log('🧹 OnlineGameScreen размонтирован');
      unsubscribe();
    };
  }, [gameId, playerKey, myRole]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGiveUp();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [gameData, playerKey])
  );

  const handleSelectCell = (row, col) => {
    if (!gameData || gameData.currentPlayer !== playerKey || animatingMove || isAnimatingRef.current) return;

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
    const anyCapture = hasAnyCapture(board, myRole);

    if (piece && piece.player === myRole) {
      if (selectedCell && selectedCell.row === row && selectedCell.col === col) return;
      setSelectedCell({ row, col });
      const moves = getValidMovesForPiece(board, row, col, myRole, anyCapture);
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

  const handleGiveUp = async () => {
    Alert.alert(
      'Сдаться',
      'Вы уверены? Сопернику будет засчитана победа.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сдаться',
          style: 'destructive',
          onPress: async () => {
            if (!gameData || !gameData.players) {
              console.error('❌ gameData не загружен');
              navigation.replace('Menu');
              return;
            }

            isGameEnding.current = true;
            const opponentId = Object.keys(gameData.players).find(p => p !== playerKey);

            if (opponentId) {
              try {
                // Обновляем статистику противника (победа)
                const opponentRef = ref(db, `users/${opponentId}/stats`);
                const opponentSnap = await get(opponentRef);
                const opponentStats = opponentSnap.val() || { totalGames: 0, wins: 0, exp: 0 };
                const opponentOldExp = opponentStats.exp || 0;
                const opponentExpGain = EXP_REWARDS.WIN_ONLINE;

                await update(opponentRef, {
                  totalGames: opponentStats.totalGames + 1,
                  wins: opponentStats.wins + 1,
                  exp: opponentOldExp + opponentExpGain,
                });

                // Добавляем запись в историю противника
                const opponentUserSnap = await get(ref(db, `users/${opponentId}`));
                const opponentUserData = opponentUserSnap.val() || {};
                const opponentHistory = opponentUserData.expHistory || [];
                const opponentEntry = {
                  timestamp: Date.now(),
                  gameType: gameData.gameType === 'giveaway' ? 'Поддавки' : 'Русские шашки',
                  opponent: `${myName || 'Игрок'} (${myLevel} ур.)`,
                  result: 'opponent_left',
                  expGained: opponentExpGain,
                };
                opponentHistory.unshift(opponentEntry);
                if (opponentHistory.length > 50) opponentHistory.pop();
                await update(ref(db, `users/${opponentId}`), { expHistory: opponentHistory });

                // Обновляем статистику игрока (поражение)
                const playerRef = ref(db, `users/${playerKey}/stats`);
                const playerSnap = await get(playerRef);
                const playerStats = playerSnap.val() || { totalGames: 0, wins: 0, exp: 0 };
                const playerOldExp = playerStats.exp || 0;
                const playerExpGain = EXP_REWARDS.LOSE_ONLINE;

                await update(playerRef, {
                  totalGames: playerStats.totalGames + 1,
                  exp: playerOldExp + playerExpGain,
                });

                // Добавляем запись в историю игрока
                const playerUserSnap = await get(ref(db, `users/${playerKey}`));
                const playerUserData = playerUserSnap.val() || {};
                const playerHistory = playerUserData.expHistory || [];
                const playerEntry = {
                  timestamp: Date.now(),
                  gameType: gameData.gameType === 'giveaway' ? 'Поддавки' : 'Русские шашки',
                  opponent: `${opponentName || 'Соперник'} (${opponentLevel} ур.)`,
                  result: 'lose',
                  expGained: playerExpGain,
                };
                playerHistory.unshift(playerEntry);
                if (playerHistory.length > 50) playerHistory.pop();
                await update(ref(db, `users/${playerKey}`), { expHistory: playerHistory });

                // Помечаем игру как завершенную с информацией о сдаче
                await update(ref(db, `games_checkers/${gameId}`), {
                  status: 'finished',
                  winner: opponentId,
                  surrendered: playerKey,
                  finishedAt: Date.now(),
                });

              } catch (err) {
                console.error('Ошибка обновления статистики:', err);
              }
            }

            // Удаляем игру
            if (!isCleanupDone.current) {
              isCleanupDone.current = true;
              await remove(ref(db, `games_checkers/${gameId}`));
            }

            navigation.replace('Menu');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.status}>Загрузка игры...</Text>
      </View>
    );
  }

  const isMyTurn = gameData?.currentPlayer === playerKey;
  const myCaptured = myRole === 1 ? captured.black : captured.white;
  const opponentCaptured = myRole === 1 ? captured.white : captured.black;
  const gameType = gameData?.gameType || 'classic';
  const gameTypeName = gameType === 'giveaway' ? '🎯 Поддавки' : '♟️ Русские шашки';

  let captureMap = {};
  if (isMyTurn && !animatingMove && !isAnimatingRef.current) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.player === myRole && getCaptureMoves(board, r, c, myRole).length > 0) {
          captureMap[`${r}-${c}`] = true;
        }
      }
    }
  }

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
        <Text style={styles.opponentAvatar}>{opponentAvatar || '😎'}</Text>
        <View style={styles.opponentDetails}>
          <Text style={styles.opponentName}>{opponentName || 'Соперник'}</Text>
          <Text style={[styles.levelBadge, { color: getLevelColor(opponentLevel) }]}>
            ⭐ Ур. {opponentLevel}
          </Text>
        </View>
        {!isMyTurn && (
          <View style={styles.turnBadge}>
            <Text style={styles.turnBadgeText}>⏳ Ход противника</Text>
          </View>
        )}
      </View>

      {/* Съеденные шашки противника (сверху) - противник съел мои шашки */}
      <View style={styles.capturedRow}>
        {Array.from({ length: opponentCaptured }).map((_, index) => (
          <View
            key={`opponent-${index}`}
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
        myRole={myRole}
        captureMap={captureMap}
        animatingMove={animatingMove}
        onAnimationFinish={onAnimationFinish}
      />

      {/* Съеденные шашки игрока (снизу) - я съел шашки противника */}
      <View style={styles.capturedRow}>
        {Array.from({ length: myCaptured }).map((_, index) => (
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
        <Text style={styles.playerAvatar}>{myAvatar || '😀'}</Text>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{myName || 'Вы'}</Text>
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
        opponentLeft={victoryData.opponentLeft || false}
        navigation={navigation}
      />
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
    marginLeft: 8,
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
  status: { color: colors.textLight, fontSize: 18 },
});

export default OnlineGameScreen;