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
import zoomPlugin from 'chartjs-plugin-zoom';
import { parseISO, differenceInDays } from 'date-fns';
import 'chartjs-adapter-date-fns';
import type { Tracker, DateRange } from '../types/trackers';
import { calculateProjectedValues, calculateActualAverageIncrease, calculateProjection } from '../utils/calculations';
import { useAppContext } from '../contexts/AppContext';
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
  TimeScale,
  zoomPlugin
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
  // Get instrument performance from context
  const { instrumentPerformance } = useAppContext();

  const chartData = useMemo(() => {
    const visibleProjections = tracker.config.projections?.filter(p => p.visible) || [];

    // Calculate full projected data for each visible projection
    const allProjectionData = visibleProjections.map(projection => ({
      projection,
      fullData: calculateProjectedValues(
        projection,
        tracker.config.startDate,
        tracker.config.startingAmount,
        tracker.config.endDate
      )
    }));

    // Calculate date range
    let rangeDays = differenceInDays(
      parseISO(tracker.config.endDate),
      parseISO(tracker.config.startDate)
    );

    if (dateRange) {
      const rangeStart = parseISO(dateRange.startDate);
      const rangeEnd = parseISO(dateRange.endDate);
      rangeDays = differenceInDays(rangeEnd, rangeStart);
    }

    // Determine max data points based on range duration
    let maxDataPoints: number;
    if (rangeDays < 30) {
      maxDataPoints = 1000; // Show all
    } else if (rangeDays < 90) {
      maxDataPoints = 50;
    } else if (rangeDays < 180) {
      maxDataPoints = 40;
    } else {
      maxDataPoints = 30;
    }

    // Filter and sample each projection's data
    const processedProjections = allProjectionData.map(({ projection, fullData }) => {
      let projectedData = fullData;

      if (dateRange) {
        const rangeStart = parseISO(dateRange.startDate);
        const rangeEnd = parseISO(dateRange.endDate);
        projectedData = fullData.filter(point => {
          const pointDate = parseISO(point.date);
          return pointDate >= rangeStart && pointDate <= rangeEnd;
        });
      }

      return {
        projection,
        fullData,
        sampledData: sampleDataPoints(projectedData, maxDataPoints)
      };
    });

    const actualData = tracker.actualData;
    const cashFlows = tracker.cashFlows || [];

    // Use first projection's interval for actual growth rate calculation, or default to 30 days
    const intervalDays = tracker.config.projections?.[0]?.intervalDays || 30;

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

    // Create a map of actual values by date
    // IMPORTANT: For both IBKR and manual data, the 'amount' already includes deposits/withdrawals
    // Users enter the total portfolio value, not just investment gains
    const actualMap = new Map(
      filteredActualData.map(point => {
        // Both IBKR and manual amounts already include deposits, so don't add cash flows
        return [point.date, point.amount];
      })
    );

    // Create a combined set of dates from all projections + actual data
    const dateSet = new Set<string>();
    processedProjections.forEach(({ sampledData }) => {
      sampledData.forEach(p => dateSet.add(p.date));
    });
    filteredActualData.forEach(a => dateSet.add(a.date));

    // Convert to sorted array
    const allDates = Array.from(dateSet).sort((a, b) =>
      parseISO(a).getTime() - parseISO(b).getTime()
    );

    // Calculate actual-based projection
    let actualProjectionMap = new Map<string, number>();

    // Use ALL actual data for growth rate calculation, not just filtered
    // This ensures we have enough data points for a meaningful calculation
    // Pass cash flows for both IBKR and manual trackers to get accurate time-weighted return
    const actualGrowthRate = calculateActualAverageIncrease(
      actualData,
      intervalDays,
      cashFlows
    );

    if (actualGrowthRate && actualData.length > 0) {
      // Use ALL actual data to find the absolute last actual value
      const sortedAllActual = [...actualData].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const lastValue = sortedAllActual[sortedAllActual.length - 1].amount;
      const lastActualDate = sortedAllActual[sortedAllActual.length - 1].date;
      const actualGrowthRatePerDay = actualGrowthRate.dailyRate;

      // Project from last actual point forward using daily compounding
      // Use first projection's full data as baseline, or generate a simple date range
      const baseFullData = processedProjections[0]?.fullData || [];
      const futureFullData = baseFullData.filter(p => parseISO(p.date) >= parseISO(lastActualDate));

      // For actual-based projection, only include FUTURE cash flows
      // lastValue already includes all past cash flows (for both IBKR and manual)
      const futureCashFlows = cashFlows.filter(cf => parseISO(cf.date) > parseISO(lastActualDate));

      const fullActualProjectionMap = calculateProjection(
        futureFullData,
        lastValue, // Starting from the last actual tracker value
        actualGrowthRatePerDay,
        futureCashFlows
      );

      // Copy only the dates we need for display (sampled)
      actualProjectionMap = fullActualProjectionMap;
    }

    // Calculate projected values with cash flows for each projection
    const projectionsWithCashFlows = processedProjections.map(({ projection, fullData }) => {
      const projectedIncreasePercent = projection.increasePercent / 100;
      const projectionIntervalDays = projection.intervalDays;
      const projectedGrowthRatePerDay = Math.pow(1 + projectedIncreasePercent, 1 / projectionIntervalDays) - 1;

      const projectionMap = calculateProjection(
        fullData,
        tracker.config.startingAmount,
        projectedGrowthRatePerDay,
        cashFlows
      );

      return {
        projection,
        dataMap: projectionMap
      };
    });

    // Build chart data using combined dates
    // Use Date objects at noon local time to avoid timezone shifts
    const labels = allDates.map(date => {
      const [year, month, day] = date.split('-').map(Number);
      // Create date at noon local time to prevent timezone date shifts
      return new Date(year, month - 1, day, 12, 0, 0, 0);
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

    // Color palette for projections
    const projectionColors = [
      { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' }, // Blue
      { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)' }, // Purple
      { border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.1)' }, // Pink
      { border: 'rgb(251, 146, 60)', bg: 'rgba(251, 146, 60, 0.1)' }, // Orange
      { border: 'rgb(34, 211, 238)', bg: 'rgba(34, 211, 238, 0.1)' }, // Cyan
    ];

    // Instrument colors (different palette)
    const instrumentColors = [
      { border: 'rgb(220, 38, 38)', bg: 'rgba(220, 38, 38, 0.1)' }, // Red
      { border: 'rgb(217, 119, 6)', bg: 'rgba(217, 119, 6, 0.1)' }, // Amber
      { border: 'rgb(21, 128, 61)', bg: 'rgba(21, 128, 61, 0.1)' }, // Green
      { border: 'rgb(107, 114, 128)', bg: 'rgba(107, 114, 128, 0.1)' }, // Gray
      { border: 'rgb(139, 92, 246)', bg: 'rgba(139, 92, 246, 0.1)' }, // Violet
    ];

    // Build datasets: one for each projection
    const projectionDatasets = projectionsWithCashFlows.map(({ projection, dataMap }, index) => {
      const colors = projectionColors[index % projectionColors.length];
      const data = allDates.map(date => dataMap.get(date) ?? null);

      return {
        label: projection.name || `Projection ${index + 1}`,
        data,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        borderWidth: 2,
        pointRadius,
        pointHoverRadius: pointRadius + 2,
        tension: 0.1,
      };
    });

    // Build datasets for instruments
    const instrumentDatasets = Array.from(instrumentPerformance.entries()).map(([id, perf], index) => {
      const colors = instrumentColors[index % instrumentColors.length];
      const data = allDates.map(date => perf.valueMap.get(date) ?? null);

      return {
        label: perf.symbol,
        data,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        borderWidth: 2,
        borderDash: [3, 3], // Dashed line to differentiate from projections
        pointRadius: Math.max(pointRadius - 1, 0),
        pointHoverRadius: pointRadius + 1,
        tension: 0.1,
        spanGaps: true,
        // Store price map in metadata for tooltip access
        priceMap: perf.priceMap,
      };
    });

    return {
      labels,
      datasets: [
        ...projectionDatasets,
        ...instrumentDatasets,
        {
          label: 'Actual',
          data: actual,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          pointRadius: actualPointRadius,
          pointHoverRadius: actualPointRadius + 2,
          tension: 0.1,
          spanGaps: true, // Connect across gaps to show continuous value
        },
        {
          label: 'Actual-Based Projection',
          data: actualBasedProjection,
          borderColor: 'rgb(34, 197, 94)', // Same green as Actual
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5], // Dotted line
          pointRadius: Math.max(pointRadius - 1, 0),
          pointHoverRadius: pointRadius + 1,
          tension: 0.1,
          spanGaps: false,
        },
      ],
    };
  }, [tracker, dateRange, instrumentPerformance]);

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
        zoom: {
          zoom: {
            drag: {
              enabled: true,
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              borderColor: 'rgba(59, 130, 246, 0.8)',
              borderWidth: 1,
            },
            mode: 'xy' as const,
            onZoomComplete: () => {
              // Optional: callback after zoom
            },
          },
          pan: {
            enabled: true,
            mode: 'xy' as const,
            modifierKey: 'shift' as const, // Hold shift to pan
          },
          limits: {
            x: { min: 'original' as const, max: 'original' as const },
            y: { min: 'original' as const, max: 'original' as const },
          },
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

                // If this is an instrument dataset, show price per share
                if (context.dataset.priceMap) {
                  const dataIndex = context.dataIndex;
                  const date = context.chart.data.labels[dataIndex];
                  // Format date as YYYY-MM-DD in local timezone
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const dateStr = `${year}-${month}-${day}`;
                  const price = context.dataset.priceMap.get(dateStr);
                  if (price !== undefined) {
                    label += ` (${new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(price)}/share)`;
                  }
                }
              }
              return label;
            },
            afterBody: function (tooltipItems: any[]) {
              const dataIndex = tooltipItems[0].dataIndex;
              const datasets = tooltipItems[0].chart.data.datasets;
              const hoveredLabel = tooltipItems[0].dataset.label;
              const date = tooltipItems[0].chart.data.labels[dataIndex];
              // Format date as YYYY-MM-DD in local timezone
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;

              const lines: string[] = [];

              // Only show comparisons when hovering over Actual
              if (hoveredLabel !== 'Actual') {
                return lines;
              }

              // Find actual value
              const actualDataset = datasets.find((d: any) => d.label === 'Actual');
              const actualValue = actualDataset?.data[dataIndex];

              // Compare actual with projections and instruments
              if (actualValue != null) {
                const comparisonDatasets = datasets.filter((d: any) =>
                  d.label !== 'Actual' && d.label !== 'Actual-Based Projection'
                );

                if (comparisonDatasets.length > 0) {
                  lines.push(''); // Empty line for spacing

                  // Calculate differences and sort by difference ascending
                  const comparisons = comparisonDatasets
                    .map((dataset: any) => {
                      const value = dataset.data[dataIndex];
                      if (value != null) {
                        const difference = actualValue - value;
                        const percentDiff = ((difference / value) * 100).toFixed(2);

                        let line = `vs ${dataset.label}: ${new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          signDisplay: 'always'
                        }).format(difference)} (${percentDiff}%)`;

                        // If this is an instrument, add price per share
                        if (dataset.priceMap) {
                          const price = dataset.priceMap.get(dateStr);
                          if (price !== undefined) {
                            line += ` @ ${new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(price)}/share`;
                          }
                        }

                        return {
                          label: dataset.label,
                          difference,
                          percentDiff,
                          line
                        };
                      }
                      return null;
                    })
                    .filter((c: any) => c !== null)
                    .sort((a: any, b: any) => a.difference - b.difference); // Sort by difference ascending

                  comparisons.forEach((comp: any) => {
                    lines.push(comp.line);
                  });
                }
              }

              return lines;
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
