import { useMemo, useState } from 'react';
import type { ActualDataPoint, CashFlow } from '../types/trackers';
import { calculateReturn } from '../utils/analytics';
import { formatCurrency, formatPercentage } from '../utils/calculations';
import { parseISO, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { findLast } from '../utils/arrayHelpers';

interface PerformanceTableProps {
  actualData: ActualDataPoint[];
  cashFlows: CashFlow[];
}

type PeriodType = 'monthly' | 'quarterly' | 'yearly';

interface PeriodData {
  period: string;
  startValue: number;
  endValue: number;
  return: number;
  cumulative: number;
}

export function PerformanceTable({ actualData, cashFlows }: PerformanceTableProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortBy, setSortBy] = useState<'period' | 'return' | 'cumulative'>('period');

  const tableData = useMemo(() => {
    if (actualData.length < 2) return [];

    // Sort data by date
    const sortedData = [...actualData].sort((a, b) =>
      parseISO(a.date).getTime() - parseISO(b.date).getTime()
    );

    const firstDate = parseISO(sortedData[0].date);
    const lastDate = parseISO(sortedData[sortedData.length - 1].date);
    const firstValue = sortedData[0].amount;

    const periodData: PeriodData[] = [];

    if (periodType === 'monthly') {
      const months = eachMonthOfInterval({ start: firstDate, end: lastDate });

      months.forEach((month, index) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        // Find data points for this month
        const startPoint = index === 0
          ? sortedData[0]
          : findLast(sortedData, (d: ActualDataPoint) => parseISO(d.date) <= monthStart) ||
            sortedData.find((d: ActualDataPoint) => parseISO(d.date) >= monthStart);

        const endPoint = findLast(sortedData, (d: ActualDataPoint) => parseISO(d.date) <= monthEnd);

        if (startPoint && endPoint && startPoint.date !== endPoint.date) {
          const monthReturn = calculateReturn(
            startPoint.amount,
            endPoint.amount,
            cashFlows,
            startPoint.date,
            endPoint.date
          );

          const cumulativeReturn = calculateReturn(
            firstValue,
            endPoint.amount,
            cashFlows,
            sortedData[0].date,
            endPoint.date
          );

          periodData.push({
            period: format(month, 'MMM yyyy'),
            startValue: startPoint.amount,
            endValue: endPoint.amount,
            return: monthReturn,
            cumulative: cumulativeReturn
          });
        }
      });
    } else if (periodType === 'quarterly') {
      // Group by quarters
      const months = eachMonthOfInterval({ start: firstDate, end: lastDate });
      const quarters: Date[][] = [];

      for (let i = 0; i < months.length; i += 3) {
        quarters.push(months.slice(i, Math.min(i + 3, months.length)));
      }

      quarters.forEach((quarter, index) => {
        if (quarter.length === 0) return;

        const quarterStart = startOfMonth(quarter[0]);
        const quarterEnd = endOfMonth(quarter[quarter.length - 1]);

        const startPoint = index === 0
          ? sortedData[0]
          : findLast(sortedData, (d: ActualDataPoint) => parseISO(d.date) <= quarterStart) ||
            sortedData.find((d: ActualDataPoint) => parseISO(d.date) >= quarterStart);

        const endPoint = findLast(sortedData, (d: ActualDataPoint) => parseISO(d.date) <= quarterEnd);

        if (startPoint && endPoint && startPoint.date !== endPoint.date) {
          const quarterReturn = calculateReturn(
            startPoint.amount,
            endPoint.amount,
            cashFlows,
            startPoint.date,
            endPoint.date
          );

          const cumulativeReturn = calculateReturn(
            firstValue,
            endPoint.amount,
            cashFlows,
            sortedData[0].date,
            endPoint.date
          );

          const year = quarter[0].getFullYear();
          const q = Math.floor(quarter[0].getMonth() / 3) + 1;

          periodData.push({
            period: `Q${q} ${year}`,
            startValue: startPoint.amount,
            endValue: endPoint.amount,
            return: quarterReturn,
            cumulative: cumulativeReturn
          });
        }
      });
    } else {
      // Yearly
      const years = new Set<number>();
      sortedData.forEach(d => years.add(parseISO(d.date).getFullYear()));

      Array.from(years).forEach((year) => {
        const yearData = sortedData.filter(d =>
          parseISO(d.date).getFullYear() === year
        );

        if (yearData.length >= 2) {
          const startPoint = yearData[0];
          const endPoint = yearData[yearData.length - 1];

          const yearReturn = calculateReturn(
            startPoint.amount,
            endPoint.amount,
            cashFlows,
            startPoint.date,
            endPoint.date
          );

          const cumulativeReturn = calculateReturn(
            firstValue,
            endPoint.amount,
            cashFlows,
            sortedData[0].date,
            endPoint.date
          );

          periodData.push({
            period: year.toString(),
            startValue: startPoint.amount,
            endValue: endPoint.amount,
            return: yearReturn,
            cumulative: cumulativeReturn
          });
        }
      });
    }

    // Sort data
    return periodData.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'period') {
        comparison = a.period.localeCompare(b.period);
      } else if (sortBy === 'return') {
        comparison = a.return - b.return;
      } else {
        comparison = a.cumulative - b.cumulative;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [actualData, cashFlows, periodType, sortBy, sortOrder]);

  const handleSort = (column: 'period' | 'return' | 'cumulative') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div className="performance-table">
      <div className="table-header">
        <h3>Performance by Period</h3>
        <div className="period-selector">
          <button
            className={`period-btn ${periodType === 'monthly' ? 'active' : ''}`}
            onClick={() => setPeriodType('monthly')}
          >
            Monthly
          </button>
          <button
            className={`period-btn ${periodType === 'quarterly' ? 'active' : ''}`}
            onClick={() => setPeriodType('quarterly')}
          >
            Quarterly
          </button>
          <button
            className={`period-btn ${periodType === 'yearly' ? 'active' : ''}`}
            onClick={() => setPeriodType('yearly')}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="performance-data-table">
          <thead>
            <tr>
              <th
                onClick={() => handleSort('period')}
                className="sortable"
              >
                Period
                {sortBy === 'period' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? ' ↑' : ' ↓'}
                  </span>
                )}
              </th>
              <th>Start Value</th>
              <th>End Value</th>
              <th
                onClick={() => handleSort('return')}
                className="sortable"
              >
                Return
                {sortBy === 'return' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? ' ↑' : ' ↓'}
                  </span>
                )}
              </th>
              <th
                onClick={() => handleSort('cumulative')}
                className="sortable"
              >
                Cumulative
                {sortBy === 'cumulative' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? ' ↑' : ' ↓'}
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={idx}>
                <td>{row.period}</td>
                <td>{formatCurrency(row.startValue)}</td>
                <td>{formatCurrency(row.endValue)}</td>
                <td className={row.return >= 0 ? 'positive' : 'negative'}>
                  {formatPercentage(row.return)}
                </td>
                <td className={row.cumulative >= 0 ? 'positive' : 'negative'}>
                  {formatPercentage(row.cumulative)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tableData.length === 0 && (
        <div className="no-data">
          <p>Not enough data to display {periodType} performance</p>
        </div>
      )}
    </div>
  );
}