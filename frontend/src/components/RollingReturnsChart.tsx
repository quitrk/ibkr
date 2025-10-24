import { useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { formatPercentage } from '../utils/calculations';

interface RollingReturnsChartProps {
  rollingReturns: Map<number, { date: string; return: number }[]>;
}

export function RollingReturnsChart({ rollingReturns }: RollingReturnsChartProps) {
  const chartRef = useRef<any>(null);

  const chartData = useMemo(() => {
    // Get all unique dates from rolling returns
    const allDates = new Set<string>();
    rollingReturns.forEach(periods => {
      periods.forEach(p => allDates.add(p.date));
    });

    const sortedDates = Array.from(allDates).sort();

    // Create date map for each period
    const returnsBy30 = new Map(rollingReturns.get(30)?.map(r => [r.date, r.return]) || []);
    const returnsBy60 = new Map(rollingReturns.get(60)?.map(r => [r.date, r.return]) || []);
    const returnsBy90 = new Map(rollingReturns.get(90)?.map(r => [r.date, r.return]) || []);

    // Build chart data
    const labels = sortedDates.map(date => {
      const [year, month, day] = date.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    });

    const datasets = [
      {
        label: '30-Day Rolling Return',
        data: sortedDates.map(date => returnsBy30.get(date) ?? null),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      },
      {
        label: '60-Day Rolling Return',
        data: sortedDates.map(date => returnsBy60.get(date) ?? null),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      },
      {
        label: '90-Day Rolling Return',
        data: sortedDates.map(date => returnsBy90.get(date) ?? null),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      },
    ];

    return { labels, datasets };
  }, [rollingReturns]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Rolling Returns',
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatPercentage(context.parsed.y);
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
          text: 'Return (%)',
        },
        ticks: {
          callback: function(value: any) {
            return value.toFixed(1) + '%';
          },
        },
        // Add reference line at 0
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
  }), []);

  return (
    <div className="rolling-returns-chart">
      <div className="chart-container" style={{ height: '400px' }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
}