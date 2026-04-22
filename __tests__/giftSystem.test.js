// __tests__/giftSystem.test.js
import {
  getGiftForLevel,
  shouldReceiveGift,
  getAvailableGifts,
  LEVEL_GIFTS,
  RARITY_COLORS,
  RARITY_NAMES
} from '../src/utils/giftSystem';

describe('Gift System', () => {
  describe('shouldReceiveGift', () => {
    test('должен возвращать true для уровня 5', () => {
      expect(shouldReceiveGift(5)).toBeTruthy();
    });

    test('должен возвращать true для уровня 10', () => {
      expect(shouldReceiveGift(10)).toBeTruthy();
    });

    test('должен возвращать false для уровня 1', () => {
      expect(shouldReceiveGift(1)).toBeFalsy();
    });

    test('должен возвращать false для уровня 7', () => {
      expect(shouldReceiveGift(7)).toBeFalsy();
    });

    test('должен возвращать true для уровня 50', () => {
      expect(shouldReceiveGift(50)).toBeTruthy();
    });
  });

  describe('getGiftForLevel', () => {
    test('должен возвращать подарок для уровня 5', () => {
      const gift = getGiftForLevel(5);
      expect(gift).toBeDefined();
      expect(gift.name).toBe('Бронзовая шашка');
      expect(gift.level).toBe(5);
    });

    test('должен возвращать null для уровня 1', () => {
      expect(getGiftForLevel(1)).toBeNull();
    });

    test('должен возвращать подарок для уровня 50', () => {
      const gift = getGiftForLevel(50);
      expect(gift).toBeDefined();
      expect(gift.name).toBe('Легендарный трофей');
    });
  });

  describe('getAvailableGifts', () => {
    test('должен возвращать пустой массив для уровня 1', () => {
      expect(getAvailableGifts(1)).toEqual([]);
    });

    test('должен возвращать 1 подарок для уровня 5', () => {
      const gifts = getAvailableGifts(5);
      expect(gifts.length).toBe(1);
      expect(gifts[0].level).toBe(5);
    });

    test('должен возвращать 2 подарка для уровня 10', () => {
      const gifts = getAvailableGifts(10);
      expect(gifts.length).toBe(2);
    });

    test('должен возвращать все подарки для уровня 50', () => {
      const gifts = getAvailableGifts(50);
      expect(gifts.length).toBe(10);
    });
  });

  describe('LEVEL_GIFTS', () => {
    test('все подарки должны иметь необходимые поля', () => {
      Object.values(LEVEL_GIFTS).forEach(gift => {
        expect(gift.id).toBeDefined();
        expect(gift.name).toBeDefined();
        expect(gift.emoji).toBeDefined();
        expect(gift.description).toBeDefined();
        expect(gift.level).toBeDefined();
        expect(gift.sellValue).toBeDefined();
        expect(gift.rarity).toBeDefined();
      });
    });
  });

  describe('RARITY_COLORS', () => {
    test('все редкости должны иметь цвета', () => {
      expect(RARITY_COLORS.common).toBeDefined();
      expect(RARITY_COLORS.uncommon).toBeDefined();
      expect(RARITY_COLORS.rare).toBeDefined();
      expect(RARITY_COLORS.epic).toBeDefined();
      expect(RARITY_COLORS.legendary).toBeDefined();
      expect(RARITY_COLORS.mythic).toBeDefined();
    });
  });

  describe('RARITY_NAMES', () => {
    test('все редкости должны иметь названия', () => {
      expect(RARITY_NAMES.common).toBe('Обычный');
      expect(RARITY_NAMES.uncommon).toBe('Необычный');
      expect(RARITY_NAMES.rare).toBe('Редкий');
      expect(RARITY_NAMES.epic).toBe('Эпический');
      expect(RARITY_NAMES.legendary).toBe('Легендарный');
      expect(RARITY_NAMES.mythic).toBe('Мифический');
    });
  });
});
