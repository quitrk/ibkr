import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { parseISO, differenceInDays } from 'date-fns';
import 'chartjs-adapter-date-fns';
import type { Tracker, DateRange } from '../types/trackers';
import { calculateProjectedValues, calculateActualAverageIncrease, calculateProjection } from '../utils/calculations';
import './ProgressChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
);

interface ProgressChartProps {
  tracker: Tracker;
  dateRange?: DateRange;
}

// Helper function to sample data points based on the range duration
function sampleDataPoints<T extends { date: string }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) {
    return data;
  }

  const step = Math.ceil(data.length / maxPoints);
  const sampled: T[] = [];

  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
  }

  // Always include the last point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }

  return sampled;
}

export function ProgressChart({ tracker, dateRange }: ProgressChartProps) {
  const chartData = useMemo(() => {
    // Calculate full projected data (without cash flows first)
    const fullProjectedData = calculateProjectedValues(
      tracker.config,
      parseISO(tracker.config.endDate)
    );

    // Filter by date range if provided
    let projectedData = fullProjectedData;
    let rangeDays = differenceInDays(
      parseISO(tracker.config.endDate),
      parseISO(tracker.config.startDate)
    );

    if (dateRange) {
      const rangeStart = parseISO(dateRange.startDate);
      const rangeEnd = parseISO(dateRange.endDate);
      rangeDays = differenceInDays(rangeEnd, rangeStart);

      projectedData = fullProjectedData.filter(point => {
        const pointDate = parseISO(point.date);
        return pointDate >= rangeStart && pointDate <= rangeEnd;
      });
    }

    // Determine max data points based on range duration
    // < 30 days: show all points
    // 30-90 days: max 50 points (every ~2 days)
    // 90-180 days: max 40 points (every ~4 days)
    // > 180 days: max 30 points (weekly+)
    let maxDataPoints: number;
    if (rangeDays < 30) {
      maxDataPoints = projectedData.length; // Show all
    } else if (rangeDays < 90) {
      maxDataPoints = 50;
    } else if (rangeDays < 180) {
      maxDataPoints = 40;
    } else {
      maxDataPoints = 30;
    }

    // Sample the projected data to reduce clutter
    const sampledProjectedData = sampleDataPoints(projectedData, maxDataPoints);

    const actualData = tracker.actualData;
    const cashFlows = tracker.cashFlows || [];

    // Calculate projected growth rate per business day (compound)
    const projectedIncreasePercent = tracker.config.projectedIncreasePercent / 100;
    const intervalDays = tracker.config.intervalDays;
    // Convert interval percentage to daily compound rate
    const projectedGrowthRatePerDay = Math.pow(1 + projectedIncreasePercent, 1 / intervalDays) - 1;

    // Helper to get cumulative cash flows up to a date
    const getCumulativeCashFlow = (date: string): number => {
      const targetDate = parseISO(date);
      return cashFlows
        .filter(cf => parseISO(cf.date) <= targetDate)
        .reduce((sum, cf) => sum + (cf.type === 'deposit' ? cf.amount : -cf.amount), 0);
    };

    // Filter actual data by date range if provided
    let filteredActualData = actualData;
    if (dateRange) {
      const rangeStart = parseISO(dateRange.startDate);
      const rangeEnd = parseISO(dateRange.endDate);
      filteredActualData = actualData.filter(point => {
        const pointDate = parseISO(point.date);
        return pointDate >= rangeStart && pointDate <= rangeEnd;
      });
    }

    // Create a map of actual values by date (tracker + cash flows)
    const actualMap = new Map(
      filteredActualData.map(point => [point.date, point.amount + getCumulativeCashFlow(point.date)])
    );

    // Create a combined set of dates: sampled projected dates + all actual data dates
    const dateSet = new Set([
      ...sampledProjectedData.map(p => p.date),
      ...filteredActualData.map(a => a.date),
    ]);

    // Convert to sorted array
    const allDates = Array.from(dateSet).sort((a, b) =>
      parseISO(a).getTime() - parseISO(b).getTime()
    );

    // Build a map of projected data for quick lookup (use full data for accurate values)
    const projectedMap = new Map(fullProjectedData.map(p => [p.date, p.amount]));

    // Calculate actual-based projection
    let actualProjectionMap = new Map<string, number>();

    // Use ALL actual data for growth rate calculation, not just filtered
    // This ensures we have enough data points for a meaningful calculation
    const actualGrowthRate = calculateActualAverageIncrease(actualData, intervalDays);

    if (actualGrowthRate && actualData.length > 0) {
      // Use ALL actual data to find the absolute last actual value
      const sortedAllActual = [...actualData].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const lastValue = sortedAllActual[sortedAllActual.length - 1].amount;
      const lastActualDate = sortedAllActual[sortedAllActual.length - 1].date;
      const actualGrowthRatePerDay = actualGrowthRate.dailyRate;

      // Project from last actual point forward using daily compounding
      // Use FULL projected data, then we'll filter when displaying
      const futureFullData = fullProjectedData.filter(p => parseISO(p.date) >= parseISO(lastActualDate));

      const fullActualProjectionMap = calculateProjection(
        futureFullData,
        lastValue, // Starting from the last actual tracker value
        actualGrowthRatePerDay,
        cashFlows
      );

      // Copy only the dates we need for display (sampled)
      actualProjectionMap = fullActualProjectionMap;
    }

    // Calculate projected values with cash flows
    // First calculate for ALL data to get accurate values
    const fullProjectedWithCashFlowsMap = calculateProjection(
      fullProjectedData,
      tracker.config.startingAmount,
      projectedGrowthRatePerDay,
      cashFlows
    );

    // If we have a date range, we need to use values from the full projection
    // Otherwise filtered dates will start from the original starting amount incorrectly
    const projectedWithCashFlowsMap = fullProjectedWithCashFlowsMap;

    // Build chart data using combined dates
    // Use Date objects for time scale
    const labels = allDates.map(date => parseISO(date));

    const projected = allDates.map(date => {
      const value = projectedWithCashFlowsMap.get(date);
      if (value !== undefined) return value;
      // If we don't have this exact date in projected, return null
      return projectedMap.has(date) ? projectedMap.get(date)! : null;
    });

    // For actual data, only show values where we have actual data
    const actual = allDates.map(date => {
      const actualValue = actualMap.get(date);
      return actualValue ?? null;
    });

    // For actual-based projection, show from last actual point forward
    const actualBasedProjection = allDates.map(date => {
      return actualProjectionMap.get(date) ?? null;
    });

    // Adjust point radius based on data density
    const pointRadius = allDates.length > 60 ? 0 : allDates.length > 40 ? 2 : 4;
    const actualPointRadius = Math.max(pointRadius, 3); // Actual points slightly larger

    return {
      labels,
      datasets: [
        {
          label: 'Projected',
          data: projected,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          pointRadius,
          pointHoverRadius: pointRadius + 2,
          tension: 0.1,
        },
        {
          label: 'Actual',
          data: actual,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          pointRadius: actualPointRadius,
          pointHoverRadius: actualPointRadius + 2,
          tension: 0.1,
          spanGaps: false, // Don't connect gaps in actual data
        },
        {
          label: 'Actual-Based Projection',
          data: actualBasedProjection,
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5], // Dotted line
          pointRadius: Math.max(pointRadius - 1, 0),
          pointHoverRadius: pointRadius + 1,
          tension: 0.1,
          spanGaps: false,
        },
      ],
    };
  }, [tracker, dateRange]);

  const options = useMemo(() => {
    // Calculate the date range for x-axis configuration
    let rangeStart: Date;
    let rangeEnd: Date;

    if (dateRange) {
      rangeStart = parseISO(dateRange.startDate);
      rangeEnd = parseISO(dateRange.endDate);
    } else {
      rangeStart = parseISO(tracker.config.startDate);
      rangeEnd = parseISO(tracker.config.endDate);
    }

    const rangeDays = differenceInDays(rangeEnd, rangeStart);

    // Determine time unit and max ticks based on range
    let timeUnit: 'day' | 'week' | 'month';
    let maxTicksLimit: number;

    if (rangeDays < 30) {
      timeUnit = 'day';
      maxTicksLimit = 15;
    } else if (rangeDays < 90) {
      timeUnit = 'week';
      maxTicksLimit = 12;
    } else if (rangeDays < 180) {
      timeUnit = 'week';
      maxTicksLimit = 10;
    } else {
      timeUnit = 'month';
      maxTicksLimit = 12;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 100, // Ultra-fast animations
      },
      plugins: {
        legend: {
          position: 'top' as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(context.parsed.y);
              }
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time' as const,
          time: {
            unit: timeUnit,
            displayFormats: {
              day: 'MMM d',
              week: 'MMM d',
              month: 'MMM yyyy',
            },
          },
          ticks: {
            maxTicksLimit,
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value: any) {
              return '$' + value.toLocaleString();
            },
          },
        },
      },
    };
  }, [tracker, dateRange]);

  return (
    <div className="chart-container">
      <Line data={chartData} options={options} />
    </div>
  );
}
