import { addDays, addWeeks, addMonths, addYears, parseISO, format, isWeekend } from 'date-fns';
import type { TrackerConfig, ProjectedDataPoint, ActualDataPoint, CashFlow, DepositSchedule } from '../types/trackers';

/**
 * Check if a date is a business day (Monday-Friday)
 */
function isBusinessDay(date: Date): boolean {
  return !isWeekend(date);
}

/**
 * Add business days to a date
 */
export function addBusinessDays(date: Date, businessDays: number): Date {
  let result = new Date(date);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    result = addDays(result, 1);
    if (isBusinessDay(result)) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Count business days between two dates (exclusive of start date)
 * This gives us the number of business days elapsed FROM startDate TO endDate
 */
export function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  let current = addDays(startDate, 1); // Start from day after startDate

  while (current <= endDate) {
    if (isBusinessDay(current)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}

/**
 * Calculate projected tracker values based on configuration
 * Now uses business days for intervals and generates daily data points
 */
export function calculateProjectedValues(
  config: TrackerConfig,
  endDate?: Date
): ProjectedDataPoint[] {
  const startDate = parseISO(config.startDate);
  // Default to 1 year from start date if no end date provided
  const end = endDate || addYears(startDate, 1);

  const projectedData: ProjectedDataPoint[] = [];

  // Calculate growth milestones (when growth actually happens)
  const milestones: { date: Date; amount: number; businessDayNumber: number }[] = [];
  let currentAmount = config.startingAmount;
  let businessDaysElapsed = 0;

  // Add starting milestone
  milestones.push({
    date: startDate,
    amount: currentAmount,
    businessDayNumber: 0,
  });

  // Calculate milestones at each interval of business days
  let milestoneDate = startDate;
  while (milestoneDate < end) {
    // Add the configured interval in business days
    milestoneDate = addBusinessDays(milestoneDate, config.intervalDays);

    if (milestoneDate > end) {
      break;
    }

    businessDaysElapsed += config.intervalDays;

    // Apply percentage increase
    currentAmount = currentAmount * (1 + config.projectedIncreasePercent / 100);

    milestones.push({
      date: milestoneDate,
      amount: currentAmount,
      businessDayNumber: businessDaysElapsed,
    });
  }

  // Now generate daily data points with interpolation between milestones
  let currentDate = new Date(startDate);
  let dayNumber = 0;

  while (currentDate <= end) {
    // Find which milestone period we're in
    // milestoneIndex represents the last milestone we've reached or passed
    let milestoneIndex = 0;
    for (let i = milestones.length - 1; i >= 0; i--) {
      if (currentDate >= milestones[i].date) {
        milestoneIndex = i;
        break;
      }
    }

    const fromMilestone = milestones[milestoneIndex];
    const toMilestone = milestones[milestoneIndex + 1];

    let amount: number;

    if (!toMilestone) {
      // We're at or past the last milestone, use its amount
      amount = fromMilestone.amount;
    } else if (format(currentDate, 'yyyy-MM-dd') === format(toMilestone.date, 'yyyy-MM-dd')) {
      // We're exactly at the next milestone
      amount = toMilestone.amount;
    } else {
      // We're between milestones, interpolate
      const businessDaysBetweenMilestones = countBusinessDays(fromMilestone.date, toMilestone.date);
      const businessDaysFromLastMilestone = countBusinessDays(fromMilestone.date, currentDate);

      const progress = businessDaysBetweenMilestones > 0
        ? businessDaysFromLastMilestone / businessDaysBetweenMilestones
        : 0;

      amount = fromMilestone.amount + (toMilestone.amount - fromMilestone.amount) * progress;
    }

    projectedData.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      amount,
      dayNumber,
    });

    currentDate = addDays(currentDate, 1);
    dayNumber++;
  }

  return projectedData;
}

/**
 * Calculate variance between projected and actual values
 */
export function calculateVariance(projected: number, actual: number): {
  absolute: number;
  percentage: number;
} {
  const absolute = actual - projected;
  const percentage = projected > 0 ? (absolute / projected) * 100 : 0;

  return {
    absolute,
    percentage,
  };
}

/**
 * Get the latest actual data point
 */
export function getLatestActualValue(actualData: ActualDataPoint[]): ActualDataPoint | null {
  if (actualData.length === 0) return null;

  return actualData.reduce((latest, current) => {
    return new Date(current.date) > new Date(latest.date) ? current : latest;
  });
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Calculate actual average increase percentage from actual data
 * Returns percentage per interval period
 * Note: Actual data points should NOT include cash flows (deposits/withdrawals)
 */
export function calculateActualAverageIncrease(
  actualData: ActualDataPoint[],
  intervalDays: number
): { dailyRate: number; intervalPercentage: number } | null {
  if (actualData.length < 2) return null;

  const sorted = [...actualData].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const firstValue = sorted[0].amount;
  const lastValue = sorted[sorted.length - 1].amount;

  if (firstValue <= 0) return null;

  // Calculate actual percentage increase
  // Actual data excludes cash flows, so we calculate growth directly
  const totalIncreasePercent = ((lastValue - firstValue) / firstValue) * 100;

  // Calculate daily compound rate by spreading the total increase over the interval period
  // This gives us: (1 + dailyRate)^intervalDays = (1 + totalIncreasePercent/100)
  const dailyRate = Math.pow(1 + totalIncreasePercent / 100, 1 / intervalDays) - 1;

  // Return the actual total increase percentage as the interval percentage
  return { dailyRate, intervalPercentage: totalIncreasePercent };
}

/**
 * Calculate projection with cash flows
 * Applies daily compound growth and incorporates cash flows (deposits/withdrawals) at their dates
 */
export function calculateProjection(
  baseData: { date: string; amount: number }[],
  startingAmount: number,
  growthRatePerDay: number,
  cashFlows: CashFlow[]
): Map<string, number> {
  const result = new Map<string, number>();

  // Helper to get cumulative cash flows up to a date
  const getCumulativeCashFlow = (date: string): number => {
    const targetDate = parseISO(date);
    return cashFlows
      .filter(cf => parseISO(cf.date) <= targetDate)
      .reduce((sum, cf) => sum + (cf.type === 'deposit' ? cf.amount : -cf.amount), 0);
  };

  baseData.forEach((point, index) => {
    if (index === 0) {
      // First point: starting amount + any cash flows at start
      const cashFlowAtStart = getCumulativeCashFlow(point.date);
      result.set(point.date, startingAmount + cashFlowAtStart);
    } else {
      const prevPoint = baseData[index - 1];
      const prevValue = result.get(prevPoint.date)!;
      const prevCashFlow = getCumulativeCashFlow(prevPoint.date);
      const currentCashFlow = getCumulativeCashFlow(point.date);

      // Calculate new cash flows added in this period
      const newCashFlows = currentCashFlow - prevCashFlow;

      // Apply compound growth to the entire previous value (tracker + previous cash flows)
      const businessDaysBetween = countBusinessDays(parseISO(prevPoint.date), parseISO(point.date));
      const growthMultiplier = Math.pow(1 + growthRatePerDay, businessDaysBetween);
      const valueAfterGrowth = prevValue * growthMultiplier;

      // Add new cash flows that came in this period
      result.set(point.date, valueAfterGrowth + newCashFlows);
    }
  });

  return result;
}

/**
 * Generate cash flows from a deposit schedule
 * Returns an array of CashFlow objects based on the schedule configuration
 */
export function generateScheduledCashFlows(
  schedule: DepositSchedule,
  trackerStartDate: string,
  trackerEndDate: string
): CashFlow[] {
  if (!schedule.enabled || schedule.amount <= 0) {
    return [];
  }

  const cashFlows: CashFlow[] = [];
  const startDate = parseISO(schedule.startDate || trackerStartDate);
  const endDate = parseISO(schedule.endDate || trackerEndDate);

  let currentDate = startDate;

  while (currentDate <= endDate) {
    cashFlows.push({
      id: crypto.randomUUID(),
      date: format(currentDate, 'yyyy-MM-dd'),
      amount: schedule.amount,
      type: 'deposit',
      source: 'scheduled',
    });

    // Calculate next deposit date based on frequency
    switch (schedule.frequency) {
      case 'daily':
        currentDate = addDays(currentDate, 1);
        break;
      case 'weekly':
        currentDate = addWeeks(currentDate, 1);
        break;
      case 'biweekly':
        currentDate = addWeeks(currentDate, 2);
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, 1);
        break;
    }
  }

  return cashFlows;
}
