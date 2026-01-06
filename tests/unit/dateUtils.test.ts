import { isBlackFriday, isPolishHoliday, getDiscountType } from '../../src/utils/dateUtils';

describe('DateUtils', () => {
  describe('isBlackFriday', () => {
    it('should return true for last Friday of November', () => {
      // November 29, 2024 (Friday, last week of November)
      expect(isBlackFriday(new Date('2024-11-29'))).toBe(true);
      
      // November 24, 2023 (Friday, last week of November)
      expect(isBlackFriday(new Date('2023-11-24'))).toBe(true);
    });

    it('should return false for earlier Fridays in November', () => {
      // November 22, 2024 (Friday, but not the last one)
      expect(isBlackFriday(new Date('2024-11-22'))).toBe(false);
      
      // November 1, 2024 (Friday, but early in month)
      expect(isBlackFriday(new Date('2024-11-01'))).toBe(false);
    });

    it('should return false for non-November dates', () => {
      expect(isBlackFriday(new Date('2024-12-27'))).toBe(false); // Friday in December
      expect(isBlackFriday(new Date('2024-10-25'))).toBe(false); // Friday in October
    });

    it('should return false for non-Friday dates in November', () => {
      expect(isBlackFriday(new Date('2024-11-30'))).toBe(false); // Saturday
      expect(isBlackFriday(new Date('2024-11-28'))).toBe(false); // Thursday
    });
  });

  describe('isPolishHoliday', () => {
    it('should return true for fixed Polish holidays', () => {
      expect(isPolishHoliday(new Date('2024-01-01'))).toBe(true); // New Year
      expect(isPolishHoliday(new Date('2024-05-01'))).toBe(true); // Labour Day
      expect(isPolishHoliday(new Date('2024-05-03'))).toBe(true); // Constitution Day
      expect(isPolishHoliday(new Date('2024-08-15'))).toBe(true); // Assumption of Mary
      expect(isPolishHoliday(new Date('2024-11-01'))).toBe(true); // All Saints
      expect(isPolishHoliday(new Date('2024-11-11'))).toBe(true); // Independence Day
      expect(isPolishHoliday(new Date('2024-12-25'))).toBe(true); // Christmas
      expect(isPolishHoliday(new Date('2024-12-26'))).toBe(true); // Second Day of Christmas
    });

    it('should return true for Easter Monday 2024', () => {
      // Easter 2024 is March 31, so Easter Monday is April 1
      expect(isPolishHoliday(new Date('2024-04-01'))).toBe(true);
    });

    it('should return true for Corpus Christi 2024', () => {
      // Easter 2024 is March 31, Corpus Christi is 60 days after = May 30
      expect(isPolishHoliday(new Date('2024-05-30'))).toBe(true);
    });

    it('should return false for non-holiday dates', () => {
      expect(isPolishHoliday(new Date('2024-01-02'))).toBe(false);
      expect(isPolishHoliday(new Date('2024-06-15'))).toBe(false);
      expect(isPolishHoliday(new Date('2024-09-01'))).toBe(false);
    });

    it('should handle holidays across different years', () => {
      expect(isPolishHoliday(new Date('2023-01-01'))).toBe(true);
      expect(isPolishHoliday(new Date('2025-12-25'))).toBe(true);
    });
  });

  describe('getDiscountType', () => {
    it('should return black_friday for Black Friday', () => {
      expect(getDiscountType(new Date('2024-11-29'))).toBe('black_friday');
    });

    it('should return holiday for Polish holidays', () => {
      expect(getDiscountType(new Date('2024-01-01'))).toBe('holiday');
      expect(getDiscountType(new Date('2024-12-25'))).toBe('holiday');
    });

    it('should return none for regular days', () => {
      expect(getDiscountType(new Date('2024-01-02'))).toBe('none');
      expect(getDiscountType(new Date('2024-06-15'))).toBe('none');
    });

    it('should prioritize Black Friday over regular day', () => {
      // If Nov 29 were also a holiday (hypothetically), Black Friday takes priority
      expect(getDiscountType(new Date('2024-11-29'))).toBe('black_friday');
    });
  });
});

