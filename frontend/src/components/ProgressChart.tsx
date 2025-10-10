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
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { parseISO } from 'date-fns';
import type { Investment, DateRange } from '../types/investment';
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
  Filler
);

interface ProgressChartProps {
  investment: Investment;
  dateRange?: DateRange;
}

export function ProgressChart({ investment, dateRange }: ProgressChartProps) {
  const chartData = useMemo(() => {
    // Calculate full projected data (without cash flows first)
    const fullProjectedData = calculateProjectedValues(
      investment.config,
      parseISO(investment.config.endDate)
    );

    // Filter by date range if provided
    let projectedData = fullProjectedData;
    if (dateRange) {
      const rangeStart = parseISO(dateRange.startDate);
      const rangeEnd = parseISO(dateRange.endDate);
      projectedData = fullProjectedData.filter(point => {
        const pointDate = parseISO(point.date);
        return pointDate >= rangeStart && pointDate <= rangeEnd;
      });
    }

    const actualData = investment.actualData;
    const cashFlows = investment.cashFlows || [];

    // Calculate projected growth rate per business day (compound)
    const projectedIncreasePercent = investment.config.projectedIncreasePercent / 100;
    const intervalDays = investment.config.intervalDays;
    // Convert interval percentage to daily compound rate
    const projectedGrowthRatePerDay = Math.pow(1 + projectedIncreasePercent, 1 / intervalDays) - 1;

    // Helper to get cumulative cash flows up to a date
    const getCumulativeCashFlow = (date: string): number => {
      const targetDate = parseISO(date);
      return cashFlows
        .filter(cf => parseISO(cf.date) <= targetDate)
        .reduce((sum, cf) => sum + (cf.type === 'deposit' ? cf.amount : -cf.amount), 0);
    };

    // Create a map of actual values by date (investment + cash flows)
    const actualMap = new Map(
      actualData.map(point => [point.date, point.amount + getCumulativeCashFlow(point.date)])
    );

    // Calculate actual-based projection
    let actualProjectionMap = new Map<string, number>();

    const actualGrowthRate = calculateActualAverageIncrease(actualData, intervalDays);

    if (actualGrowthRate) {
      // Sort actual data by date
      const sortedActual = [...actualData].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const lastValue = sortedActual[sortedActual.length - 1].amount;
      const lastActualDate = sortedActual[sortedActual.length - 1].date;

      // Project from last actual point forward using daily compounding
      // Actual values already exclude cash flows, so we use the value directly
      const futureData = projectedData.filter(p => parseISO(p.date) >= parseISO(lastActualDate));

      actualProjectionMap = calculateProjection(
        futureData,
        lastValue, // Starting from the last actual investment value
        actualGrowthRate.dailyRate,
        cashFlows
      );
    }

    // Build chart data
    const labels = projectedData.map(point => {
      const date = parseISO(point.date);
      return `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}`;
    });

    // Calculate projected values with cash flows
    const projectedWithCashFlowsMap = calculateProjection(
      projectedData,
      investment.config.startingAmount,
      projectedGrowthRatePerDay,
      cashFlows
    );

    const projected = projectedData.map(point => projectedWithCashFlowsMap.get(point.date) ?? point.amount);

    // For actual data, only show values where we have actual data
    const actual = projectedData.map(point => {
      const actualValue = actualMap.get(point.date);
      return actualValue ?? null;
    });

    // For actual-based projection, show from last actual point forward
    const actualBasedProjection = projectedData.map(point => {
      return actualProjectionMap.get(point.date) ?? null;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Projected',
          data: projected,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.1,
        },
        {
          label: 'Actual',
          data: actual,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
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
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.1,
          spanGaps: false,
        },
      ],
    };
  }, [investment, dateRange]);

  const options = {
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

  return (
    <div className="chart-container">
      <Line data={chartData} options={options} />
    </div>
  );
}
