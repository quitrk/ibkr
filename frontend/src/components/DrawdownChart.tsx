import { useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import type { ActualDataPoint } from '../types/trackers';
import type { DrawdownAnalysis } from '../utils/analytics';
import { formatPercentage } from '../utils/calculations';
import { parseISO } from 'date-fns';

interface DrawdownChartProps {
  drawdownAnalysis: DrawdownAnalysis;
  actualData: ActualDataPoint[];
}

export function DrawdownChart({ drawdownAnalysis, actualData }: DrawdownChartProps) {
  const chartRef = useRef<any>(null);

  const chartData = useMemo(() => {
    // Sort actual data by date
    const sortedData = [...actualData].sort((a, b) =>
      parseISO(a.date).getTime() - parseISO(b.date).getTime()
    );

    // Calculate drawdown for each point
    let peak = sortedData[0]?.amount || 0;
    const drawdownData: { date: string; drawdown: number; value: number }[] = [];

    sortedData.forEach(point => {
      if (point.amount > peak) {
        peak = point.amount;
      }
      const drawdown = peak > 0 ? ((peak - point.amount) / peak) * 100 : 0;
      drawdownData.push({
        date: point.date,
        drawdown: -drawdown, // Negative for display
        value: point.amount
      });
    });

    // Create chart data
    const labels = drawdownData.map(d => {
      const [year, month, day] = d.date.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    });

    const datasets = [
      {
        label: 'Drawdown',
        data: drawdownData.map(d => d.drawdown),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      }
    ];

    return { labels, datasets };
  }, [actualData, drawdownAnalysis]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Drawdown Analysis',
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            return `Drawdown: ${formatPercentage(value)}`;
          },
          afterLabel: function(context: any) {
            // Add max drawdown info if this is the max
            if (Math.abs(context.parsed.y) === drawdownAnalysis.maxDrawdown) {
              return 'Maximum Drawdown';
            }
            return '';
          },
        },
      },
      annotation: {
        annotations: {
          maxDrawdown: drawdownAnalysis.maxDrawdownEndDate ? {
            type: 'line' as const,
            yMin: -drawdownAnalysis.maxDrawdown,
            yMax: -drawdownAnalysis.maxDrawdown,
            borderColor: 'rgba(255, 99, 132, 0.8)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: `Max: ${formatPercentage(-drawdownAnalysis.maxDrawdown)}`,
              enabled: true,
              position: 'end' as const,
            },
          } : {},
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'month' as const,
          displayFormats: {
            month: 'MMM yyyy',
          },
        },
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Drawdown (%)',
        },
        ticks: {
          callback: function(value: any) {
            return value.toFixed(1) + '%';
          },
        },
        // Start from 0 and go negative
        max: 0,
        grid: {
          color: (context: any) => {
            if (context.tick.value === 0) {
              return 'rgba(255, 255, 255, 0.3)';
            }
            return 'rgba(255, 255, 255, 0.1)';
          },
          lineWidth: (context: any) => {
            if (context.tick.value === 0) {
              return 2;
            }
            return 1;
          },
        },
      },
    },
  }), [drawdownAnalysis]);

  return (
    <div className="drawdown-chart">
      <div className="chart-container" style={{ height: '400px' }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>

      {/* Drawdown periods summary */}
      <div className="drawdown-summary">
        <h4>Drawdown Periods</h4>
        <div className="drawdown-periods">
          {drawdownAnalysis.drawdownPeriods.map((period, idx) => (
            <div key={idx} className={`drawdown-period ${period.recovered ? 'recovered' : 'active'}`}>
              <span className="period-dates">
                {new Date(period.startDate).toLocaleDateString()} -
                {period.endDate ? new Date(period.endDate).toLocaleDateString() : 'Ongoing'}
              </span>
              <span className="period-drawdown">
                {formatPercentage(-period.drawdown)}
              </span>
              <span className={`period-status ${period.recovered ? 'recovered' : 'active'}`}>
                {period.recovered ? 'Recovered' : 'Active'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}