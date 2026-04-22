// __tests__/checkersLogic.test.js
import {
  initialBoard,
  isEnemy,
  getCaptureMoves,
  hasAnyCapture,
  countPieces,
  hasMoves,
  BOARD_SIZE
} from '../src/utils/checkersLogic';

describe('Checkers Logic', () => {
  describe('initialBoard', () => {
    test('должна создавать доску 8x8', () => {
      const board = initialBoard();
      expect(board.length).toBe(8);
      expect(board[0].length).toBe(8);
    });

    test('должна расставлять 12 белых шашек', () => {
      const board = initialBoard();
      let whiteCount = 0;
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (board[row][col] && board[row][col].player === 1) {
            whiteCount++;
          }
        }
      }
      expect(whiteCount).toBe(12);
    });

    test('должна расставлять 12 черных шашек', () => {
      const board = initialBoard();
      let blackCount = 0;
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (board[row][col] && board[row][col].player === 2) {
            blackCount++;
          }
        }
      }
      expect(blackCount).toBe(12);
    });

    test('все шашки должны быть не дамками', () => {
      const board = initialBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (board[row][col]) {
            expect(board[row][col].king).toBe(false);
          }
        }
      }
    });
  });

  describe('isEnemy', () => {
    test('должна определять врага правильно', () => {
      const piece1 = { player: 1, king: false };
      const piece2 = { player: 2, king: false };

      expect(isEnemy(piece2, 1)).toBe(true);
      expect(isEnemy(piece1, 2)).toBe(true);
      expect(isEnemy(piece1, 1)).toBe(false);
      expect(isEnemy(piece2, 2)).toBe(false);
    });

    test('должна возвращать false для null', () => {
      expect(isEnemy(null, 1)).toBeFalsy();
    });
  });

  describe('countPieces', () => {
    test('должна считать фигуры игрока 1', () => {
      const board = initialBoard();
      expect(countPieces(board, 1)).toBe(12);
    });

    test('должна считать фигуры игрока 2', () => {
      const board = initialBoard();
      expect(countPieces(board, 2)).toBe(12);
    });

    test('должна возвращать 0 для пустой доски', () => {
      const emptyBoard = Array(8).fill(null).map(() => Array(8).fill(null));
      expect(countPieces(emptyBoard, 1)).toBe(0);
      expect(countPieces(emptyBoard, 2)).toBe(0);
    });
  });

  describe('hasAnyCapture', () => {
    test('не должно быть взятий в начальной позиции', () => {
      const board = initialBoard();
      expect(hasAnyCapture(board, 1)).toBe(false);
      expect(hasAnyCapture(board, 2)).toBe(false);
    });
  });

  describe('hasMoves', () => {
    test('должны быть ходы в начальной позиции', () => {
      const board = initialBoard();
      expect(hasMoves(board, 1)).toBe(true);
      expect(hasMoves(board, 2)).toBe(true);
    });

    test('не должно быть ходов на пустой доске', () => {
      const emptyBoard = Array(8).fill(null).map(() => Array(8).fill(null));
      expect(hasMoves(emptyBoard, 1)).toBe(false);
      expect(hasMoves(emptyBoard, 2)).toBe(false);
    });
  });
});
