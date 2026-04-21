// src/screens/OnlineGameScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ref, onValue, update, off, remove, get } from 'firebase/database';
import { db } from '../firebase/config';
import Board from '../components/Board';
import { useInvite } from '../context/InviteContext';
import {
  initialBoard,
  getValidMovesForPiece,
  getCaptureMoves,
  hasAnyCapture,
  hasMoves,
  BOARD_SIZE
} from '../utils/checkersLogic';
import { colors } from '../styles/globalStyles';
import { useSettings } from '../context/SettingsContext';

const cleanupGame = async (gameId) => {
  if (!gameId) return;
  try {
    console.log(`🧹 Очистка игры ${gameId}...`);
      await update(ref(db, `games_checkers/${gameId}`), {
      status: 'finished',
      finishedAt: Date.now(),
    });
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

const updateStats = async (winnerId, loserId) => {
  const winnerRef = ref(db, `users/${winnerId}/stats`);
  const loserRef = ref(db, `users/${loserId}/stats`);
  const winnerSnap = await get(winnerRef);
  const loserSnap = await get(loserRef);
  const winnerStats = winnerSnap.val() || { totalGames: 0, wins: 0 };
  const loserStats = loserSnap.val() || { totalGames: 0, wins: 0 };
  await update(winnerRef, {
    totalGames: winnerStats.totalGames + 1,
    wins: winnerStats.wins + 1,
  });
  await update(loserRef, {
    totalGames: loserStats.totalGames + 1,
    wins: loserStats.wins,
  });
};

const OnlineGameScreen = ({ route, navigation }) => {
  const { gameId, playerKey, myRole } = route.params;
  const [board, setBoard] = useState(initialBoard());
    const { resetInviteFlags } = useInvite();  // ← Получите из контекста!
  const [gameData, setGameData] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [captured, setCaptured] = useState({ white: 0, black: 0 });
  const [opponentName, setOpponentName] = useState('');
  const [opponentAvatar, setOpponentAvatar] = useState('');
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState('');

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

  const endGame = async (resultMessage, winnerId = null, loserId = null) => {
    if (isGameEnding.current) return;
    isGameEnding.current = true;

    if (winnerId && loserId) {
      try {
        await updateStats(winnerId, loserId);
      } catch (err) {
        console.error('Ошибка обновления статистики:', err);
      }
    }
    Alert.alert('Игра окончена', resultMessage, [
      { 
        text: 'OK', 
        onPress: async () => {
          if (!isCleanupDone.current) {
            isCleanupDone.current = true;
            await cleanupGame(gameId);
          }
          navigation.replace('Menu');
        }
      }
    ]);
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
          }
        };
        loadOpponentData();
      }
    }
  }, [gameData, playerKey]);

  // ← ← ← ИСПРАВЛЕННЫЙ useEffect для Firebase
  useEffect(() => {
    const gameRef = ref(db, 'games_checkers/' + gameId);
    const unsubscribe = onValue(gameRef, (snapshot) => {
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
          Alert.alert('Победа!', 'Соперник покинул игру. Ваша победа!', [
            { 
              text: 'OK', 
              onPress: async () => {
                await cleanupGame(gameId);
                navigation.replace('Menu');
              }
            }
          ]);
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
        hasLastBoard: !!lastBoardRef.current
      });

      // ← ← ← Анимация ТОЛЬКО если:
      // 1. Доска изменилась
      // 2. Нет текущей анимации
      // 3. Это НЕ был мой последний ход
      // 4. Есть lastBoardRef
      if (hasChanged && !animatingMove && !isAnimatingRef.current && !wasMyLastMove && lastBoardRef.current) {
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
        Alert.alert(
          'Выйти из игры',
          'Вы уверены, что хотите покинуть игру? Сопернику будет засчитана победа.',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Выйти',
              style: 'destructive',
              onPress: () => {
                const opponentId = Object.keys(gameData?.players || {}).find(p => p !== playerKey);
                if (opponentId) endGame('Вы сдались', opponentId, playerKey);
                else endGame('Вы сдались');
              },
            },
          ]
        );
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

  const handleGiveUp = () => {
    Alert.alert(
      'Выйти из игры',
      'Вы уверены? Сопернику будет засчитана победа.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: () => {
            const opponentId = Object.keys(gameData?.players || {}).find(p => p !== playerKey);
            if (opponentId) endGame('Вы сдались', opponentId, playerKey);
            else endGame('Вы сдались');
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
      <View style={styles.turnIndicator}>
        <Text style={[styles.turnTextBig, isMyTurn ? styles.myTurn : styles.opponentTurn]}>
          {isMyTurn ? '⚡ Ваш ход' : '⏳ Ход противника'}
        </Text>
      </View>

      <View style={styles.opponentInfo}>
        <Text style={styles.opponentAvatar}>{opponentAvatar}</Text>
        <Text style={styles.opponentName}>{opponentName || 'Соперник'}</Text>
        <View style={styles.capturedBadgeSmall}>
          <Text style={styles.capturedTextSmall}>🍽️ {opponentCaptured}</Text>
        </View>
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

      <View style={styles.playerInfo}>
        <Text style={styles.playerAvatar}>{myAvatar}</Text>
        <Text style={styles.playerName}>{myName || 'Вы'}</Text>
        <View style={styles.capturedBadgeSmall}>
          <Text style={styles.capturedTextSmall}>🍽️ {myCaptured}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.giveUpButton} onPress={handleGiveUp}>
        <Text style={styles.giveUpText}>🚪 Выйти</Text>
      </TouchableOpacity>
    </View>
  );
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
    marginBottom: 0,
  },
  opponentAvatar: { fontSize: 28, marginRight: 8 },
  opponentName: { fontSize: 18, color: colors.textLight, fontWeight: '600', marginRight: 12 },
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
  playerAvatar: { fontSize: 28, marginRight: 8 },
  playerName: { fontSize: 18, color: colors.textLight, fontWeight: '600', marginRight: 12 },
  capturedBadgeSmall: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  capturedTextSmall: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
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