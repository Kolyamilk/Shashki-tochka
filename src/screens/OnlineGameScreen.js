// src/screens/OnlineGameScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ref, onValue, update, off, remove, get } from 'firebase/database';
import { db } from '../firebase/config';
import Board from '../components/Board';
import VictoryModal from '../components/VictoryModal';
import { useInvite } from '../context/InviteContext';
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
    // Удаляем игру полностью, чтобы противник получил уведомление
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

  // Если противник сдался/вышел - победитель получает половину опыта (150 вместо 300)
  const winnerExpGain = isSurrender ? 150 : EXP_REWARDS.WIN_ONLINE;
  const loserExpGain = isSurrender ? 0 : EXP_REWARDS.LOSE_ONLINE;

  await update(winnerRef, {
    totalGames: winnerStats.totalGames + 1,
    wins: winnerStats.wins + 1,
    exp: winnerOldExp + winnerExpGain,
  });

  // Проигравший не получает опыт если сдался/вышел
  await update(loserRef, {
    totalGames: loserStats.totalGames + 1,
    wins: loserStats.wins,
    exp: loserOldExp + loserExpGain,
  });

  // Сохраняем историю начисления опыта для обоих игроков
  // Для победителя
  const winnerHistoryRef = ref(db, `users/${winnerId}/expHistory`);
  const winnerHistorySnap = await get(winnerHistoryRef);
  const winnerHistory = winnerHistorySnap.val() || [];

  // Получаем имя проигравшего
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

  // Проверяем, получил ли победитель новый подарок
  const winnerOldLevel = getLevelFromExp(winnerOldExp).level;
  const winnerNewLevel = getLevelFromExp(winnerOldExp + winnerExpGain).level;
  const leveledUp = winnerNewLevel > winnerOldLevel;

  const updateData = {
    expHistory: winnerHistory,
  };

  // Если повысился уровень и это кратно 5, добавляем новый подарок в список непросмотренных
  if (leveledUp && winnerNewLevel % 5 === 0) {
    const winnerUserRef = ref(db, `users/${winnerId}`);
    const winnerUserSnap = await get(winnerUserRef);
    const winnerUserData = winnerUserSnap.val() || {};
    const newGifts = winnerUserData.newGifts || [];

    // Добавляем ID подарка в список новых, если его там ещё нет
    const giftId = `gift_level_${winnerNewLevel}`;
    if (!newGifts.includes(giftId)) {
      updateData.newGifts = [...newGifts, giftId];
    }
  }

  await update(ref(db, `users/${winnerId}`), updateData);

  // Для проигравшего (только если не сдался)
  if (!isSurrender) {
    const loserHistoryRef = ref(db, `users/${loserId}/expHistory`);
    const loserHistorySnap = await get(loserHistoryRef);
    const loserHistory = loserHistorySnap.val() || [];

    // Получаем имя победителя
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

    await update(ref(db, `users/${loserId}`), {
      expHistory: loserHistory,
    });
  }

  return { winnerOldExp, loserOldExp, winnerExpGain };
};

const OnlineGameScreen = ({ route, navigation }) => {
  const { gameId, playerKey, myRole } = route.params;
  const { myPieceColor, opponentPieceColor } = useSettings();
  const [board, setBoard] = useState(initialBoard());
    const { resetInviteFlags } = useInvite();
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
          expGained = winnerExpGain; // 150 если противник сдался, 300 если обычная победа
          oldExp = winnerOldExp;
        } else {
          // Если игрок сдался/вышел, опыт не начисляется
          expGained = 0;
          oldExp = loserOldExp;
        }
      } catch (err) {
        console.error('Ошибка обновления статистики:', err);
      }
    }

    // Показываем модальное окно победы
    setVictoryData({ isWin, expGained, oldExp, opponentLeft: false });
    setVictoryModalVisible(true);
  };

  const handleVictoryClose = async () => {
    setVictoryModalVisible(false);
    if (!isCleanupDone.current) {
      isCleanupDone.current = true;
      await cleanupGame(gameId);
    }
    // Сбрасываем флаги приглашений после выхода из игры
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

  // ← ← ← ИСПРАВЛЕННЫЙ useEffect для Firebase
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
          isCleanupDone.current = true;

          // Проверяем, не начислен ли уже опыт (если противник сдался, опыт уже начислен)
          let expGained = 0;
          let oldExp = 0;

          if (playerKey) {
            try {
              // Проверяем историю - если последняя запись с opponent_left уже есть, значит опыт начислен
              const userRef = ref(db, `users/${playerKey}`);
              const userSnap = await get(userRef);
              const userData = userSnap.val() || {};
              const history = userData.expHistory || [];

              const lastEntry = history[0];
              const alreadyRewarded = lastEntry &&
                                      lastEntry.result === 'opponent_left' &&
                                      (Date.now() - lastEntry.timestamp) < 5000; // Проверяем последние 5 секунд

              if (alreadyRewarded) {
                // Опыт уже начислен в handleGiveUp противника
                // Берем oldExp ДО начисления (из истории)
                const currentExp = userData.stats?.exp || 0;
                oldExp = currentExp - lastEntry.expGained;
                expGained = lastEntry.expGained;
                console.log(`ℹ️ Опыт уже начислен в handleGiveUp: ${expGained}, oldExp: ${oldExp}, currentExp: ${currentExp}`);
              } else {
                // Опыт еще не начислен, начисляем 150
                const userStatsRef = ref(db, `users/${playerKey}/stats`);
                const statsSnap = await get(userStatsRef);
                const stats = statsSnap.val() || { totalGames: 0, wins: 0, exp: 0 };

                oldExp = stats.exp || 0;
                expGained = 150;

                await update(userStatsRef, {
                  totalGames: stats.totalGames + 1,
                  wins: stats.wins + 1,
                  exp: oldExp + expGained,
                });

                // Сохраняем историю начисления опыта
                const newEntry = {
                  timestamp: Date.now(),
                  gameType: 'Онлайн игра',
                  opponent: `${opponentName || 'Соперник'} (${opponentLevel} ур.)`,
                  result: 'opponent_left',
                  expGained: expGained,
                };

                history.unshift(newEntry);
                if (history.length > 50) history.pop();

                await update(userRef, {
                  expHistory: history,
                });

                console.log(`✨ Начислено ${expGained} опыта за выход противника. oldExp: ${oldExp}, newExp: ${oldExp + expGained}`);
              }
            } catch (error) {
              console.error('Ошибка начисления опыта:', error);
            }
          }

          // Показываем модальное окно победы
          setVictoryData({ isWin: true, expGained, oldExp, opponentLeft: true });
          setVictoryModalVisible(true);
        }
        return;
      }

      if (!isInitialized.current) isInitialized.current = true;

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

      // ← ← ← Анимация ТОЛЬКО если:
      // 1. Доска изменилась
      // 2. Нет текущей анимации
      // 3. Это НЕ был мой последний ход
      // 4. Есть lastBoardRef
      // 5. Сейчас НЕ мой ход (currentPlayer !== playerKey)
      if (hasChanged && !animatingMove && !isAnimatingRef.current && !wasMyLastMove && lastBoardRef.current && data.currentPlayer !== playerKey) {
        console.log('🎬 Запуск анимации хода соперника...');
        
        let from = null, to = null, movedPiece = null;
        
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const oldPiece = boardToCompare[r]?.[c];
            const newPiece = newBoard[r][c];
            if (oldPiece && !newPiece) { from = { row: r, col: c }; movedPiece = oldPiece; }
            else if (!oldPiece && newPiece) { to = { row: r, col: c }; }
          }
        }

        if (from && to && movedPiece) {
          // ← ← ← ПРОВЕРЯЕМ ЧЕЙ это был ход ПО piece.player!
          const isOpponentMove = movedPiece.player !== myRole;
          
          console.log('📍 Найдено:', { from, to, movedPiece, isOpponentMove });

          if (isOpponentMove) {
            let wasCapture = false, capturedRow = null, capturedCol = null;
            for (let r = 0; r < BOARD_SIZE; r++) {
              for (let c = 0; c < BOARD_SIZE; c++) {
                const oldPiece = boardToCompare[r]?.[c];
                const newPiece = newBoard[r][c];
                if (oldPiece && !newPiece && (r !== from.row || c !== from.col)) {
                  wasCapture = true;
                  capturedRow = r;
                  capturedCol = c;
                  break;
                }
              }
            }

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
            setAnimatingMove({ from, to, piece: { ...movedPiece, king: newKing } });
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
  }, [gameId, playerKey, myRole]);  // ← ← ← Добавили myRole в зависимости!

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
    const anyCapture = hasAnyCapture(board, myRole);

    if (piece && piece.player === myRole) {
      if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
        return;
      } else {
        setSelectedCell({ row, col });
        const moves = getValidMovesForPiece(board, row, col, myRole, anyCapture);
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
            // Помечаем что игра завершается выходом
            isGameEnding.current = true;

            // Обновляем статистику противника (он получает победу)
            const opponentId = Object.keys(gameData?.players || {}).find(p => p !== playerKey);
            if (opponentId) {
              try {
                const opponentRef = ref(db, `users/${opponentId}/stats`);
                const opponentSnap = await get(opponentRef);
                const opponentStats = opponentSnap.val() || { totalGames: 0, wins: 0, exp: 0 };

                // Противник получает половину опыта за победу (150)
                const opponentOldExp = opponentStats.exp || 0;
                await update(opponentRef, {
                  totalGames: opponentStats.totalGames + 1,
                  wins: opponentStats.wins + 1,
                  exp: opponentOldExp + 150,
                });

                // Сохраняем историю для противника
                const opponentUserSnap = await get(ref(db, `users/${opponentId}`));
                const opponentUserData = opponentUserSnap.val() || {};
                const opponentHistory = opponentUserData.expHistory || [];

                const opponentEntry = {
                  timestamp: Date.now(),
                  gameType: 'Онлайн игра',
                  opponent: `${myName || 'Игрок'} (${myLevel} ур.)`,
                  result: 'opponent_left',
                  expGained: 150,
                };

                opponentHistory.unshift(opponentEntry);
                if (opponentHistory.length > 50) opponentHistory.pop();

                await update(ref(db, `users/${opponentId}`), {
                  expHistory: opponentHistory,
                });

                // Игрок не получает опыт, только обновляем счетчик игр
                const playerRef = ref(db, `users/${playerKey}/stats`);
                const playerSnap = await get(playerRef);
                const playerStats = playerSnap.val() || { totalGames: 0, wins: 0, exp: 0 };
                await update(playerRef, {
                  totalGames: playerStats.totalGames + 1,
                });
              } catch (err) {
                console.error('Ошибка обновления статистики:', err);
              }
            }

            // Очищаем игру - удаляем запись, чтобы противник получил уведомление
            if (!isCleanupDone.current) {
              isCleanupDone.current = true;
              // Удаляем игру из Firebase
              await remove(ref(db, `games_checkers/${gameId}`));
              console.log('🗑️ Игра удалена, противник получит уведомление');
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

  // Определяем тип игры из gameData
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

      <View style={styles.turnIndicator}>
        <Text style={[styles.turnTextBig, isMyTurn ? styles.myTurn : styles.opponentTurn]}>
          {isMyTurn ? '⚡ Ваш ход' : '⏳ Ход противника'}
        </Text>
      </View>

      <View style={styles.opponentInfo}>
        <Text style={styles.opponentAvatar}>{opponentAvatar}</Text>
        <View style={styles.playerDetails}>
          <Text style={styles.opponentName}>{opponentName || 'Соперник'}</Text>
          <Text style={[styles.levelBadge, { color: getLevelColor(opponentLevel) }]}>
            ⭐ Ур. {opponentLevel}
          </Text>
        </View>
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
        <Text style={styles.playerAvatar}>{myAvatar}</Text>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{myName || 'Вы'}</Text>
          <Text style={[styles.levelBadge, { color: getLevelColor(myLevel) }]}>
            ⭐ Ур. {myLevel}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.giveUpButton} onPress={handleGiveUp}>
        <Text style={styles.giveUpText}>🏳️ Сдаться</Text>
      </TouchableOpacity>

      <VictoryModal
        visible={victoryModalVisible}
        isWin={victoryData.isWin}
        expGained={victoryData.expGained}
        oldExp={victoryData.oldExp}
        onClose={handleVictoryClose}
        opponentLeft={victoryData.opponentLeft || false}
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
    paddingVertical: 20,
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
  turnIndicator: {
    marginBottom: 10,
    marginTop: 10,
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
  myTurn: { color: '#4ECDC4' },
  opponentTurn: { color: '#FF6B6B' },
  opponentInfo: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 40,
    marginLeft: 20,
    marginBottom: 10,
  },
  opponentAvatar: { fontSize: 28, marginRight: 8 },
  opponentName: { fontSize: 16, color: colors.textLight, fontWeight: '600' },
  playerDetails: {
    flexDirection: 'column',
    marginRight: 12,
  },
  levelBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
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
    marginTop: 10,
  },
  playerAvatar: { fontSize: 28, marginRight: 8 },
  playerName: { fontSize: 16, color: colors.textLight, fontWeight: '600' },
  giveUpButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#FF6B6B',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  giveUpText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  status: { color: colors.textLight, fontSize: 18 },
});

export default OnlineGameScreen;