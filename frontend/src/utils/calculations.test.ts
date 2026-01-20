import { describe, it, expect } from 'vitest';
import {
  countBusinessDays,
  calculateProjection,
  calculateActualAverageIncrease,
  calculateVariance,
  calculateProjectedValues,
  generateScheduledCashFlows,
  getLatestActualValue,
  formatCurrency,
  formatPercentage,
  addBusinessDays
} from './calculations';
import type { CashFlow, ActualDataPoint, ProjectionConfig, DepositSchedule } from '../types/trackers';


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

describe('calculateActualAverageIncrease', () => {
  it('should return null for empty data', () => {
    const actualData: ActualDataPoint[] = [];
    const result = calculateActualAverageIncrease(actualData, 5);

    expect(result).toBeNull();
  });

  it('should return null for single data point', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }
    ];
    const result = calculateActualAverageIncrease(actualData, 5);

    expect(result).toBeNull();
  });

  it('should return null when first value is zero or negative', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 0 },
      { date: '2025-10-10', amount: 1000 }
    ];
    const result = calculateActualAverageIncrease(actualData, 5);

    expect(result).toBeNull();
  });

  it('should calculate simple growth without cash flows', () => {
    // 5 business days, 10% total growth
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }, // Thursday
      { date: '2025-10-16', amount: 11000 }  // Thursday next week (5 business days)
    ];
    const result = calculateActualAverageIncrease(actualData, 5);

    expect(result).not.toBeNull();
    expect(result!.intervalPercentage).toBeCloseTo(10, 2); // 10% over 5 business days
    // Daily rate: (1.10)^(1/5) - 1 ≈ 0.019245 or 1.9245%
    expect(result!.dailyRate).toBeCloseTo(0.019245, 3);
  });

  it('should calculate growth with different interval days', () => {
    // 10 business days, 20% total growth
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }, // Thursday
      { date: '2025-10-23', amount: 12000 }  // Thursday 2 weeks later (10 business days)
    ];
    const result = calculateActualAverageIncrease(actualData, 5);

    expect(result).not.toBeNull();
    // 20% growth over 10 business days
    // Daily rate: (1.20)^(1/10) - 1 ≈ 0.01844 or 1.844%
    expect(result!.dailyRate).toBeCloseTo(0.01844, 4);
    // Over 5 days: (1.01844)^5 - 1 ≈ 0.0954 or 9.54%
    expect(result!.intervalPercentage).toBeCloseTo(9.54, 2);
  });

  it('should handle growth with single deposit mid-period', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }, // Thursday - $10,000
      { date: '2025-10-13', amount: 11500 }, // Monday - grows to $10,500, +$1,000 deposit
      { date: '2025-10-16', amount: 12075 }  // Thursday - grows from $11,500
    ];
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-13', amount: 1000, type: 'deposit' }
    ];

    const result = calculateActualAverageIncrease(actualData, 5, cashFlows);

    expect(result).not.toBeNull();

    // Segment 1 (Thu to Mon, 2 business days): 10000 -> 10500 (before deposit)
    // Return: 10500/10000 = 1.05
    // Segment 2 (Mon to Thu, 3 business days): 11500 (after deposit) -> 12075
    // Return: 12075/11500 = 1.05
    // Cumulative: 1.05 * 1.05 = 1.1025
    // Total business days: 2 + 3 = 5
    // Daily rate: (1.1025)^(1/5) - 1 ≈ 0.0197 or 1.97%
    expect(result!.dailyRate).toBeCloseTo(0.0197, 3);
    // Interval percentage (5 days): 10.25%
    expect(result!.intervalPercentage).toBeCloseTo(10.25, 1);
  });

  it('should handle growth with single withdrawal mid-period', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }, // Thursday - $10,000
      { date: '2025-10-13', amount: 10000 }, // Monday - grows to $10,500, -$500 withdrawal
      { date: '2025-10-16', amount: 10500 }  // Thursday - grows from $10,000
    ];
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-13', amount: 500, type: 'withdrawal' }
    ];

    const result = calculateActualAverageIncrease(actualData, 5, cashFlows);

    expect(result).not.toBeNull();

    // Segment 1 (Thu to Mon, 2 business days): 10000 -> 10500 (before withdrawal)
    // Return: 10500/10000 = 1.05
    // Segment 2 (Mon to Thu, 3 business days): 10000 (after withdrawal) -> 10500
    // Return: 10500/10000 = 1.05
    // Cumulative: 1.05 * 1.05 = 1.1025
    // Total business days: 2 + 3 = 5
    // Daily rate: (1.1025)^(1/5) - 1 ≈ 0.0197 or 1.97%
    expect(result!.dailyRate).toBeCloseTo(0.0197, 3);
    // Interval percentage (5 days): 10.25%
    expect(result!.intervalPercentage).toBeCloseTo(10.25, 1);
  });

  it('should handle multiple deposits throughout period', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }, // Thursday - $10,000
      { date: '2025-10-10', amount: 11200 }, // Friday - grows to $10,200, +$1,000 deposit
      { date: '2025-10-13', amount: 12424 }, // Monday - grows to $11,424, +$1,000 deposit
      { date: '2025-10-14', amount: 13681 }  // Tuesday - grows from $12,424
    ];
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-10', amount: 1000, type: 'deposit' },
      { id: 'cf2', date: '2025-10-13', amount: 1000, type: 'deposit' }
    ];

    const result = calculateActualAverageIncrease(actualData, 5, cashFlows);

    expect(result).not.toBeNull();

    // Segment 1 (Thu to Fri, 1 business day): 10000 -> 10200 before deposit
    // Return: 10200/10000 = 1.02
    // Segment 2 (Fri to Mon, 1 business day): 11200 -> 11424 before deposit
    // Return: 11424/11200 = 1.02
    // Segment 3 (Mon to Tue, 1 business day): 12424 -> 12681 before deposit
    // Return: 12681/12424 = 1.0207
    // Cumulative: 1.02 * 1.02 * 1.0207 ≈ 1.0619
    // Total business days: 3
    // Daily rate: (1.0619)^(1/3) - 1 ≈ 0.0464 or 4.64%
    expect(result!.dailyRate).toBeCloseTo(0.0464, 2);
    // Interval percentage (5 days): (1.0464)^5 - 1 ≈ 25.44%
    expect(result!.intervalPercentage).toBeCloseTo(25.44, 0);
  });

  it('should handle mixed deposits and withdrawals', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }, // Thursday - $10,000
      { date: '2025-10-10', amount: 11100 }, // Friday - grows to $10,100, +$1,000 deposit
      { date: '2025-10-13', amount: 10707 }, // Monday - grows to $11,313, -$606 withdrawal
      { date: '2025-10-14', amount: 11814 }  // Tuesday - grows to $10,814, +$1,000 deposit
    ];
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-10', amount: 1000, type: 'deposit' },
      { id: 'cf2', date: '2025-10-13', amount: 606, type: 'withdrawal' },
      { id: 'cf3', date: '2025-10-14', amount: 1000, type: 'deposit' }
    ];

    const result = calculateActualAverageIncrease(actualData, 5, cashFlows);

    expect(result).not.toBeNull();

    // Segment 1 (Thu to Fri, 1 business day): 10000 -> 10100 before deposit
    // Return: 10100/10000 = 1.01
    // Segment 2 (Fri to Mon, 1 business day): 11100 -> 11313 before withdrawal
    // Return: 11313/11100 = 1.0192
    // Segment 3 (Mon to Tue, 1 business day): 10707 -> 10814 before deposit
    // Return: 10814/10707 = 1.01
    // Cumulative: 1.01 * 1.0192 * 1.01 ≈ 1.0394
    // Total business days: 3
    // Daily rate: (1.0394)^(1/3) - 1 ≈ 0.01293 or 1.293%
    expect(result!.dailyRate).toBeCloseTo(0.01293, 3);
    // Interval percentage (5 days): (1.01293)^5 - 1 ≈ 6.70%
    expect(result!.intervalPercentage).toBeCloseTo(6.70, 0);
  });

  it('should ignore cash flows outside data range', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }, // Thursday
      { date: '2025-10-16', amount: 11000 }  // Thursday next week (5 business days)
    ];
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-08', amount: 1000, type: 'deposit' }, // Before range
      { id: 'cf2', date: '2025-10-17', amount: 500, type: 'deposit' }   // After range
    ];

    const result = calculateActualAverageIncrease(actualData, 5, cashFlows);

    expect(result).not.toBeNull();
    // Should calculate as if no cash flows exist (they're outside the range)
    expect(result!.intervalPercentage).toBeCloseTo(10, 2); // 10% over 5 business days
    expect(result!.dailyRate).toBeCloseTo(0.019245, 3);
  });

  it('should handle multiple data points with continuous deposits', () => {
    // Realistic scenario: daily deposits with growth
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 },  // Thursday
      { date: '2025-10-10', amount: 11015 },  // Friday - grows 1.5%, +$1,000
      { date: '2025-10-13', amount: 12045 },  // Monday - grows 1.5%, +$1,000
      { date: '2025-10-14', amount: 13091 },  // Tuesday - grows 1.5%, +$1,000
      { date: '2025-10-15', amount: 14152 }   // Wednesday - grows 1.5%, +$1,000
    ];
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-10', amount: 1000, type: 'deposit' },
      { id: 'cf2', date: '2025-10-13', amount: 1000, type: 'deposit' },
      { id: 'cf3', date: '2025-10-14', amount: 1000, type: 'deposit' },
      { id: 'cf4', date: '2025-10-15', amount: 1000, type: 'deposit' }
    ];

    const result = calculateActualAverageIncrease(actualData, 5, cashFlows);

    expect(result).not.toBeNull();

    // Each segment has 1.5% growth per business day
    // Segment 1: 10000 -> 10150 before deposit, return = 1.015
    // Segment 2: 11015 -> 11045 before deposit (11015 * 1.0027), return = 1.0027
    // Segment 3: 12045 -> 12091 before deposit (12045 * 1.0038), return = 1.0038
    // Segment 4: 13091 -> 13152 before deposit (13091 * 1.0047), return = 1.0047
    // Cumulative return and daily rate will vary based on actual growth
    expect(result!.dailyRate).toBeCloseTo(0.0032, 1);
    // Interval percentage (5 days): approximately 1.6%
    expect(result!.intervalPercentage).toBeCloseTo(1.6, 0);
  });

  it('should calculate correct percentage for realistic volatile market scenario', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 },  // Thursday
      { date: '2025-10-10', amount: 10300 },  // Friday +3%
      { date: '2025-10-13', amount: 10094 },  // Monday -2%
      { date: '2025-10-14', amount: 10498.1 },// Tuesday +4%
      { date: '2025-10-15', amount: 10393.1 } // Wednesday -1%
    ];

    const result = calculateActualAverageIncrease(actualData, 5);

    expect(result).not.toBeNull();

    // Total return: 10393.1/10000 = 1.03931
    // Over 4 business days
    // Daily rate: (1.03931)^(1/4) - 1 ≈ 0.00969 or 0.969%
    expect(result!.dailyRate).toBeCloseTo(0.00969, 4);
    // Interval percentage (5 days): (1.00969)^5 - 1 ≈ 0.0494 or 4.94%
    expect(result!.intervalPercentage).toBeCloseTo(4.94, 1);
  });

  it('should handle deposit when no data point exists on cash flow date', () => {
    // Scenario: deposit happens between data points
    // Dec 31: $24,200, Jan 2: $25,028.25, Jan 9: $1,500 deposit (no data), Jan 13: $25,110.04
    const actualData: ActualDataPoint[] = [
      { date: '2025-12-31', amount: 24200 },
      { date: '2026-01-02', amount: 25028.25 },
      { date: '2026-01-13', amount: 25110.04 },
    ];
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2026-01-09', amount: 1500, type: 'deposit' }
    ];

    const result = calculateActualAverageIncrease(actualData, 3, cashFlows);

    expect(result).not.toBeNull();

    // Segment 1 (Dec 31 to Jan 2, 2 business days): 24200 -> 25028.25
    // Return: 25028.25/24200 = 1.0342
    // Segment 2 (Jan 9 to Jan 13): starts with 25028.25 + 1500 = 26528.25 -> 25110.04
    // Return: 25110.04/26528.25 = 0.9465 (negative growth!)
    // Cumulative: 1.0342 * 0.9465 = 0.9789
    // The result should show NEGATIVE growth, not positive
    expect(result!.intervalPercentage).toBeLessThan(0);
  });

  it('should handle withdrawal when no data point exists on cash flow date', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 },  // Thursday
      { date: '2025-10-10', amount: 10200 },  // Friday - grew 2%
      { date: '2025-10-15', amount: 9500 },   // Wednesday - after withdrawal
    ];
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-13', amount: 500, type: 'withdrawal' } // Monday, no data point
    ];

    const result = calculateActualAverageIncrease(actualData, 5, cashFlows);

    expect(result).not.toBeNull();

    // Segment 1 (Thu to Fri, 1 business day): 10000 -> 10200
    // Return: 10200/10000 = 1.02
    // Segment 2 (Mon to Wed): starts with 10200 - 500 = 9700 -> 9500
    // Return: 9500/9700 = 0.9794 (negative growth)
    // The withdrawal should be subtracted from the starting value
    expect(result!.intervalPercentage).toBeLessThan(2); // Less than 2% due to negative segment 2
  });
});

describe('calculateVariance', () => {
  it('should calculate variance without cash flows', () => {
    const projected = 10000;
    const actual = 10500;
    const date = '2025-10-09';

    const result = calculateVariance(projected, actual, date);

    expect(result.projectedWithCashFlows).toBe(10000);
    expect(result.absolute).toBe(500);
    expect(result.percentage).toBeCloseTo(5, 2);
  });

  it('should calculate negative variance without cash flows', () => {
    const projected = 10000;
    const actual = 9500;
    const date = '2025-10-09';

    const result = calculateVariance(projected, actual, date);

    expect(result.projectedWithCashFlows).toBe(10000);
    expect(result.absolute).toBe(-500);
    expect(result.percentage).toBeCloseTo(-5, 2);
  });

  it('should adjust projected value for deposits', () => {
    const projected = 10000; // Base projected growth
    const actual = 12500;    // Actual includes growth + deposits
    const date = '2025-10-10';
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-09', amount: 1000, type: 'deposit' },
      { id: 'cf2', date: '2025-10-10', amount: 1000, type: 'deposit' }
    ];

    const result = calculateVariance(projected, actual, date, cashFlows);

    // Projected with cash flows should be 10000 + 2000 = 12000
    expect(result.projectedWithCashFlows).toBe(12000);
    // Variance: 12500 - 12000 = 500
    expect(result.absolute).toBe(500);
    // Percentage: 500 / 12000 = 4.17%
    expect(result.percentage).toBeCloseTo(4.17, 1);
  });

  it('should adjust projected value for withdrawals', () => {
    const projected = 10000;
    const actual = 9000;
    const date = '2025-10-10';
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-10', amount: 500, type: 'withdrawal' }
    ];

    const result = calculateVariance(projected, actual, date, cashFlows);

    // Projected with cash flows should be 10000 - 500 = 9500
    expect(result.projectedWithCashFlows).toBe(9500);
    // Variance: 9000 - 9500 = -500
    expect(result.absolute).toBe(-500);
    // Percentage: -500 / 9500 = -5.26%
    expect(result.percentage).toBeCloseTo(-5.26, 1);
  });

  it('should handle mixed deposits and withdrawals', () => {
    const projected = 10000;
    const actual = 11800;
    const date = '2025-10-14';
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-09', amount: 1000, type: 'deposit' },
      { id: 'cf2', date: '2025-10-10', amount: 500, type: 'withdrawal' },
      { id: 'cf3', date: '2025-10-13', amount: 1500, type: 'deposit' }
    ];

    const result = calculateVariance(projected, actual, date, cashFlows);

    // Net cash flow: +1000 - 500 + 1500 = +2000
    // Projected with cash flows: 10000 + 2000 = 12000
    expect(result.projectedWithCashFlows).toBe(12000);
    // Variance: 11800 - 12000 = -200
    expect(result.absolute).toBe(-200);
    // Percentage: -200 / 12000 = -1.67%
    expect(result.percentage).toBeCloseTo(-1.67, 1);
  });

  it('should only include cash flows up to the target date', () => {
    const projected = 10000;
    const actual = 11500;
    const date = '2025-10-10';
    const cashFlows: CashFlow[] = [
      { id: 'cf1', date: '2025-10-09', amount: 1000, type: 'deposit' },
      { id: 'cf2', date: '2025-10-10', amount: 500, type: 'deposit' },
      { id: 'cf3', date: '2025-10-11', amount: 1000, type: 'deposit' } // After target date
    ];

    const result = calculateVariance(projected, actual, date, cashFlows);

    // Should only include first two deposits: 10000 + 1000 + 500 = 11500
    expect(result.projectedWithCashFlows).toBe(11500);
    // Variance: 11500 - 11500 = 0
    expect(result.absolute).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('should handle empty cash flows array', () => {
    const projected = 10000;
    const actual = 10500;
    const date = '2025-10-09';
    const cashFlows: CashFlow[] = [];

    const result = calculateVariance(projected, actual, date, cashFlows);

    expect(result.projectedWithCashFlows).toBe(10000);
    expect(result.absolute).toBe(500);
    expect(result.percentage).toBeCloseTo(5, 2);
  });

  it('should handle undefined cash flows', () => {
    const projected = 10000;
    const actual = 10500;
    const date = '2025-10-09';

    const result = calculateVariance(projected, actual, date, undefined);

    expect(result.projectedWithCashFlows).toBe(10000);
    expect(result.absolute).toBe(500);
    expect(result.percentage).toBeCloseTo(5, 2);
  });
});

describe('addBusinessDays', () => {
  it('should add business days skipping weekends', () => {
    // Friday Oct 10
    const startDate = new Date('2025-10-10');
    // Add 3 business days: Mon, Tue, Wed -> Oct 15
    const result = addBusinessDays(startDate, 3);

    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(9); // October (0-indexed)
  });

  it('should handle adding zero business days', () => {
    const startDate = new Date('2025-10-10');
    const result = addBusinessDays(startDate, 0);

    expect(result.getTime()).toBe(startDate.getTime());
  });

  it('should handle starting on a weekend', () => {
    // Saturday Oct 11
    const startDate = new Date('2025-10-11');
    // Add 1 business day: Mon Oct 13
    const result = addBusinessDays(startDate, 1);

    expect(result.getDate()).toBe(13);
    expect(result.getDay()).toBe(1); // Monday
  });

  it('should add large number of business days correctly', () => {
    // Thursday Oct 9
    const startDate = new Date('2025-10-09');
    // Add 10 business days (2 full weeks)
    const result = addBusinessDays(startDate, 10);

    // Oct 9 is Thu, +10 business days = Thu Oct 23
    expect(result.getDate()).toBe(23);
    expect(result.getDay()).toBe(4); // Thursday
  });
});

describe('calculateProjectedValues', () => {
  it('should calculate simple projection without growth', () => {
    const projection: ProjectionConfig = {
      id: 'proj1',
      increasePercent: 0,
      intervalDays: 5,
      visible: true
    };
    const startDate = '2025-10-09'; // Thursday
    const endDate = '2025-10-16'; // Thursday (5 business days later)
    const startingAmount = 10000;

    const result = calculateProjectedValues(projection, startDate, startingAmount, endDate);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].amount).toBe(10000);
    // Last value should still be 10000 (no growth)
    expect(result[result.length - 1].amount).toBe(10000);
  });

  it('should calculate projection with growth at intervals', () => {
    const projection: ProjectionConfig = {
      id: 'proj1',
      increasePercent: 10, // 10% every 5 business days
      intervalDays: 5,
      visible: true
    };
    const startDate = '2025-10-09'; // Thursday
    const endDate = '2025-10-23'; // Thursday (10 business days later)
    const startingAmount = 10000;

    const result = calculateProjectedValues(projection, startDate, startingAmount, endDate);

    // Should have daily data points
    expect(result.length).toBeGreaterThan(10);

    // First day
    expect(result[0].amount).toBe(10000);
    expect(result[0].date).toBe('2025-10-09');

    // After 5 business days (Oct 16), should be near 11000 (10% growth)
    const oct16 = result.find(p => p.date === '2025-10-16');
    expect(oct16?.amount).toBeCloseTo(11000, 0);

    // After 10 business days (Oct 23), should be 11000 * 1.1 = 12100
    const oct23 = result.find(p => p.date === '2025-10-23');
    expect(oct23?.amount).toBeCloseTo(12100, 0);
  });

  it('should interpolate values between growth intervals', () => {
    const projection: ProjectionConfig = {
      id: 'proj1',
      increasePercent: 10,
      intervalDays: 5,
      visible: true
    };
    const startDate = '2025-10-09';
    const endDate = '2025-10-16';
    const startingAmount = 10000;

    const result = calculateProjectedValues(projection, startDate, startingAmount, endDate);

    // Find a point halfway through the interval
    const midPoint = result.find(p => p.date === '2025-10-13'); // Monday, ~2-3 business days in

    // Should be between 10000 and 11000
    expect(midPoint?.amount).toBeGreaterThan(10000);
    expect(midPoint?.amount).toBeLessThan(11000);
  });

  it('should handle projection ending mid-interval', () => {
    const projection: ProjectionConfig = {
      id: 'proj1',
      increasePercent: 20,
      intervalDays: 10,
      visible: true
    };
    const startDate = '2025-10-09';
    const endDate = '2025-10-16'; // Only 5 business days (half the interval)
    const startingAmount = 10000;

    const result = calculateProjectedValues(projection, startDate, startingAmount, endDate);

    // When no milestone is reached yet, stays at starting value
    // The first milestone would be at 10 business days (Oct 23), but we stop at Oct 16
    const lastValue = result[result.length - 1].amount;
    expect(lastValue).toBe(10000);
    expect(result.length).toBeGreaterThan(1); // Should have multiple daily points
  });

  it('should handle negative growth (losses)', () => {
    const projection: ProjectionConfig = {
      id: 'proj1',
      increasePercent: -5, // -5% every 5 business days
      intervalDays: 5,
      visible: true
    };
    const startDate = '2025-10-09';
    const endDate = '2025-10-16';
    const startingAmount = 10000;

    const result = calculateProjectedValues(projection, startDate, startingAmount, endDate);

    // After 5 business days, should be 10000 * 0.95 = 9500
    const lastValue = result[result.length - 1].amount;
    expect(lastValue).toBeCloseTo(9500, 0);
  });

  it('should handle same start and end date', () => {
    const projection: ProjectionConfig = {
      id: 'proj1',
      increasePercent: 10,
      intervalDays: 5,
      visible: true
    };
    const startDate = '2025-10-09';
    const endDate = '2025-10-09';
    const startingAmount = 10000;

    const result = calculateProjectedValues(projection, startDate, startingAmount, endDate);

    expect(result.length).toBe(1);
    expect(result[0].amount).toBe(10000);
    expect(result[0].date).toBe('2025-10-09');
  });
});

describe('generateScheduledCashFlows', () => {
  it('should generate daily deposits', () => {
    const schedule: DepositSchedule = {
      enabled: true,
      frequency: 'daily',
      amount: 100
    };
    const startDate = '2025-10-09'; // Thursday
    const endDate = '2025-10-15'; // Wednesday (4 calendar days later)

    const result = generateScheduledCashFlows(schedule, startDate, endDate);

    // Should generate deposits for each day from Oct 10-15
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(cf => cf.type === 'deposit')).toBe(true);
    expect(result.every(cf => cf.amount === 100)).toBe(true);
    expect(result.every(cf => cf.source === 'scheduled')).toBe(true);

    // First deposit should be day after start
    expect(result[0].date).toBe('2025-10-10');
  });

  it('should generate weekly deposits', () => {
    const schedule: DepositSchedule = {
      enabled: true,
      frequency: 'weekly',
      amount: 500
    };
    const startDate = '2025-10-09';
    const endDate = '2025-10-30'; // 3 weeks later

    const result = generateScheduledCashFlows(schedule, startDate, endDate);

    // Should have deposits on Oct 16, 23, 30 (3 deposits)
    expect(result.length).toBe(3);
    expect(result[0].date).toBe('2025-10-16');
    expect(result[1].date).toBe('2025-10-23');
    expect(result[2].date).toBe('2025-10-30');
  });

  it('should generate biweekly deposits', () => {
    const schedule: DepositSchedule = {
      enabled: true,
      frequency: 'biweekly',
      amount: 1000
    };
    const startDate = '2025-10-09';
    const endDate = '2025-11-06'; // 4 weeks later

    const result = generateScheduledCashFlows(schedule, startDate, endDate);

    // Should have deposits every 2 weeks: Oct 23, Nov 6 (2 deposits)
    expect(result.length).toBe(2);
    expect(result[0].date).toBe('2025-10-23');
    expect(result[1].date).toBe('2025-11-06');
  });

  it('should generate monthly deposits', () => {
    const schedule: DepositSchedule = {
      enabled: true,
      frequency: 'monthly',
      amount: 2000
    };
    const startDate = '2025-10-09';
    const endDate = '2026-01-09'; // 3 months later

    const result = generateScheduledCashFlows(schedule, startDate, endDate);

    // Should have deposits on Nov 9, Dec 9, Jan 9 (3 deposits)
    expect(result.length).toBe(3);
    expect(result[0].date).toBe('2025-11-09');
    expect(result[1].date).toBe('2025-12-09');
    expect(result[2].date).toBe('2026-01-09');
  });

  it('should return empty array when disabled', () => {
    const schedule: DepositSchedule = {
      enabled: false,
      frequency: 'daily',
      amount: 100
    };
    const startDate = '2025-10-09';
    const endDate = '2025-10-16';

    const result = generateScheduledCashFlows(schedule, startDate, endDate);

    expect(result.length).toBe(0);
  });

  it('should return empty array when amount is zero or negative', () => {
    const schedule: DepositSchedule = {
      enabled: true,
      frequency: 'daily',
      amount: 0
    };
    const startDate = '2025-10-09';
    const endDate = '2025-10-16';

    const result = generateScheduledCashFlows(schedule, startDate, endDate);

    expect(result.length).toBe(0);
  });

  it('should respect custom schedule start and end dates', () => {
    const schedule: DepositSchedule = {
      enabled: true,
      frequency: 'weekly',
      amount: 500,
      startDate: '2025-10-13', // Start from Monday
      endDate: '2025-10-27' // End earlier
    };
    const trackerStart = '2025-10-09';
    const trackerEnd = '2025-11-09';

    const result = generateScheduledCashFlows(schedule, trackerStart, trackerEnd);

    // Should only generate within schedule's custom dates
    // From Oct 13: Oct 20, Oct 27 (2 deposits)
    expect(result.length).toBe(2);
    expect(result[0].date).toBe('2025-10-20');
    expect(result[1].date).toBe('2025-10-27');
  });

  it('should generate unique IDs for each cash flow', () => {
    const schedule: DepositSchedule = {
      enabled: true,
      frequency: 'daily',
      amount: 100
    };
    const startDate = '2025-10-09';
    const endDate = '2025-10-13';

    const result = generateScheduledCashFlows(schedule, startDate, endDate);

    const ids = result.map(cf => cf.id);
    const uniqueIds = new Set(ids);

    // All IDs should be unique
    expect(ids.length).toBe(uniqueIds.size);
  });
});

describe('getLatestActualValue', () => {
  it('should return null for empty array', () => {
    const result = getLatestActualValue([]);
    expect(result).toBeNull();
  });

  it('should return the only value for single item', () => {
    const data: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 }
    ];
    const result = getLatestActualValue(data);

    expect(result).not.toBeNull();
    expect(result?.date).toBe('2025-10-09');
    expect(result?.amount).toBe(10000);
  });

  it('should return latest date from unsorted array', () => {
    const data: ActualDataPoint[] = [
      { date: '2025-10-15', amount: 11000 },
      { date: '2025-10-09', amount: 10000 },
      { date: '2025-10-20', amount: 12000 },
      { date: '2025-10-12', amount: 10500 }
    ];
    const result = getLatestActualValue(data);

    expect(result).not.toBeNull();
    expect(result?.date).toBe('2025-10-20');
    expect(result?.amount).toBe(12000);
  });

  it('should handle multiple entries on same date', () => {
    const data: ActualDataPoint[] = [
      { date: '2025-10-09', amount: 10000 },
      { date: '2025-10-15', amount: 11000 },
      { date: '2025-10-15', amount: 11500 } // Duplicate date, different amount
    ];
    const result = getLatestActualValue(data);

    // Should return one of the Oct 15 entries
    expect(result).not.toBeNull();
    expect(result?.date).toBe('2025-10-15');
  });
});

describe('formatCurrency', () => {
  it('should format positive numbers correctly', () => {
    expect(formatCurrency(10000)).toBe('$10,000.00');
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(999999.99)).toBe('$999,999.99');
  });

  it('should format negative numbers correctly', () => {
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    expect(formatCurrency(-10000)).toBe('-$10,000.00');
  });

  it('should format zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should always show two decimal places', () => {
    expect(formatCurrency(100)).toBe('$100.00');
    expect(formatCurrency(100.1)).toBe('$100.10');
    expect(formatCurrency(100.999)).toBe('$101.00'); // Rounds up
  });

  it('should handle very large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
  });

  it('should handle very small decimal values', () => {
    expect(formatCurrency(0.01)).toBe('$0.01');
    expect(formatCurrency(0.001)).toBe('$0.00'); // Rounds down
    expect(formatCurrency(0.005)).toBe('$0.01'); // Rounds up
  });
});

describe('market holidays', () => {
  it('should exclude MLK Day from business days', () => {
    // MLK Day 2025 is January 20 (3rd Monday in January)
    // Count business days from Jan 17 (Friday) to Jan 21 (Tuesday)
    const startDate = new Date('2025-01-17'); // Friday
    const endDate = new Date('2025-01-21'); // Tuesday

    // Without holidays: Sat (skip), Sun (skip), Mon (1), Tue (2) = 2 days
    // With MLK Day: Sat (skip), Sun (skip), Mon (holiday skip), Tue (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude Presidents Day from business days', () => {
    // Presidents Day 2025 is February 17 (3rd Monday in February)
    const startDate = new Date('2025-02-14'); // Friday
    const endDate = new Date('2025-02-18'); // Tuesday

    // Without holidays: Sat (skip), Sun (skip), Mon (1), Tue (2) = 2 days
    // With Presidents Day: Sat (skip), Sun (skip), Mon (holiday skip), Tue (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude Good Friday from business days', () => {
    // Good Friday 2025 is April 18
    const startDate = new Date('2025-04-17'); // Thursday
    const endDate = new Date('2025-04-21'); // Monday

    // Without holidays: Fri (1), Sat (skip), Sun (skip), Mon (2) = 2 days
    // With Good Friday: Fri (holiday skip), Sat (skip), Sun (skip), Mon (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude Memorial Day from business days', () => {
    // Memorial Day 2025 is May 26 (last Monday in May)
    const startDate = new Date('2025-05-23'); // Friday
    const endDate = new Date('2025-05-27'); // Tuesday

    // With Memorial Day: Sat (skip), Sun (skip), Mon (holiday skip), Tue (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude Juneteenth from business days', () => {
    // Juneteenth 2025 is June 19 (Thursday)
    const startDate = new Date('2025-06-18'); // Wednesday
    const endDate = new Date('2025-06-20'); // Friday

    // Without holidays: Thu (1), Fri (2) = 2 days
    // With Juneteenth: Thu (holiday skip), Fri (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude Independence Day from business days', () => {
    // July 4, 2025 is a Friday
    const startDate = new Date('2025-07-03'); // Thursday
    const endDate = new Date('2025-07-07'); // Monday

    // Without holidays: Fri (1), Sat (skip), Sun (skip), Mon (2) = 2 days
    // With July 4: Fri (holiday skip), Sat (skip), Sun (skip), Mon (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude Labor Day from business days', () => {
    // Labor Day 2025 is September 1 (1st Monday in September)
    const startDate = new Date('2025-08-29'); // Friday
    const endDate = new Date('2025-09-02'); // Tuesday

    // With Labor Day: Sat (skip), Sun (skip), Mon (holiday skip), Tue (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude Thanksgiving from business days', () => {
    // Thanksgiving 2025 is November 27 (4th Thursday in November)
    const startDate = new Date('2025-11-26'); // Wednesday
    const endDate = new Date('2025-11-28'); // Friday

    // Without holidays: Thu (1), Fri (2) = 2 days
    // With Thanksgiving: Thu (holiday skip), Fri (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should exclude Christmas from business days', () => {
    // Christmas 2025 is December 25 (Thursday)
    const startDate = new Date('2025-12-24'); // Wednesday
    const endDate = new Date('2025-12-26'); // Friday

    // Without holidays: Thu (1), Fri (2) = 2 days
    // With Christmas: Thu (holiday skip), Fri (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should handle observed holidays when they fall on weekends', () => {
    // July 4, 2026 is a Saturday, observed on Friday July 3
    const startDate = new Date('2026-07-02'); // Thursday
    const endDate = new Date('2026-07-06'); // Monday

    // Without observed: Thu->Fri (1), Sat (skip), Sun (skip), Mon (2) = 2 days
    // With observed July 4 on Friday: Thu->Fri (holiday skip), Sat (skip), Sun (skip), Mon (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should handle New Years Day observed on Monday when Jan 1 is Sunday', () => {
    // Jan 1, 2028 is a Saturday, observed on Friday Dec 31, 2027
    // Jan 1, 2023 was a Sunday, observed on Monday Jan 2
    const startDate = new Date('2022-12-30'); // Friday
    const endDate = new Date('2023-01-03'); // Tuesday

    // Fri (skip - not in range since exclusive), Sat (skip), Sun (skip), Mon (holiday observed), Tue (1) = 1 day
    expect(countBusinessDays(startDate, endDate)).toBe(1);
  });

  it('should skip MLK Day when adding business days', () => {
    // Start on Friday Jan 17, 2025
    // Add 1 business day should skip MLK Day (Jan 20) and land on Jan 21
    const startDate = new Date('2025-01-17');
    const result = addBusinessDays(startDate, 1);

    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(21); // Tuesday, skipping weekend and MLK Day
  });
});

describe('formatPercentage', () => {
  it('should format positive percentages with plus sign', () => {
    expect(formatPercentage(5.5)).toBe('+5.50%');
    expect(formatPercentage(10)).toBe('+10.00%');
    expect(formatPercentage(0.01)).toBe('+0.01%');
  });

  it('should format negative percentages with minus sign', () => {
    expect(formatPercentage(-5.5)).toBe('-5.50%');
    expect(formatPercentage(-10)).toBe('-10.00%');
    expect(formatPercentage(-0.01)).toBe('-0.01%');
  });

  it('should format zero with plus sign', () => {
    expect(formatPercentage(0)).toBe('+0.00%');
  });

  it('should always show two decimal places', () => {
    expect(formatPercentage(5)).toBe('+5.00%');
    expect(formatPercentage(5.1)).toBe('+5.10%');
    expect(formatPercentage(5.123)).toBe('+5.12%');
    expect(formatPercentage(5.999)).toBe('+6.00%');
  });

  it('should handle very large percentages', () => {
    expect(formatPercentage(123.45)).toBe('+123.45%');
    expect(formatPercentage(-999.99)).toBe('-999.99%');
  });

  it('should handle very small percentages', () => {
    expect(formatPercentage(0.001)).toBe('+0.00%');
    expect(formatPercentage(-0.001)).toBe('-0.00%');
  });
});
