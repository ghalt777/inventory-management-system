import { CustomerLocation } from '../models/Order';
import { getDiscountType } from './dateUtils';

export interface DiscountResult {
  type: 'volume' | 'black_friday' | 'holiday' | 'none';
  percentage: number;
  amount: number;
}

export interface PricingDetails {
  subtotal: number;
  locationMultiplier: number;
  adjustedSubtotal: number;
  appliedDiscount: DiscountResult;
  totalAmount: number;
}

/**
 * Categories eligible for holiday discount
 */
const HOLIDAY_ELIGIBLE_CATEGORIES = ['Electronics', 'Home'];

/**
 * Get location-based pricing multiplier
 */
export function getLocationMultiplier(location: CustomerLocation): number {
  switch (location) {
    case 'US':
      return 1.0; // Standard pricing
    case 'Europe':
      return 1.15; // +15% for VAT
    case 'Asia':
      return 0.95; // -5% for reduced logistics
    default:
      return 1.0;
  }
}

/**
 * Calculate volume-based discount percentage
 */
export function calculateVolumeDiscount(totalUnits: number): number {
  if (totalUnits >= 50) {
    return 30;
  } else if (totalUnits >= 10) {
    return 20;
  } else if (totalUnits >= 5) {
    return 10;
  }
  return 0;
}

/**
 * Calculate all applicable discounts and return the best one for the customer
 */
export function calculateBestDiscount(
  adjustedSubtotal: number,
  totalUnits: number,
  categories: string[],
  orderDate: Date = new Date()
): DiscountResult {
  const discounts: DiscountResult[] = [];

  // Volume-based discount
  const volumePercentage = calculateVolumeDiscount(totalUnits);
  if (volumePercentage > 0) {
    discounts.push({
      type: 'volume',
      percentage: volumePercentage,
      amount: (adjustedSubtotal * volumePercentage) / 100,
    });
  }

  // Seasonal discounts
  const seasonalType = getDiscountType(orderDate);

  if (seasonalType === 'black_friday') {
    // Black Friday: 25% off all products
    discounts.push({
      type: 'black_friday',
      percentage: 25,
      amount: (adjustedSubtotal * 25) / 100,
    });
  } else if (seasonalType === 'holiday') {
    // Holiday: 15% off if any product is in eligible categories
    const hasEligibleCategory = categories.some((cat) =>
      HOLIDAY_ELIGIBLE_CATEGORIES.includes(cat)
    );
    if (hasEligibleCategory) {
      discounts.push({
        type: 'holiday',
        percentage: 15,
        amount: (adjustedSubtotal * 15) / 100,
      });
    }
  }

  // If no discounts applicable
  if (discounts.length === 0) {
    return {
      type: 'none',
      percentage: 0,
      amount: 0,
    };
  }

  // Return the highest discount (best for customer)
  return discounts.reduce((best, current) =>
    current.amount > best.amount ? current : best
  );
}

/**
 * Calculate the final pricing for an order
 */
export function calculateOrderPricing(
  baseSubtotal: number,
  totalUnits: number,
  location: CustomerLocation,
  categories: string[],
  orderDate: Date = new Date()
): PricingDetails {
  // Apply location-based pricing
  const locationMultiplier = getLocationMultiplier(location);
  const adjustedSubtotal = baseSubtotal * locationMultiplier;

  // Calculate best discount
  const appliedDiscount = calculateBestDiscount(
    adjustedSubtotal,
    totalUnits,
    categories,
    orderDate
  );

  // Calculate final amount
  const totalAmount = adjustedSubtotal - appliedDiscount.amount;

  return {
    subtotal: baseSubtotal,
    locationMultiplier,
    adjustedSubtotal,
    appliedDiscount,
    totalAmount,
  };
}

