import { describe, it, expect } from 'vitest';
import { calculateActualAverageIncrease, countBusinessDays, calculateProjection } from './calculations';
import type { ActualDataPoint, CashFlow } from '../types/investment';

describe('calculateActualAverageIncrease', () => {
  // Shared actual data - investment values only, excluding cash flows
  const baseActualData: ActualDataPoint[] = [
    { date: '2025-10-09', amount: 41450 },
    { date: '2025-10-10', amount: 41984.05 }
  ];

  it('should return null when there is insufficient data', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 41450 }
    ];

    const result = calculateActualAverageIncrease(actualData, 3);

    expect(result).toBeNull();
  });

  it('should calculate percentage increase from actual data', () => {
    const result = calculateActualAverageIncrease(baseActualData, 3);

    expect(result).not.toBeNull();
    if (result) {
      // Total increase: (41984.05 - 41450) / 41450 = 1.288%
      expect(result.intervalPercentage).toBeCloseTo(1.288, 2);

      // Daily rate: (1.01288)^(1/3) - 1 ≈ 0.00427642
      expect(result.dailyRate).toBeCloseTo(0.00427642, 5);
    }
  });

  it('should calculate increase over longer time period', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 41450 },
      { date: '2025-10-15', amount: 42500 }
    ];

    const result = calculateActualAverageIncrease(actualData, 3);

    expect(result).not.toBeNull();
    if (result) {
      // (42500 - 41450) / 41450 = 2.533%
      expect(result.intervalPercentage).toBeCloseTo(2.533, 2);
    }
  });

  it('should return null when first value is zero or negative', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 0 },
      { date: '2025-10-10', amount: 2000 }
    ];

    const result = calculateActualAverageIncrease(actualData, 3);

    // First value is 0, should return null
    expect(result).toBeNull();
  });

  it('should use the correct interval days for daily rate calculation', () => {
    // Test with 5-day interval
    const result5Day = calculateActualAverageIncrease(baseActualData, 5);

    expect(result5Day).not.toBeNull();
    if (result5Day) {
      // Total increase is still 1.288%
      expect(result5Day.intervalPercentage).toBeCloseTo(1.288, 2);

      // But daily rate should be (1.01288)^(1/5) - 1 ≈ 0.00256366
      expect(result5Day.dailyRate).toBeCloseTo(0.00256366, 5);
    }
  });
});

describe('countBusinessDays', () => {
  it('should count business days correctly', () => {
    // Oct 9, 2025 (Thursday) to Oct 10, 2025 (Friday) = 1 business day
    const startDate = new Date('2025-10-09');
    const endDate = new Date('2025-10-10');

    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude weekends', () => {
    // Oct 9, 2025 (Thursday) to Oct 13, 2025 (Monday) = 2 business days (Fri, Mon)
    const startDate = new Date('2025-10-09');
    const endDate = new Date('2025-10-13');

    expect(countBusinessDays(startDate, endDate)).toBe(2);
  });

  it('should return 0 for same day', () => {
    const date = new Date('2025-10-09');

    expect(countBusinessDays(date, date)).toBe(0);
  });
});

describe('calculateProjection', () => {
  it('should calculate basic projection without cash flows', () => {
    const baseData = [
      { date: '2025-10-09', amount: 0 }, // Thursday
      { date: '2025-10-10', amount: 0 }, // Friday
      { date: '2025-10-13', amount: 0 }  // Monday (skip weekend)
    ];
    const startingAmount = 10000;
    const dailyRate = 0.001; // 0.1% per day
    const cashFlows: CashFlow[] = [];

    const result = calculateProjection(baseData, startingAmount, dailyRate, cashFlows);

    // Day 0 (Thu): 10000
    expect(result.get('2025-10-09')).toBeCloseTo(10000, 2);
    // Day 1 (Fri): 10000 * 1.001^1 = 10010
    expect(result.get('2025-10-10')).toBeCloseTo(10010, 2);
    // Day 2 (Mon): 10010 * 1.001^1 = 10020.01 (1 business day from Fri to Mon)
    expect(result.get('2025-10-13')).toBeCloseTo(10020.01, 2);
  });

  it('should apply deposit on specific date', () => {
    const baseData = [
      { date: '2025-10-09', amount: 0 }, // Thursday
      { date: '2025-10-10', amount: 0 }, // Friday
      { date: '2025-10-13', amount: 0 }  // Monday
    ];
    const startingAmount = 10000;
    const dailyRate = 0.001;
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-10', amount: 1000, type: 'deposit' }
    ];

    const result = calculateProjection(baseData, startingAmount, dailyRate, cashFlows);

    // Day 0 (Thu): 10000 (no deposit yet)
    expect(result.get('2025-10-09')).toBeCloseTo(10000, 2);
    // Day 1 (Fri): 10000 * 1.001 + 1000 = 11010
    expect(result.get('2025-10-10')).toBeCloseTo(11010, 2);
    // Day 2 (Mon): 11010 * 1.001 = 11021.01 (1 business day)
    expect(result.get('2025-10-13')).toBeCloseTo(11021.01, 2);
  });

  it('should apply withdrawal on specific date', () => {
    const baseData = [
      { date: '2025-10-09', amount: 0 }, // Thursday
      { date: '2025-10-10', amount: 0 }, // Friday
      { date: '2025-10-13', amount: 0 }  // Monday
    ];
    const startingAmount = 10000;
    const dailyRate = 0.001;
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-10', amount: 500, type: 'withdrawal' }
    ];

    const result = calculateProjection(baseData, startingAmount, dailyRate, cashFlows);

    // Day 0 (Thu): 10000 (no withdrawal yet)
    expect(result.get('2025-10-09')).toBeCloseTo(10000, 2);
    // Day 1 (Fri): 10000 * 1.001 - 500 = 9510
    expect(result.get('2025-10-10')).toBeCloseTo(9510, 2);
    // Day 2 (Mon): 9510 * 1.001 = 9519.51 (1 business day)
    expect(result.get('2025-10-13')).toBeCloseTo(9519.51, 2);
  });

  it('should handle multiple cash flows across different dates', () => {
    const baseData = [
      { date: '2025-10-09', amount: 0 }, // Thursday
      { date: '2025-10-10', amount: 0 }, // Friday
      { date: '2025-10-13', amount: 0 }, // Monday
      { date: '2025-10-14', amount: 0 }  // Tuesday
    ];
    const startingAmount = 10000;
    const dailyRate = 0.001;
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-10', amount: 1000, type: 'deposit' },
      { id: 'cf2', date: '2025-10-13', amount: 500, type: 'withdrawal' }
    ];

    const result = calculateProjection(baseData, startingAmount, dailyRate, cashFlows);

    // Day 0 (Thu): 10000
    expect(result.get('2025-10-09')).toBeCloseTo(10000, 2);
    // Day 1 (Fri): 10000 * 1.001 + 1000 = 11010
    expect(result.get('2025-10-10')).toBeCloseTo(11010, 2);
    // Day 2 (Mon): 11010 * 1.001 - 500 = 10521.01 (1 business day)
    expect(result.get('2025-10-13')).toBeCloseTo(10521.01, 2);
    // Day 3 (Tue): 10521.01 * 1.001 = 10531.53
    expect(result.get('2025-10-14')).toBeCloseTo(10531.53, 2);
  });

  it('should include cash flows at start date', () => {
    const baseData = [
      { date: '2025-10-09', amount: 0 },
      { date: '2025-10-10', amount: 0 }
    ];
    const startingAmount = 10000;
    const dailyRate = 0.001;
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-09', amount: 2000, type: 'deposit' }
    ];

    const result = calculateProjection(baseData, startingAmount, dailyRate, cashFlows);

    // Day 0: 10000 + 2000 = 12000 (deposit on start date)
    expect(result.get('2025-10-09')).toBeCloseTo(12000, 2);
    // Day 1: 12000 * 1.001 = 12012
    expect(result.get('2025-10-10')).toBeCloseTo(12012, 2);
  });

  it('should compound growth correctly with multiple consecutive deposits', () => {
    const baseData = [
      { date: '2025-10-09', amount: 0 }, // Thursday
      { date: '2025-10-10', amount: 0 }, // Friday
      { date: '2025-10-13', amount: 0 }, // Monday
      { date: '2025-10-14', amount: 0 }  // Tuesday
    ];
    const startingAmount = 10000;
    const dailyRate = 0.002; // 0.2% per day
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-10', amount: 500, type: 'deposit' },
      { id: 'cf2', date: '2025-10-13', amount: 300, type: 'deposit' },
      { id: 'cf3', date: '2025-10-14', amount: 200, type: 'deposit' }
    ];

    const result = calculateProjection(baseData, startingAmount, dailyRate, cashFlows);

    // Day 0 (Thu): 10000
    expect(result.get('2025-10-09')).toBeCloseTo(10000, 2);
    // Day 1 (Fri): 10000 * 1.002 + 500 = 10520
    expect(result.get('2025-10-10')).toBeCloseTo(10520, 2);
    // Day 2 (Mon): 10520 * 1.002 + 300 = 10841.04 (1 business day)
    expect(result.get('2025-10-13')).toBeCloseTo(10841.04, 2);
    // Day 3 (Tue): 10841.04 * 1.002 + 200 = 11062.72
    expect(result.get('2025-10-14')).toBeCloseTo(11062.72, 2);
  });

  it('should handle mix of deposits and withdrawals', () => {
    const baseData = [
      { date: '2025-10-09', amount: 0 }, // Thursday
      { date: '2025-10-10', amount: 0 }, // Friday
      { date: '2025-10-13', amount: 0 }, // Monday
      { date: '2025-10-14', amount: 0 }, // Tuesday
      { date: '2025-10-15', amount: 0 }  // Wednesday
    ];
    const startingAmount = 10000;
    const dailyRate = 0.001;
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-09', amount: 500, type: 'deposit' },
      { id: 'cf2', date: '2025-10-10', amount: 1000, type: 'deposit' },
      { id: 'cf3', date: '2025-10-13', amount: 300, type: 'withdrawal' },
      { id: 'cf4', date: '2025-10-14', amount: 750, type: 'deposit' },
      { id: 'cf5', date: '2025-10-15', amount: 200, type: 'withdrawal' }
    ];

    const result = calculateProjection(baseData, startingAmount, dailyRate, cashFlows);

    // Day 0 (Thu): 10000 + 500 = 10500
    expect(result.get('2025-10-09')).toBeCloseTo(10500, 2);
    // Day 1 (Fri): 10500 * 1.001 + 1000 = 11510.5
    expect(result.get('2025-10-10')).toBeCloseTo(11510.5, 2);
    // Day 2 (Mon): 11510.5 * 1.001 - 300 = 11222.01 (1 business day)
    expect(result.get('2025-10-13')).toBeCloseTo(11222.01, 2);
    // Day 3 (Tue): 11222.01 * 1.001 + 750 = 11983.23
    expect(result.get('2025-10-14')).toBeCloseTo(11983.23, 2);
    // Day 4 (Wed): 11983.23 * 1.001 - 200 = 11795.22
    expect(result.get('2025-10-15')).toBeCloseTo(11795.22, 1);
  });
});
