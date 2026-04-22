// __tests__/levelSystem.test.js
import {
  getExpForLevel,
  getLevelFromExp,
  getRankName,
  getLevelColor,
  EXP_REWARDS
} from '../src/utils/levelSystem';

describe('Level System', () => {
  describe('getExpForLevel', () => {
    test('должен возвращать правильный опыт для уровня 1', () => {
      expect(getExpForLevel(1)).toBe(100);
    });

    test('должен возвращать правильный опыт для уровня 5', () => {
      expect(getExpForLevel(5)).toBe(500);
    });

    test('должен возвращать правильный опыт для уровня 10', () => {
      expect(getExpForLevel(10)).toBe(1000);
    });
  });

  describe('getLevelFromExp', () => {
    test('новый игрок (0 опыта) должен быть 1 уровня', () => {
      const result = getLevelFromExp(0);
      expect(result.level).toBe(1);
      expect(result.currentLevelExp).toBe(0);
      expect(result.expForNextLevel).toBe(100);
      expect(result.totalExp).toBe(0);
    });

    test('50 опыта должно быть 1 уровень с прогрессом 50/100', () => {
      const result = getLevelFromExp(50);
      expect(result.level).toBe(1);
      expect(result.currentLevelExp).toBe(50);
      expect(result.expForNextLevel).toBe(100);
    });

    test('100 опыта должно быть 2 уровень', () => {
      const result = getLevelFromExp(100);
      expect(result.level).toBe(2);
      expect(result.currentLevelExp).toBe(0);
      expect(result.expForNextLevel).toBe(200);
    });

    test('150 опыта должно быть 2 уровень с прогрессом 50/200', () => {
      const result = getLevelFromExp(150);
      expect(result.level).toBe(2);
      expect(result.currentLevelExp).toBe(50);
      expect(result.expForNextLevel).toBe(200);
    });

    test('300 опыта должно быть 3 уровень', () => {
      const result = getLevelFromExp(300);
      expect(result.level).toBe(3);
      expect(result.currentLevelExp).toBe(0);
      expect(result.expForNextLevel).toBe(300);
    });
  });

  describe('getRankName', () => {
    test('уровень 1 должен быть Новичок', () => {
      expect(getRankName(1)).toBe('🌱 Новичок');
    });

    test('уровень 5 должен быть Любитель', () => {
      expect(getRankName(5)).toBe('🥉 Любитель');
    });

    test('уровень 10 должен быть Опытный', () => {
      expect(getRankName(10)).toBe('🥈 Опытный');
    });

    test('уровень 20 должен быть Профи', () => {
      expect(getRankName(20)).toBe('🥇 Профи');
    });

    test('уровень 50 должен быть Легенда', () => {
      expect(getRankName(50)).toBe('🏆 Легенда');
    });
  });

  describe('getLevelColor', () => {
    test('уровень 1 должен быть бирюзовым', () => {
      expect(getLevelColor(1)).toBe('#4ECDC4');
    });

    test('уровень 50 должен быть золотым', () => {
      expect(getLevelColor(50)).toBe('#FFD700');
    });
  });

  describe('EXP_REWARDS', () => {
    test('награды должны быть определены', () => {
      expect(EXP_REWARDS.WIN_ONLINE).toBe(300);
      expect(EXP_REWARDS.LOSE_ONLINE).toBe(50);
      expect(EXP_REWARDS.WIN_BOT_EASY).toBe(30);
      expect(EXP_REWARDS.WIN_BOT_MEDIUM).toBe(50);
      expect(EXP_REWARDS.WIN_BOT_HARD).toBe(80);
      expect(EXP_REWARDS.WIN_BOT_GRANDMASTER).toBe(100);
      expect(EXP_REWARDS.LOSE_BOT).toBe(20);
      expect(EXP_REWARDS.OPPONENT_LEFT).toBe(50);
    });
  });
});
