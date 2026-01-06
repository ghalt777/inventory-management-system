import {
  getDay,
  lastDayOfMonth,
  getDate,
  getMonth,
  getYear,
  isSameDay,
  addDays,
  startOfDay,
} from 'date-fns';

/**
 * Polish bank holidays (excluding Easter Monday and Corpus Christi which vary by year)
 */
const FIXED_POLISH_HOLIDAYS = [
  { month: 0, day: 1 }, // New Year's Day - January 1
  { month: 4, day: 1 }, // Labour Day - May 1
  { month: 4, day: 3 }, // Constitution Day - May 3
  { month: 7, day: 15 }, // Assumption of Mary - August 15
  { month: 10, day: 1 }, // All Saints' Day - November 1
  { month: 10, day: 11 }, // Independence Day - November 11
  { month: 11, day: 25 }, // Christmas Day - December 25
  { month: 11, day: 26 }, // Second Day of Christmas - December 26
];

/**
 * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month, day);
}

/**
 * Check if a given date is Black Friday (last Friday of November)
 */
export function isBlackFriday(date: Date): boolean {
  const month = getMonth(date);
  const day = getDay(date);

  // Must be in November (month 10) and be a Friday (day 5)
  if (month !== 10 || day !== 5) {
    return false;
  }

  // Check if this is the last Friday
  const lastDay = lastDayOfMonth(date);
  const currentDate = getDate(date);
  const daysUntilEndOfMonth = getDate(lastDay) - currentDate;

  // If there are less than 7 days until end of month, this is the last Friday
  return daysUntilEndOfMonth < 7;
}

/**
 * Check if a given date is a Polish bank holiday
 */
export function isPolishHoliday(date: Date): boolean {
  const dateMonth = getMonth(date);
  const dateDay = getDate(date);
  const year = getYear(date);

  // Check fixed holidays
  for (const holiday of FIXED_POLISH_HOLIDAYS) {
    if (holiday.month === dateMonth && holiday.day === dateDay) {
      return true;
    }
  }

  // Calculate Easter Monday (Easter + 1 day)
  const easter = calculateEaster(year);
  const easterMonday = addDays(easter, 1);
  if (isSameDay(startOfDay(date), startOfDay(easterMonday))) {
    return true;
  }

  // Calculate Corpus Christi (Easter + 60 days)
  const corpusChristi = addDays(easter, 60);
  if (isSameDay(startOfDay(date), startOfDay(corpusChristi))) {
    return true;
  }

  return false;
}

/**
 * Get the category of discount applicable on a given date
 */
export function getDiscountType(date: Date): 'black_friday' | 'holiday' | 'none' {
  if (isBlackFriday(date)) {
    return 'black_friday';
  }

  if (isPolishHoliday(date)) {
    return 'holiday';
  }

  return 'none';
}

