// src/utils/checkersLogic.js

export const BOARD_SIZE = 8;

// Начальная расстановка
export const initialBoard = () => {
  const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        if (row < 3) board[row][col] = { player: 1, king: false }; // белые
        else if (row > 4) board[row][col] = { player: 2, king: false }; // чёрные
      }
    }
  }
  return board;
};

// Проверка, является ли фигура противником
export const isEnemy = (piece, player) => piece && piece.player !== player;

// Возвращает массив возможных взятий для фигуры в (row, col)
export const getCaptureMoves = (board, row, col, player) => {
  const piece = board[row][col];
  if (!piece || piece.player !== player) return [];

  const captures = [];

  if (piece.king) {
    // Дамка: ищем врага на диагонали и все пустые клетки за ним
    const directions = [[-1,-1], [-1,1], [1,-1], [1,1]];
    for (let [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      let foundEnemy = false;
      let enemyRow = -1, enemyCol = -1;

      // Ищем первую фигуру на диагонали
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        const current = board[r][c];
        if (current) {
          if (!foundEnemy) {
            if (isEnemy(current, player)) {
              foundEnemy = true;
              enemyRow = r;
              enemyCol = c;
              // После нахождения врага переходим к поиску пустых клеток за ним
              r += dr;
              c += dc;
              break;
            } else {
              // Своя фигура — дальше не идём
              break;
            }
          }
        } else {
          r += dr;
          c += dc;
        }
      }

      // Если нашли врага, собираем все пустые клетки за ним
      if (foundEnemy) {
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === null) {
          captures.push({
            row: r,
            col: c,
            capturedRow: enemyRow,
            capturedCol: enemyCol,
          });
          r += dr;
          c += dc;
        }
      }
    }
  } else {
    // Обычная шашка
    const directions = [[-1,-1], [-1,1], [1,-1], [1,1]];
    for (let [dr, dc] of directions) {
      const midRow = row + dr;
      const midCol = col + dc;
      const landRow = row + dr * 2;
      const landCol = col + dc * 2;

      if (
        landRow >= 0 && landRow < BOARD_SIZE &&
        landCol >= 0 && landCol < BOARD_SIZE
      ) {
        const midPiece = board[midRow]?.[midCol];
        const landPiece = board[landRow]?.[landCol];
        if (midPiece && isEnemy(midPiece, player) && !landPiece) {
          captures.push({
            row: landRow,
            col: landCol,
            capturedRow: midRow,
            capturedCol: midCol,
          });
        }
      }
    }
  }
  return captures;
};

// Проверяет, есть ли у игрока хотя бы одно взятие
export const hasAnyCapture = (board, player) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.player === player) {
        if (getCaptureMoves(board, r, c, player).length > 0) return true;
      }
    }
  }
  return false;
};

// Возвращает все возможные ходы для фигуры (с учётом приоритета взятия)
export const getValidMovesForPiece = (board, row, col, player, anyCaptureExists) => {
  const piece = board[row][col];
  if (!piece || piece.player !== player) return [];

  const captures = getCaptureMoves(board, row, col, player);
  if (anyCaptureExists) {
    return captures; // если есть взятие, возвращаем только взятия
  } else {
    // Обычные ходы (без взятия)
    if (piece.king) {
      // Дамка может ходить на любое количество пустых клеток по диагонали
      const moves = [];
      const directions = [[-1,-1], [-1,1], [1,-1], [1,1]];
      for (let [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === null) {
          moves.push({ row: r, col: c });
          r += dr;
          c += dc;
        }
      }
      return moves;
    } else {
      // Обычная шашка ходит только вперёд на одну клетку
      const moves = [];
      const directions = player === 1 ? [[1,-1], [1,1]] : [[-1,-1], [-1,1]];
      for (let [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === null) {
          moves.push({ row: nr, col: nc });
        }
      }
      return moves;
    }
  }
};

// Проверка наличия ходов у игрока (для конца игры)
export const hasMoves = (board, player) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.player === player) {
        if (getValidMovesForPiece(board, r, c, player, false).length > 0) return true;
        if (getCaptureMoves(board, r, c, player).length > 0) return true;
      }
    }
  }
  return false;
};

// Подсчёт фигур
export const countPieces = (board, player) => {
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] && board[r][c].player === player) count++;
    }
  }
  return count;
};

// Проверка окончания игры для режима поддавков
export const checkGiveawayWinner = (board, player) => {
  const playerPieces = countPieces(board, player);
  const hasPlayerMoves = hasMoves(board, player);

  // В поддавках побеждает тот, у кого нет фигур или нет ходов
  if (playerPieces === 0 || !hasPlayerMoves) {
    return player; // Этот игрок победил (отдал все фигуры)
  }

  return null; // Игра продолжается
};

// Проверка на ничью: остались только две дамки
export const checkDrawByTwoKings = (board) => {
  let totalPieces = 0;
  let kingCount = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece) {
        totalPieces++;
        if (piece.king) {
          kingCount++;
        }
      }
    }
  }

  // Ничья если осталось ровно 2 фигуры и обе дамки
  return totalPieces === 2 && kingCount === 2;
};