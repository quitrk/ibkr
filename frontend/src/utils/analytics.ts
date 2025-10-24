import { parseISO, differenceInDays, subDays, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import type { ActualDataPoint, CashFlow } from '../types/trackers';
import { findLast } from './arrayHelpers';

/**
 * Calculate returns between two data points, accounting for cash flows
 */
export function calculateReturn(
  startValue: number,
  endValue: number,
  cashFlows: CashFlow[] = [],
  startDate: string,
  endDate: string
): number {
  // Time-weighted return calculation
  let adjustedStartValue = startValue;

  // Add cash flows that occurred during the period
  const relevantCashFlows = cashFlows.filter(cf => {
    const cfDate = parseISO(cf.date);
    return cfDate > parseISO(startDate) && cfDate <= parseISO(endDate);
  });

  // For simple return calculation, adjust for cash flows
  relevantCashFlows.forEach(cf => {
    // Deposits increase the cost basis, withdrawals decrease it
    adjustedStartValue += cf.amount;
  });

  if (adjustedStartValue <= 0) return 0;

  return ((endValue - adjustedStartValue) / adjustedStartValue) * 100;
}

/**
 * Calculate rolling returns for different periods (30, 60, 90 days)
 */
export function calculateRollingReturns(
  actualData: ActualDataPoint[],
  cashFlows: CashFlow[] = [],
  periods: number[] = [30, 60, 90]
): Map<number, { date: string; return: number }[]> {
  const results = new Map<number, { date: string; return: number }[]>();

  if (actualData.length < 2) {
    periods.forEach(period => results.set(period, []));
    return results;
  }

  // Sort data by date
  const sortedData = [...actualData].sort((a, b) =>
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  periods.forEach(period => {
    const periodReturns: { date: string; return: number }[] = [];

    for (let i = 0; i < sortedData.length; i++) {
      const currentDate = parseISO(sortedData[i].date);
      const lookbackDate = subDays(currentDate, period);

      // Find the closest data point to lookback date
      const lookbackPoint = findLast(sortedData, (d: ActualDataPoint) =>
        parseISO(d.date) <= lookbackDate
      );

      if (lookbackPoint) {
        const returnValue = calculateReturn(
          lookbackPoint.amount,
          sortedData[i].amount,
          cashFlows,
          lookbackPoint.date,
          sortedData[i].date
        );

        periodReturns.push({
          date: sortedData[i].date,
          return: returnValue
        });
      }
    }

    results.set(period, periodReturns);
  });

  return results;
}

/**
 * Calculate maximum drawdown and current drawdown
 */
export interface DrawdownAnalysis {
  maxDrawdown: number;
  maxDrawdownStartDate: string | null;
  maxDrawdownEndDate: string | null;
  currentDrawdown: number;
  drawdownPeriods: {
    startDate: string;
    endDate: string | null;
    drawdown: number;
    recovered: boolean;
  }[];
}

export function calculateDrawdown(actualData: ActualDataPoint[], cashFlows: CashFlow[] = []): DrawdownAnalysis {
  if (actualData.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownStartDate: null,
      maxDrawdownEndDate: null,
      currentDrawdown: 0,
      drawdownPeriods: []
    };
  }

  // Sort data by date
  const sortedData = [...actualData].sort((a, b) =>
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  // Adjust values for cash flows to get performance-only peaks
  const adjustedData = sortedData.map((point) => {
    // Sum all cash flows up to this point
    const cumulativeCashFlows = cashFlows
      .filter(cf => parseISO(cf.date) <= parseISO(point.date))
      .reduce((sum, cf) => sum + cf.amount, 0);

    return {
      date: point.date,
      amount: point.amount,
      adjustedAmount: point.amount - cumulativeCashFlows // Remove cash flow effect
    };
  });

  let peak = adjustedData[0].adjustedAmount;
  let peakDate = adjustedData[0].date;
  let maxDrawdown = 0;
  let maxDrawdownStartDate: string | null = null;
  let maxDrawdownEndDate: string | null = null;

  const drawdownPeriods: DrawdownAnalysis['drawdownPeriods'] = [];
  let currentDrawdownPeriod: DrawdownAnalysis['drawdownPeriods'][0] | null = null;

  adjustedData.forEach(point => {
    if (point.adjustedAmount > peak) {
      // New peak reached (based on performance, not deposits)
      if (currentDrawdownPeriod) {
        // End current drawdown period
        currentDrawdownPeriod.endDate = point.date;
        currentDrawdownPeriod.recovered = true;
        drawdownPeriods.push(currentDrawdownPeriod);
        currentDrawdownPeriod = null;
      }
      peak = point.adjustedAmount;
      peakDate = point.date;
    } else {
      // Calculate drawdown from peak
      const drawdown = peak > 0 ? ((peak - point.adjustedAmount) / peak) * 100 : 0;

      if (drawdown > 0 && !currentDrawdownPeriod) {
        // Start new drawdown period
        currentDrawdownPeriod = {
          startDate: peakDate,
          endDate: null,
          drawdown: drawdown,
          recovered: false
        };
      } else if (currentDrawdownPeriod) {
        // Update current drawdown
        currentDrawdownPeriod.drawdown = Math.max(currentDrawdownPeriod.drawdown, drawdown);
      }

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownStartDate = peakDate;
        maxDrawdownEndDate = point.date;
      }
    }
  });

  // If still in drawdown, add the current period
  if (currentDrawdownPeriod) {
    drawdownPeriods.push(currentDrawdownPeriod);
  }

  // Calculate current drawdown
  const lastPoint = adjustedData[adjustedData.length - 1];
  const currentDrawdown = peak > lastPoint.adjustedAmount
    ? ((peak - lastPoint.adjustedAmount) / peak) * 100
    : 0;

  return {
    maxDrawdown,
    maxDrawdownStartDate,
    maxDrawdownEndDate,
    currentDrawdown,
    drawdownPeriods
  };
}

/**
 * Calculate volatility (standard deviation of returns)
 */
export function calculateVolatility(
  actualData: ActualDataPoint[],
  cashFlows: CashFlow[] = [],
  periodDays: number = 30
): {
  volatility: number;
  annualizedVolatility: number;
  returns: number[];
} {
  if (actualData.length < 2) {
    return { volatility: 0, annualizedVolatility: 0, returns: [] };
  }

  // Sort data by date
  const sortedData = [...actualData].sort((a, b) =>
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < sortedData.length; i++) {
    const dailyReturn = calculateReturn(
      sortedData[i - 1].amount,
      sortedData[i].amount,
      cashFlows,
      sortedData[i - 1].date,
      sortedData[i].date
    );
    returns.push(dailyReturn);
  }

  // Filter to last N days if specified
  const recentReturns = periodDays > 0 && returns.length > periodDays
    ? returns.slice(-periodDays)
    : returns;

  if (recentReturns.length === 0) {
    return { volatility: 0, annualizedVolatility: 0, returns: [] };
  }

  // Calculate mean return
  const meanReturn = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;

  // Calculate variance
  const variance = recentReturns.reduce((sum, r) => {
    const diff = r - meanReturn;
    return sum + (diff * diff);
  }, 0) / recentReturns.length;

  // Standard deviation
  const volatility = Math.sqrt(variance);

  // Annualized volatility (assuming 252 trading days)
  const annualizedVolatility = volatility * Math.sqrt(252);

  return { volatility, annualizedVolatility, returns: recentReturns };
}

/**
 * Calculate Sharpe Ratio (risk-adjusted return)
 * Using 0% risk-free rate for simplicity
 */
export function calculateSharpeRatio(
  meanReturn: number,
  volatility: number,
  riskFreeRate: number = 0
): number {
  if (volatility === 0) return 0;
  return (meanReturn - riskFreeRate) / volatility;
}

/**
 * Get best and worst performing periods
 */
export interface PerformancePeriod {
  startDate: string;
  endDate: string;
  return: number;
  duration: number;
}

export function getBestWorstPeriods(
  actualData: ActualDataPoint[],
  cashFlows: CashFlow[] = [],
  topN: number = 5
): {
  best: PerformancePeriod[];
  worst: PerformancePeriod[];
} {
  if (actualData.length < 2) {
    return { best: [], worst: [] };
  }

  // Calculate monthly returns
  const sortedData = [...actualData].sort((a, b) =>
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  const firstDate = parseISO(sortedData[0].date);
  const lastDate = parseISO(sortedData[sortedData.length - 1].date);

  const months = eachMonthOfInterval({ start: firstDate, end: lastDate });
  const monthlyReturns: PerformancePeriod[] = [];

  months.forEach((month, index) => {
    if (index === 0) return;

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Find data points for this month
    const startPoint = findLast(sortedData, (d: ActualDataPoint) =>
      parseISO(d.date) <= monthStart
    ) || sortedData.find((d: ActualDataPoint) =>
      parseISO(d.date) >= monthStart
    );

    const endPoint = findLast(sortedData, (d: ActualDataPoint) =>
      parseISO(d.date) <= monthEnd
    );

    if (startPoint && endPoint && startPoint.date !== endPoint.date) {
      const monthReturn = calculateReturn(
        startPoint.amount,
        endPoint.amount,
        cashFlows,
        startPoint.date,
        endPoint.date
      );

      monthlyReturns.push({
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd'),
        return: monthReturn,
        duration: differenceInDays(parseISO(endPoint.date), parseISO(startPoint.date))
      });
    }
  });

  // Sort and get top N
  const sorted = [...monthlyReturns].sort((a, b) => b.return - a.return);

  return {
    best: sorted.slice(0, topN),
    worst: sorted.slice(-topN).reverse()
  };
}

/**
 * Calculate win rate against a projection
 */
export function calculateWinRate(
  actualData: ActualDataPoint[],
  projectedData: { date: string; amount: number }[]
): {
  winRate: number;
  wins: number;
  losses: number;
  total: number;
} {
  let wins = 0;
  let losses = 0;
  let total = 0;

  actualData.forEach(actual => {
    const projected = projectedData.find(p => p.date === actual.date);
    if (projected) {
      total++;
      if (actual.amount >= projected.amount) {
        wins++;
      } else {
        losses++;
      }
    }
  });

  const winRate = total > 0 ? (wins / total) * 100 : 0;

  return { winRate, wins, losses, total };
}

/**
 * Calculate annualized return
 */
export function calculateAnnualizedReturn(
  startValue: number,
  endValue: number,
  startDate: string,
  endDate: string,
  cashFlows: CashFlow[] = []
): number {
  const days = differenceInDays(parseISO(endDate), parseISO(startDate));
  if (days <= 0 || startValue <= 0) return 0;

  // Simple return calculation (can be enhanced with XIRR for cash flows)
  const totalReturn = calculateReturn(startValue, endValue, cashFlows, startDate, endDate);
  const years = days / 365.25;

  // Convert to annualized
  const annualizedReturn = (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;

  return annualizedReturn;
}

/**
 * Calculate performance summary statistics
 */
export interface PerformanceSummary {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  winRate: number;
  bestMonth: PerformancePeriod | null;
  worstMonth: PerformancePeriod | null;
}

export function calculatePerformanceSummary(
  actualData: ActualDataPoint[],
  projectedData: { date: string; amount: number }[] = [],
  cashFlows: CashFlow[] = []
): PerformanceSummary {
  if (actualData.length === 0) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      winRate: 0,
      bestMonth: null,
      worstMonth: null
    };
  }

  const sortedData = [...actualData].sort((a, b) =>
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  const firstPoint = sortedData[0];
  const lastPoint = sortedData[sortedData.length - 1];

  // Total and annualized return
  const totalReturn = calculateReturn(
    firstPoint.amount,
    lastPoint.amount,
    cashFlows,
    firstPoint.date,
    lastPoint.date
  );

  const annualizedReturn = calculateAnnualizedReturn(
    firstPoint.amount,
    lastPoint.amount,
    firstPoint.date,
    lastPoint.date,
    cashFlows
  );

  // Volatility and Sharpe
  const { volatility, annualizedVolatility, returns } = calculateVolatility(actualData, cashFlows, 0);
  const meanReturn = returns.length > 0
    ? returns.reduce((sum, r) => sum + r, 0) / returns.length
    : 0;
  const sharpeRatio = calculateSharpeRatio(meanReturn, volatility);

  // Drawdown (accounting for cash flows)
  const drawdownAnalysis = calculateDrawdown(actualData, cashFlows);

  // Win rate
  const winRateStats = projectedData.length > 0
    ? calculateWinRate(actualData, projectedData)
    : { winRate: 0, wins: 0, losses: 0, total: 0 };

  // Best/worst months
  const { best, worst } = getBestWorstPeriods(actualData, cashFlows, 1);

  return {
    totalReturn,
    annualizedReturn,
    volatility: annualizedVolatility,
    sharpeRatio,
    maxDrawdown: drawdownAnalysis.maxDrawdown,
    currentDrawdown: drawdownAnalysis.currentDrawdown,
    winRate: winRateStats.winRate,
    bestMonth: best[0] || null,
    worstMonth: worst[0] || null
  };
}