import {
  getLocationMultiplier,
  calculateVolumeDiscount,
  calculateBestDiscount,
  calculateOrderPricing,
} from '../../src/utils/discountCalculator';

describe('DiscountCalculator', () => {
  describe('getLocationMultiplier', () => {
    it('should return 1.0 for US', () => {
      expect(getLocationMultiplier('US')).toBe(1.0);
    });

    it('should return 1.15 for Europe', () => {
      expect(getLocationMultiplier('Europe')).toBe(1.15);
    });

    it('should return 0.95 for Asia', () => {
      expect(getLocationMultiplier('Asia')).toBe(0.95);
    });
  });

  describe('calculateVolumeDiscount', () => {
    it('should return 0% for less than 5 units', () => {
      expect(calculateVolumeDiscount(4)).toBe(0);
      expect(calculateVolumeDiscount(1)).toBe(0);
    });

    it('should return 10% for 5-9 units', () => {
      expect(calculateVolumeDiscount(5)).toBe(10);
      expect(calculateVolumeDiscount(7)).toBe(10);
      expect(calculateVolumeDiscount(9)).toBe(10);
    });

    it('should return 20% for 10-49 units', () => {
      expect(calculateVolumeDiscount(10)).toBe(20);
      expect(calculateVolumeDiscount(25)).toBe(20);
      expect(calculateVolumeDiscount(49)).toBe(20);
    });

    it('should return 30% for 50+ units', () => {
      expect(calculateVolumeDiscount(50)).toBe(30);
      expect(calculateVolumeDiscount(100)).toBe(30);
    });
  });

  describe('calculateBestDiscount', () => {
    it('should return no discount if no conditions are met', () => {
      const result = calculateBestDiscount(100, 3, ['Other'], new Date('2024-01-02'));
      expect(result.type).toBe('none');
      expect(result.percentage).toBe(0);
      expect(result.amount).toBe(0);
    });

    it('should apply volume discount when eligible', () => {
      const result = calculateBestDiscount(100, 10, ['Other'], new Date('2024-01-02'));
      expect(result.type).toBe('volume');
      expect(result.percentage).toBe(20);
      expect(result.amount).toBe(20);
    });

    it('should apply Black Friday discount when applicable', () => {
      // Last Friday of November 2024 is November 29
      const blackFriday = new Date('2024-11-29');
      const result = calculateBestDiscount(100, 3, ['Other'], blackFriday);
      expect(result.type).toBe('black_friday');
      expect(result.percentage).toBe(25);
      expect(result.amount).toBe(25);
    });

    it('should apply holiday discount for eligible categories', () => {
      // New Year's Day 2024
      const holiday = new Date('2024-01-01');
      const result = calculateBestDiscount(100, 3, ['Electronics'], holiday);
      expect(result.type).toBe('holiday');
      expect(result.percentage).toBe(15);
      expect(result.amount).toBe(15);
    });

    it('should not apply holiday discount for non-eligible categories', () => {
      const holiday = new Date('2024-01-01');
      const result = calculateBestDiscount(100, 3, ['Other'], holiday);
      expect(result.type).toBe('none');
    });

    it('should choose the best discount for customer (highest amount)', () => {
      // Black Friday with volume discount eligible
      const blackFriday = new Date('2024-11-29');
      const result = calculateBestDiscount(100, 10, ['Other'], blackFriday);
      // Volume: 20%, Black Friday: 25%
      expect(result.type).toBe('black_friday');
      expect(result.percentage).toBe(25);
    });

    it('should choose volume discount over holiday when better', () => {
      // Holiday with 50+ units (30% volume discount > 15% holiday)
      const holiday = new Date('2024-01-01');
      const result = calculateBestDiscount(100, 50, ['Electronics'], holiday);
      expect(result.type).toBe('volume');
      expect(result.percentage).toBe(30);
    });
  });

  describe('calculateOrderPricing', () => {
    it('should calculate pricing correctly for US with no discount', () => {
      const result = calculateOrderPricing(100, 3, 'US', ['Other'], new Date('2024-01-02'));
      expect(result.subtotal).toBe(100);
      expect(result.locationMultiplier).toBe(1.0);
      expect(result.adjustedSubtotal).toBe(100);
      expect(result.appliedDiscount.type).toBe('none');
      expect(result.totalAmount).toBe(100);
    });

    it('should apply location pricing for Europe', () => {
      const result = calculateOrderPricing(100, 3, 'Europe', ['Other'], new Date('2024-01-02'));
      expect(result.subtotal).toBe(100);
      expect(result.locationMultiplier).toBe(1.15);
      expect(result.adjustedSubtotal).toBeCloseTo(115, 2);
      expect(result.totalAmount).toBeCloseTo(115, 2);
    });

    it('should apply location pricing for Asia', () => {
      const result = calculateOrderPricing(100, 3, 'Asia', ['Other'], new Date('2024-01-02'));
      expect(result.subtotal).toBe(100);
      expect(result.locationMultiplier).toBe(0.95);
      expect(result.adjustedSubtotal).toBe(95);
      expect(result.totalAmount).toBe(95);
    });

    it('should apply discount to location-adjusted price', () => {
      const result = calculateOrderPricing(100, 10, 'Europe', ['Other'], new Date('2024-01-02'));
      // Base: 100, Europe: 115, Volume 20%: -23, Total: 92
      expect(result.subtotal).toBe(100);
      expect(result.adjustedSubtotal).toBeCloseTo(115, 2);
      expect(result.appliedDiscount.percentage).toBe(20);
      expect(result.appliedDiscount.amount).toBeCloseTo(23, 2);
      expect(result.totalAmount).toBeCloseTo(92, 2);
    });

    it('should calculate complex scenario correctly', () => {
      // Black Friday, Europe, 100 units
      const blackFriday = new Date('2024-11-29');
      const result = calculateOrderPricing(200, 100, 'Europe', ['Electronics'], blackFriday);
      
      // Base: 200
      // Europe: 200 * 1.15 = 230
      // Volume discount: 30% = 69
      // Black Friday discount: 25% = 57.5
      // Best discount: Volume 30% = 69
      // Total: 230 - 69 = 161
      
      expect(result.subtotal).toBe(200);
      expect(result.adjustedSubtotal).toBeCloseTo(230, 2);
      expect(result.appliedDiscount.type).toBe('volume');
      expect(result.appliedDiscount.percentage).toBe(30);
      expect(result.totalAmount).toBeCloseTo(161, 2);
    });
  });
});

