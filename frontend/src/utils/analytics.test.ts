import { describe, it, expect } from 'vitest';
import {
  calculateReturn,
  calculateRollingReturns,
  calculateDrawdown,
  calculateVolatility,
  calculateSharpeRatio,
  getBestWorstPeriods,
  calculateWinRate,
  calculateAnnualizedReturn,
  calculatePerformanceSummary
} from './analytics';
import type { ActualDataPoint, CashFlow } from '../types/trackers';

describe('calculateReturn', () => {
  it('should calculate basic return without cash flows', () => {
    const result = calculateReturn(10000, 11000, [], '2024-01-01', '2024-02-01');
    expect(result).toBe(10); // 10% return
  });

  it('should account for deposit in cash flows', () => {
    const cashFlows: CashFlow[] = [{
      id: '1',
      date: '2024-01-15',
      amount: 2000,
      type: 'deposit'
    }];

    // Start: $10,000, Deposit: $2,000, End: $12,500
    // Without deposit: $10,000 -> $12,500 = 25% return
    // With deposit: ($10,000 + $2,000) -> $12,500 = 4.17% return
    const result = calculateReturn(10000, 12500, cashFlows, '2024-01-01', '2024-02-01');
    expect(result).toBeCloseTo(4.17, 1);
  });

  it('should account for withdrawal in cash flows', () => {
    const cashFlows: CashFlow[] = [{
      id: '1',
      date: '2024-01-15',
      amount: -1000,
      type: 'withdrawal'
    }];

    // Start: $10,000, Withdrawal: $1,000, End: $9,500
    // Without withdrawal: $10,000 -> $9,500 = -5% return
    // With withdrawal: ($10,000 - $1,000) -> $9,500 = 5.56% return
    const result = calculateReturn(10000, 9500, cashFlows, '2024-01-01', '2024-02-01');
    expect(result).toBeCloseTo(5.56, 1);
  });

  it('should handle multiple cash flows', () => {
    const cashFlows: CashFlow[] = [
      { id: '1', date: '2024-01-10', amount: 1000, type: 'deposit' },
      { id: '2', date: '2024-01-20', amount: 500, type: 'deposit' },
      { id: '3', date: '2024-01-25', amount: -200, type: 'withdrawal' }
    ];

    // Start: $10,000, Net cash flows: +$1,300, End: $12,000
    // Adjusted start: $10,000 + $1,300 = $11,300
    // Return: ($12,000 - $11,300) / $11,300 = 6.19%
    const result = calculateReturn(10000, 12000, cashFlows, '2024-01-01', '2024-02-01');
    expect(result).toBeCloseTo(6.19, 1);
  });

  it('should ignore cash flows outside the date range', () => {
    const cashFlows: CashFlow[] = [
      { id: '1', date: '2023-12-15', amount: 5000, type: 'deposit' }, // Before
      { id: '2', date: '2024-01-15', amount: 1000, type: 'deposit' }, // During
      { id: '3', date: '2024-03-01', amount: 2000, type: 'deposit' }  // After
    ];

    // Only the middle cash flow should be counted
    const result = calculateReturn(10000, 11500, cashFlows, '2024-01-01', '2024-02-01');
    expect(result).toBeCloseTo(4.55, 1);
  });

  it('should return 0 if adjusted start value is 0 or negative', () => {
    const cashFlows: CashFlow[] = [
      { id: '1', date: '2024-01-15', amount: -15000, type: 'withdrawal' }
    ];

    const result = calculateReturn(10000, 5000, cashFlows, '2024-01-01', '2024-02-01');
    expect(result).toBe(0);
  });
});

describe('calculateDrawdown', () => {
  it('should calculate basic drawdown without cash flows', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-01-10', amount: 12000 }, // New peak
      { date: '2024-01-15', amount: 10800 }, // 10% drawdown
      { date: '2024-01-20', amount: 9600 },  // 20% drawdown (max)
      { date: '2024-01-25', amount: 12500 }  // Recovered, new peak
    ];

    const result = calculateDrawdown(actualData);

    expect(result.maxDrawdown).toBe(20);
    expect(result.maxDrawdownStartDate).toBe('2024-01-10');
    expect(result.maxDrawdownEndDate).toBe('2024-01-20');
    expect(result.currentDrawdown).toBe(0); // Recovered
    expect(result.drawdownPeriods).toHaveLength(1);
    expect(result.drawdownPeriods[0].recovered).toBe(true);
  });

  it('should account for deposits when calculating drawdown', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-01-10', amount: 8000 },  // 20% drawdown
      { date: '2024-01-15', amount: 13000 }  // Portfolio value after $5k deposit
    ];

    const cashFlows: CashFlow[] = [
      { id: '1', date: '2024-01-12', amount: 5000, type: 'deposit' }
    ];

    const result = calculateDrawdown(actualData, cashFlows);

    // Without cash flow adjustment, it would show recovery
    // With adjustment: $13,000 - $5,000 = $8,000 (still in drawdown!)
    expect(result.currentDrawdown).toBe(20);
    expect(result.maxDrawdown).toBe(20);
  });

  it('should account for withdrawals when calculating drawdown', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-01-10', amount: 8000 }   // Portfolio value after $2k withdrawal
    ];

    const cashFlows: CashFlow[] = [
      { id: '1', date: '2024-01-05', amount: -2000, type: 'withdrawal' }
    ];

    const result = calculateDrawdown(actualData, cashFlows);

    // With adjustment: $8,000 - (-$2,000) = $10,000 (no drawdown!)
    expect(result.currentDrawdown).toBe(0);
    expect(result.maxDrawdown).toBe(0);
  });

  it('should handle current drawdown correctly', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-01-10', amount: 12000 },
      { date: '2024-01-15', amount: 10800 }  // Still in drawdown
    ];

    const result = calculateDrawdown(actualData);

    expect(result.currentDrawdown).toBe(10);
    expect(result.drawdownPeriods).toHaveLength(1);
    expect(result.drawdownPeriods[0].recovered).toBe(false);
  });

  it('should return zeros for empty data', () => {
    const result = calculateDrawdown([]);

    expect(result.maxDrawdown).toBe(0);
    expect(result.currentDrawdown).toBe(0);
    expect(result.drawdownPeriods).toHaveLength(0);
  });
});

describe('calculateRollingReturns', () => {
  it('should calculate 30-day rolling returns', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-02-01', amount: 11000 },  // ~30 days later
      { date: '2024-03-01', amount: 11500 }
    ];

    const result = calculateRollingReturns(actualData, [], [30]);
    const thirtyDayReturns = result.get(30) || [];

    expect(thirtyDayReturns.length).toBeGreaterThan(0);
    expect(thirtyDayReturns[0].return).toBeCloseTo(10, 0); // ~10% return
  });

  it('should account for cash flows in rolling returns', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-02-01', amount: 13000 }
    ];

    const cashFlows: CashFlow[] = [
      { id: '1', date: '2024-01-15', amount: 2000, type: 'deposit' }
    ];

    const result = calculateRollingReturns(actualData, cashFlows, [30]);
    const thirtyDayReturns = result.get(30) || [];

    // Without cash flow: 30% return
    // With cash flow: ($13,000 - $12,000) / $12,000 = 8.33%
    expect(thirtyDayReturns[0].return).toBeCloseTo(8.33, 1);
  });

  it('should calculate multiple period returns', () => {
    const actualData: ActualDataPoint[] = [];
    const startDate = new Date('2024-01-01');

    // Create 100 days of data
    for (let i = 0; i <= 100; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      actualData.push({
        date: date.toISOString().split('T')[0],
        amount: 10000 + i * 100 // Gradually increasing
      });
    }

    const result = calculateRollingReturns(actualData, [], [30, 60, 90]);

    expect(result.has(30)).toBe(true);
    expect(result.has(60)).toBe(true);
    expect(result.has(90)).toBe(true);
    expect(result.get(30)!.length).toBeGreaterThan(0);
    expect(result.get(60)!.length).toBeGreaterThan(0);
    expect(result.get(90)!.length).toBeGreaterThan(0);
  });

  it('should return empty arrays for insufficient data', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 }
    ];

    const result = calculateRollingReturns(actualData, [], [30]);

    expect(result.get(30)).toHaveLength(0);
  });
});

describe('calculateVolatility', () => {
  it('should calculate volatility from returns', () => {
    const actualData: ActualDataPoint[] = [];

    // Create data with some volatility
    for (let i = 0; i < 30; i++) {
      actualData.push({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        amount: 10000 + (i % 2 === 0 ? 100 : -100) * i
      });
    }

    const result = calculateVolatility(actualData, [], 0);

    expect(result.volatility).toBeGreaterThan(0);
    expect(result.annualizedVolatility).toBeGreaterThan(0);
    expect(result.returns.length).toBe(29); // n-1 returns
  });

  it('should return 0 for insufficient data', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 }
    ];

    const result = calculateVolatility(actualData);

    expect(result.volatility).toBe(0);
    expect(result.annualizedVolatility).toBe(0);
  });
});

describe('calculateSharpeRatio', () => {
  it('should calculate Sharpe ratio', () => {
    const result = calculateSharpeRatio(10, 5, 0);
    expect(result).toBe(2);
  });

  it('should return 0 for zero volatility', () => {
    const result = calculateSharpeRatio(10, 0, 0);
    expect(result).toBe(0);
  });
});

describe('getBestWorstPeriods', () => {
  it('should identify best and worst monthly periods', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-01-31', amount: 11000 }, // +10% (good month)
      { date: '2024-02-28', amount: 10500 }, // -4.5% (bad month)
      { date: '2024-03-31', amount: 11550 }  // +10% (good month)
    ];

    const result = getBestWorstPeriods(actualData, [], 2);

    expect(result.best.length).toBeGreaterThan(0);
    expect(result.worst.length).toBeGreaterThan(0);
    expect(result.best[0].return).toBeGreaterThan(result.worst[0].return);
  });

  it('should account for cash flows in period returns', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-01-31', amount: 13000 },
      { date: '2024-02-28', amount: 15000 }  // Need at least 2 complete months
    ];

    const cashFlows: CashFlow[] = [
      { id: '1', date: '2024-01-15', amount: 2000, type: 'deposit' }
    ];

    const result = getBestWorstPeriods(actualData, cashFlows, 1);

    // Should have results now with 2 months of data
    expect(result.best.length).toBeGreaterThan(0);
    if (result.best.length > 0) {
      // Without cash flow in Jan: 30% return
      // With cash flow: should be much lower (~15%)
      expect(result.best[0].return).toBeLessThan(20);
    }
  });

  it('should return empty arrays for insufficient data', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 }
    ];

    const result = getBestWorstPeriods(actualData);

    expect(result.best).toHaveLength(0);
    expect(result.worst).toHaveLength(0);
  });
});

describe('calculateWinRate', () => {
  it('should calculate win rate against projection', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-01-02', amount: 11000 },
      { date: '2024-01-03', amount: 12000 }
    ];

    const projectedData = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-01-02', amount: 10500 }, // Actual beats projection
      { date: '2024-01-03', amount: 13000 }  // Actual loses to projection
    ];

    const result = calculateWinRate(actualData, projectedData);

    expect(result.total).toBe(3);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.winRate).toBeCloseTo(66.67, 1);
  });

  it('should return 0 for no matching dates', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 }
    ];

    const projectedData = [
      { date: '2024-02-01', amount: 11000 }
    ];

    const result = calculateWinRate(actualData, projectedData);

    expect(result.total).toBe(0);
    expect(result.winRate).toBe(0);
  });
});

describe('calculateAnnualizedReturn', () => {
  it('should annualize returns correctly', () => {
    // 10% return over 1 year
    const result = calculateAnnualizedReturn(
      10000,
      11000,
      '2024-01-01',
      '2025-01-01'
    );

    expect(result).toBeCloseTo(10, 1);
  });

  it('should annualize returns for partial year', () => {
    // 10% return over 6 months should annualize to ~21%
    const result = calculateAnnualizedReturn(
      10000,
      11000,
      '2024-01-01',
      '2024-07-01'
    );

    expect(result).toBeGreaterThan(20);
  });

  it('should account for cash flows', () => {
    const cashFlows: CashFlow[] = [
      { id: '1', date: '2024-06-01', amount: 1000, type: 'deposit' }
    ];

    const result = calculateAnnualizedReturn(
      10000,
      12000,
      '2024-01-01',
      '2025-01-01',
      cashFlows
    );

    // With cash flow, the return should be lower
    expect(result).toBeLessThan(20);
  });

  it('should return 0 for zero or negative days', () => {
    const result = calculateAnnualizedReturn(
      10000,
      11000,
      '2024-01-01',
      '2024-01-01'
    );

    expect(result).toBe(0);
  });
});

describe('calculatePerformanceSummary', () => {
  it('should calculate comprehensive performance metrics', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-02-01', amount: 11000 },
      { date: '2024-03-01', amount: 10800 },
      { date: '2024-04-01', amount: 12000 }
    ];

    const projectedData = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-02-01', amount: 10500 },
      { date: '2024-03-01', amount: 11000 },
      { date: '2024-04-01', amount: 11500 }
    ];

    const result = calculatePerformanceSummary(actualData, projectedData);

    expect(result.totalReturn).toBeGreaterThan(0);
    expect(result.annualizedReturn).toBeGreaterThan(0);
    expect(result.volatility).toBeGreaterThan(0);
    expect(result.maxDrawdown).toBeGreaterThan(0);
    expect(result.winRate).toBeGreaterThan(0);
  });

  it('should account for cash flows in all metrics', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-02-01', amount: 13000 }
    ];

    const cashFlows: CashFlow[] = [
      { id: '1', date: '2024-01-15', amount: 2000, type: 'deposit' }
    ];

    const result = calculatePerformanceSummary(actualData, [], cashFlows);

    // With cash flow, returns should be adjusted
    expect(result.totalReturn).toBeLessThan(30); // Would be 30% without cash flow
  });

  it('should return zeros for empty data', () => {
    const result = calculatePerformanceSummary([]);

    expect(result.totalReturn).toBe(0);
    expect(result.annualizedReturn).toBe(0);
    expect(result.volatility).toBe(0);
    expect(result.sharpeRatio).toBe(0);
    expect(result.maxDrawdown).toBe(0);
    expect(result.currentDrawdown).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.bestMonth).toBeNull();
    expect(result.worstMonth).toBeNull();
  });

  it('should handle actual data without projections', () => {
    const actualData: ActualDataPoint[] = [
      { date: '2024-01-01', amount: 10000 },
      { date: '2024-02-01', amount: 11000 }
    ];

    const result = calculatePerformanceSummary(actualData);

    expect(result.totalReturn).toBeGreaterThan(0);
    expect(result.winRate).toBe(0); // No projection to compare
  });
});
