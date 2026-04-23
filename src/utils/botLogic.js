import {
  getValidMovesForPiece,
  getCaptureMoves,
  hasAnyCapture,
  BOARD_SIZE,
} from './checkersLogic';

// Веса позиций на доске (чем выше, тем лучше)
const positionalWeights = [
  [0, 2, 0, 2, 0, 2, 0, 2],
  [2, 0, 3, 0, 3, 0, 3, 0],
  [0, 3, 0, 4, 0, 4, 0, 3],
  [3, 0, 4, 0, 5, 0, 4, 0],
  [0, 3, 0, 5, 0, 5, 0, 3],
  [3, 0, 4, 0, 4, 0, 3, 0],
  [0, 2, 0, 3, 0, 3, 0, 2],
  [2, 0, 2, 0, 2, 0, 2, 0],
];

// Получение всех возможных ходов для игрока
const getAllMoves = (board, player) => {
  const moves = [];
  const anyCapture = hasAnyCapture(board, player);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.player === player) {
        const pieceMoves = getValidMovesForPiece(board, r, c, player, anyCapture);
        pieceMoves.forEach(move => {
          moves.push({
            fromRow: r,
            fromCol: c,
            toRow: move.row,
            toCol: move.col,
            capturedRow: move.capturedRow,
            capturedCol: move.capturedCol,
          });
        });
      }
    }
  }
  return moves;
};

// Применить ход к доске и вернуть новую доску
const applyMoveToBoard = (board, move) => {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[move.fromRow]?.[move.fromCol];
  if (!piece) return board;
  
  const movedPiece = { ...piece };
  newBoard[move.fromRow][move.fromCol] = null;
  newBoard[move.toRow][move.toCol] = movedPiece;

  if (move.capturedRow !== undefined && move.capturedCol !== undefined) {
    newBoard[move.capturedRow][move.capturedCol] = null;
  }

  if (!movedPiece.king) {
    const shouldBeKing = (movedPiece.player === 1 && move.toRow === 7) || (movedPiece.player === 2 && move.toRow === 0);
    if (shouldBeKing) {
      newBoard[move.toRow][move.toCol].king = true;
    }
  }

  return newBoard;
};

// Продвинутая оценочная функция
const evaluateBoard = (board, isGiveaway = false) => {
  let score = 0;
  let player1Pieces = 0, player2Pieces = 0;
  let player1Kings = 0, player2Kings = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece) {
        if (piece.player === 1) player1Pieces++;
        else player2Pieces++;
        if (piece.king) {
          if (piece.player === 1) player1Kings++;
          else player2Kings++;
        }

        // В режиме поддавков логика обратная
        if (isGiveaway) {
          // Чем меньше фигур у игрока, тем лучше
          let value = piece.king ? -5 : -1;

          // В поддавках выгодно быть уязвимым (чтобы тебя съели)
          let vulnerabilityBonus = 0;
          const directions = [[-1,-1], [-1,1], [1,-1], [1,1]];

          for (let [dr, dc] of directions) {
            const attackerR = r - dr;
            const attackerC = c - dc;
            const landR = r + dr;
            const landC = c + dc;
            if (attackerR >= 0 && attackerR < BOARD_SIZE && attackerC >= 0 && attackerC < BOARD_SIZE &&
                landR >= 0 && landR < BOARD_SIZE && landC >= 0 && landC < BOARD_SIZE) {
              const attacker = board[attackerR][attackerC];
              const landing = board[landR][landC];
              if (attacker && attacker.player !== piece.player && !landing) {
                vulnerabilityBonus += 0.5; // Бонус за уязвимость
              }
            }
          }

          value += vulnerabilityBonus;

          if (piece.player === 2) score += value;
          else score -= value;
        } else {
          // Обычная логика для русских шашек
          let value = piece.king ? 5 : 1;

          // Бонус за положение на доске
          if (!piece.king) {
            value += positionalWeights[r][c] * 0.15;
          }

          // Бонус за продвижение вперёд
          if (!piece.king) {
            const forwardProgress = piece.player === 1 ? r : 7 - r;
            value += forwardProgress * 0.1;
          }

          // Бонус за близость к превращению в дамку
          if (!piece.king) {
            const distanceToKing = piece.player === 1 ? (7 - r) : r;
            if (distanceToKing <= 2) {
              value += (3 - distanceToKing) * 0.4;
            }
          }

          // Бонус за защищённость и атакующую позицию
          let protectionBonus = 0;
          let attackBonus = 0;
          let vulnerabilityPenalty = 0;
          const directions = [[-1,-1], [-1,1], [1,-1], [1,1]];

          for (let [dr, dc] of directions) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
              const neighbor = board[nr][nc];
              if (neighbor) {
                if (neighbor.player === piece.player) {
                  protectionBonus += 0.2;
                } else {
                  // Можем ли атаковать
                  const jumpR = r + dr * 2;
                  const jumpC = c + dc * 2;
                  if (jumpR >= 0 && jumpR < BOARD_SIZE && jumpC >= 0 && jumpC < BOARD_SIZE && !board[jumpR][jumpC]) {
                    attackBonus += 0.3;
                  }
                }
              }
            }

            // Проверка уязвимости
            const attackerR = r - dr;
            const attackerC = c - dc;
            const landR = r + dr;
            const landC = c + dc;
            if (attackerR >= 0 && attackerR < BOARD_SIZE && attackerC >= 0 && attackerC < BOARD_SIZE &&
                landR >= 0 && landR < BOARD_SIZE && landC >= 0 && landC < BOARD_SIZE) {
              const attacker = board[attackerR][attackerC];
              const landing = board[landR][landC];
              if (attacker && attacker.player !== piece.player && !landing) {
                vulnerabilityPenalty += 0.25;
              }
            }
          }

          value += protectionBonus + attackBonus - vulnerabilityPenalty;

          if (piece.player === 2) score += value;
          else score -= value;
        }
      }
    }
  }

  // Материальное преимущество
  if (isGiveaway) {
    // В поддавках: чем меньше фигур, тем лучше
    const pieceDiff = player2Pieces - player1Pieces;
    score -= pieceDiff * 2; // Инвертируем

    const kingDiff = player2Kings - player1Kings;
    score -= kingDiff * 3; // Инвертируем
  } else {
    // В обычных шашках: чем больше фигур, тем лучше
    const pieceDiff = player2Pieces - player1Pieces;
    score += pieceDiff * 0.6;

    const kingDiff = player2Kings - player1Kings;
    score += kingDiff * 2;
  }

  return score;
};

// Минимакс с альфа-бета отсечением и рандомизацией
const minimax = (board, depth, alpha, beta, maximizingPlayer, player, isGiveaway = false, moveHistory = []) => {
  if (depth === 0) {
    const score = evaluateBoard(board, isGiveaway);
    return { score, move: null };
  }

  const moves = getAllMoves(board, player);
  if (moves.length === 0) {
    return { score: maximizingPlayer ? -1000 : 1000, move: null };
  }

  // Добавляем небольшую рандомизацию в порядок рассмотрения ходов
  const shuffledMoves = [...moves].sort(() => Math.random() - 0.5);

  if (maximizingPlayer) {
    let bestScore = -Infinity;
    let bestMoves = []; // Храним все лучшие ходы с одинаковой оценкой
    for (const move of shuffledMoves) {
      const newBoard = applyMoveToBoard(board, move);
      const result = minimax(newBoard, depth - 1, alpha, beta, false, player === 1 ? 2 : 1, isGiveaway, moveHistory);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMoves = [move];
      } else if (result.score === bestScore) {
        bestMoves.push(move);
      }
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break;
    }
    // Выбираем случайный ход из лучших
    const bestMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    return { score: bestScore, move: bestMove };
  } else {
    let bestScore = Infinity;
    let bestMoves = [];
    for (const move of shuffledMoves) {
      const newBoard = applyMoveToBoard(board, move);
      const result = minimax(newBoard, depth - 1, alpha, beta, true, player === 1 ? 2 : 1, isGiveaway, moveHistory);
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMoves = [move];
      } else if (result.score === bestScore) {
        bestMoves.push(move);
      }
      beta = Math.min(beta, bestScore);
      if (beta <= alpha) break;
    }
    const bestMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    return { score: bestScore, move: bestMove };
  }
};

// Главная функция для получения лучшего хода
export const getBestMove = (board, player, difficulty, gameType = 'russian') => {
  const moves = getAllMoves(board, player);
  if (moves.length === 0) return null;

  // В режиме поддавков инвертируем оценку
  const isGiveaway = gameType === 'giveaway';

  switch (difficulty) {
    case 'easy':
      return moves[Math.floor(Math.random() * moves.length)];

    case 'medium': {
      let bestScore = isGiveaway ? Infinity : -Infinity;
      let bestMove = null;
      for (const move of moves) {
        const newBoard = applyMoveToBoard(board, move);
        const score = evaluateBoard(newBoard, isGiveaway);

        if (isGiveaway ? score < bestScore : score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      return bestMove;
    }

    case 'hard': {
      const result = minimax(board, 4, -Infinity, Infinity, true, player, isGiveaway, []);
      return result.move;
    }

    case 'grandmaster': {
      const result = minimax(board, 7, -Infinity, Infinity, true, player, isGiveaway, []);
      return result.move;
    }

    default:
      return moves[0];
  }
};