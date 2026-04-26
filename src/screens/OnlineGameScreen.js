// src/screens/OnlineGameScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ref, onValue, update, remove, get } from 'firebase/database';
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

const cleanupGame = async (gameId) => {
  if (!gameId) return;
  try {
    console.log(`🧹 Очистка игры ${gameId}...`);
    await remove(ref(db, `games_checkers/${gameId}`));
    const invitationsRef = ref(db, 'invitations');
    const snapshot = await get(invitationsRef);
    if (snapshot.exists()) {
      const invites = snapshot.val();
      for (const [invId, inv] of Object.entries(invites)) {
        if (inv.gameId === gameId) {
          await remove(ref(db, `invitations/${invId}`));
          console.log(`🗑️ Удалено приглашение ${invId}`);
        }
      }
    }
    console.log(`✅ Игра ${gameId} удалена из базы`);
  } catch (error) {
    console.error('❌ Ошибка очистки игры:', error);
  }
};

const updateStats = async (winnerId, loserId, isSurrender = false) => {
  const winnerRef = ref(db, `users/${winnerId}/stats`);
  const loserRef = ref(db, `users/${loserId}/stats`);
  const winnerSnap = await get(winnerRef);
  const loserSnap = await get(loserRef);
  const winnerStats = winnerSnap.val() || { totalGames: 0, wins: 0, exp: 0 };
  const loserStats = loserSnap.val() || { totalGames: 0, wins: 0, exp: 0 };

  const winnerOldExp = winnerStats.exp || 0;
  const loserOldExp = loserStats.exp || 0;

  const winnerExpGain = isSurrender ? 150 : EXP_REWARDS.WIN_ONLINE;
  const loserExpGain = isSurrender ? 0 : EXP_REWARDS.LOSE_ONLINE;

  await update(winnerRef, {
    totalGames: winnerStats.totalGames + 1,
    wins: winnerStats.wins + 1,
    exp: winnerOldExp + winnerExpGain,
  });

  await update(loserRef, {
    totalGames: loserStats.totalGames + 1,
    wins: loserStats.wins,
    exp: loserOldExp + loserExpGain,
  });

  // История для победителя
  const winnerHistoryRef = ref(db, `users/${winnerId}/expHistory`);
  const winnerHistorySnap = await get(winnerHistoryRef);
  const winnerHistory = winnerHistorySnap.val() || [];
  const loserUserSnap = await get(ref(db, `users/${loserId}`));
  const loserUserData = loserUserSnap.val() || {};
  const loserName = loserUserData.name || 'Игрок';
  const loserLevel = getLevelFromExp(loserUserData.stats?.exp || 0).level;
  const winnerEntry = {
    timestamp: Date.now(),
    gameType: 'Онлайн игра',
    opponent: `${loserName} (${loserLevel} ур.)`,
    result: 'win',
    expGained: winnerExpGain,
  };
  winnerHistory.unshift(winnerEntry);
  if (winnerHistory.length > 50) winnerHistory.pop();

  const winnerOldLevel = getLevelFromExp(winnerOldExp).level;
  const winnerNewLevel = getLevelFromExp(winnerOldExp + winnerExpGain).level;
  const leveledUp = winnerNewLevel > winnerOldLevel;
  const updateData = { expHistory: winnerHistory };
  if (leveledUp && winnerNewLevel % 5 === 0) {
    const winnerUserRef = ref(db, `users/${winnerId}`);
    const winnerUserSnap = await get(winnerUserRef);
    const winnerUserData = winnerUserSnap.val() || {};
    const newGifts = winnerUserData.newGifts || [];
    const giftId = `gift_level_${winnerNewLevel}`;
    if (!newGifts.includes(giftId)) {
      updateData.newGifts = [...newGifts, giftId];
    }
  }
  await update(ref(db, `users/${winnerId}`), updateData);

  // История для проигравшего (если не сдался)
  if (!isSurrender) {
    const loserHistoryRef = ref(db, `users/${loserId}/expHistory`);
    const loserHistorySnap = await get(loserHistoryRef);
    const loserHistory = loserHistorySnap.val() || [];
    const winnerUserSnap = await get(ref(db, `users/${winnerId}`));
    const winnerUserData = winnerUserSnap.val() || {};
    const winnerName = winnerUserData.name || 'Игрок';
    const winnerLevel = getLevelFromExp(winnerUserData.stats?.exp || 0).level;
    const loserEntry = {
      timestamp: Date.now(),
      gameType: 'Онлайн игра',
      opponent: `${winnerName} (${winnerLevel} ур.)`,
      result: 'lose',
      expGained: loserExpGain,
    };
    loserHistory.unshift(loserEntry);
    if (loserHistory.length > 50) loserHistory.pop();
    await update(ref(db, `users/${loserId}`), { expHistory: loserHistory });
  }

  return { winnerOldExp, loserOldExp, winnerExpGain, loserExpGain };
};

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
      const { winnerOldExp, loserOldExp, winnerExpGain, loserExpGain } = await updateStats(winnerId, loserId, isSurrender);
      if (isWin) {
        expGained = winnerExpGain;
        oldExp = winnerOldExp;
      } else {
        expGained = loserExpGain;
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

  // ☆☆☆ Обновление заданий – пропускаем для сдавшегося ☆☆☆
  if (!(isSurrender && !isWin)) {
    console.log('📋 Обновление прогресса заданий для игрока:', isWin ? 'победитель' : 'проигравший (не сдался)');

    if (isWin) {
      await updateProgress(TASK_TYPES.WIN_GAMES, 1);
      await updateProgress(TASK_TYPES.WIN_ONLINE, 1);
      if (gameData?.gameType === 'giveaway') {
        await updateProgress(TASK_TYPES.WIN_GIVEAWAY, 1, 'giveaway');
      }
    }
    // Сыгранная игра (независимо от результата, но только если не сдался)
    await updateProgress(TASK_TYPES.PLAY_GAMES, 1);
    await updateProgress(TASK_TYPES.PLAY_ONLINE, 1);
    await updateProgress(TASK_TYPES.PLAY_WITH_FRIEND, 1);
    if (gameData?.gameType === 'giveaway') {
      await updateProgress(TASK_TYPES.PLAY_GIVEAWAY, 1, 'giveaway');
    }

    // Подсчёт съеденных шашек (только если не сдался)
    const myCaptured = myRole === 1 ? captured.black : captured.white;
    if (myCaptured > 0) {
      await updateProgress(TASK_TYPES.CAPTURE_PIECES, myCaptured);
    }
  } else {
    console.log('⏭️ Пропускаем задания для проигравшего (сдался/ушёл)');
  }

  setVictoryData({ isWin, expGained, oldExp, opponentLeft: isSurrender && !isWin });
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
    if (gameData.currentPlayer !== playerKey) {
      console.warn('⚠️ Попытка хода не в свой ход');
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
    newBoard[move.fromRow][move.fromCol] = null;
    newBoard[move.toRow][move.toCol] = piece;
    if (move.capturedRow !== undefined && move.capturedCol !== undefined) {
      newBoard[move.capturedRow][move.capturedCol] = null;
    }
    if (willBeKing) {
      newBoard[move.toRow][move.toCol].king = true;
    }

    const furtherCaptures = getCaptureMoves(newBoard, move.toRow, move.toCol, piece.player);
    const wasCapture = move.capturedRow !== undefined && move.capturedCol !== undefined;

    let nextPlayer = null;
    if (furtherCaptures.length > 0 && wasCapture) {
      nextPlayer = playerKey;
    } else {
      const opponentId = Object.keys(gameData.players).find(p => p !== playerKey);
      nextPlayer = opponentId;
    }

    console.log('🎯 Вычислен следующий игрок:', nextPlayer);
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
    update(ref(db, 'games_checkers/' + gameId), updates)
      .then(() => {
        setTimeout(() => { lastMoveWasMineRef.current = false; }, 500);
      })
      .catch(err => console.error('Ошибка отправки хода:', err));

    setPendingBoard(newBoard);
    setPendingMove({ move, wasCapture, furtherCaptures, willBeKing, nextPlayer });
    setAnimatingMove({
      from: { row: move.fromRow, col: move.fromCol },
      to: { row: move.toRow, col: move.toCol },
      piece: { ...piece, king: willBeKing },
      wasCapture: wasCapture,
    });
    isAnimatingRef.current = true;

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

  useEffect(() => {
    const gameRef = ref(db, 'games_checkers/' + gameId);
    const unsubscribe = onValue(gameRef, async (snapshot) => {
      const data = snapshot.val();
      if (currentGameIdRef.current !== gameId) return;
      if (!data) {
        if (!isInitialized.current) return;
        if (!isGameEnding.current && !isCleanupDone.current) {
          console.log('⚠️ Игра удалена');
          isCleanupDone.current = true;
        }
        return;
      }
      if (!isInitialized.current) isInitialized.current = true;
      if (data.status === 'finished' && !isGameEnding.current) {
        console.log('🏁 Игра завершена на сервере');
        isGameEnding.current = true;
        const isWin = data.winner === playerKey;
        let expGained = 0;
        let oldExp = 0;
        let opponentLeft = false;
        if (data.surrendered) {
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
      if (!data.board) return;
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

      if (hasChanged && !isAnimatingRef.current && !wasMyLastMove && lastBoardRef.current) {
        console.log('🎬 Анимация хода соперника');
        setAnimatingMove(null);
        let from = null, to = null, movedPiece = null;
        let capturedPositions = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const oldPiece = boardToCompare[r]?.[c];
            const newPiece = newBoard[r][c];
            if (oldPiece && !newPiece) {
              if (oldPiece.player !== myRole) {
                from = { row: r, col: c };
                movedPiece = oldPiece;
              } else {
                capturedPositions.push({ row: r, col: c });
              }
            } else if (!oldPiece && newPiece) {
              to = { row: r, col: c };
            }
          }
        }
        if (from && to && movedPiece) {
          const isOpponentMove = movedPiece.player !== myRole;
          if (isOpponentMove) {
            const wasCapture = capturedPositions.length > 0;
            const capturedRow = wasCapture ? capturedPositions[0].row : null;
            const capturedCol = wasCapture ? capturedPositions[0].col : null;
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
          } else {
            setBoard(newBoard);
          }
        } else {
          setBoard(newBoard);
        }
      } else if (hasChanged) {
        setBoard(newBoard);
      }
      lastBoardRef.current = newBoard;
      if (!wasMyLastMove) lastMoveWasMineRef.current = false;
      setLoading(false);
      if (data.currentPlayer !== playerKey) {
        setSelectedCell(null);
        setValidMoves([]);
      }
    });
    return () => unsubscribe();
  }, [gameId, playerKey, myRole]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => { handleGiveUp(); return true; };
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
            navigation.replace('Menu');
            return;
          }
          const opponentId = Object.keys(gameData.players).find(p => p !== playerKey);
          if (opponentId) {
            // Вызываем endGame для регистрации победы соперника с флагом surrender
            await endGame('Вы сдались', opponentId, playerKey, true);
          } else {
            navigation.replace('Menu');
          }
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
      <View style={styles.header}>
        <View style={styles.gameTypeIndicator}>
          <Text style={styles.gameTypeText}>{gameTypeName}</Text>
        </View>
      </View>

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

      <View style={styles.capturedRow}>
        {Array.from({ length: opponentCaptured }).map((_, index) => (
          <View key={`opponent-${index}`} style={[styles.capturedPiece, { backgroundColor: myPieceColor, borderColor: myPieceColor }]} />
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

      <View style={styles.capturedRow}>
        {Array.from({ length: myCaptured }).map((_, index) => (
          <View key={`player-${index}`} style={[styles.capturedPiece, { backgroundColor: opponentPieceColor, borderColor: opponentPieceColor }]} />
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
  container: { flex: 1, backgroundColor: '#1a2a3a', alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 50, alignItems: 'center', zIndex: 10 },
  gameTypeIndicator: { backgroundColor: '#2c3e50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  gameTypeText: { fontSize: 15, fontWeight: '600', color: '#4ECDC4' },
  capturedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginVertical: 10, maxWidth: 380, minHeight: 50, zIndex: 1 },
  capturedPiece: { width: 28, height: 28, borderRadius: 14, marginHorizontal: 3, marginVertical: 3, borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
  opponentInfo: { position: 'absolute', top: 110, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2c3e50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 25, zIndex: 5 },
  opponentAvatar: { fontSize: 24, marginRight: 8 },
  opponentName: { fontSize: 16, color: colors.textLight, fontWeight: '600', marginRight: 10 },
  opponentDetails: { flexDirection: 'column', marginRight: 10 },
  playerInfo: { position: 'absolute', bottom: 90, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2c3e50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 25, zIndex: 10 },
  playerAvatar: { fontSize: 24, marginRight: 8 },
  playerName: { fontSize: 14, color: colors.textLight, fontWeight: '600' },
  playerDetails: { flexDirection: 'column', marginRight: 10 },
  levelBadge: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  turnBadge: { backgroundColor: '#4ECDC4', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, marginLeft: 8 },
  turnBadgeText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  giveUpButton: { position: 'absolute', bottom: 30, backgroundColor: '#FF6B6B', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, zIndex: 10 },
  giveUpText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  status: { color: colors.textLight, fontSize: 18 },
});

export default OnlineGameScreen;