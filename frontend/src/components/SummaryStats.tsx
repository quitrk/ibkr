import { useMemo } from 'react';
import type { Investment } from '../types/investment';
import {
  calculateProjectedValues,
  calculateVariance,
  getLatestActualValue,
  formatCurrency,
  formatPercentage,
  calculateActualAverageIncrease,
} from '../utils/calculations';
import './SummaryStats.css';

interface SummaryStatsProps {
  investment: Investment;
}

export function SummaryStats({ investment }: SummaryStatsProps) {
  const stats = useMemo(() => {
    const latestActual = getLatestActualValue(investment.actualData);

    if (!latestActual) {
      return null;
    }

    const projectedData = calculateProjectedValues(investment.config);

    // Find the projected value for the same date as the latest actual value
    const matchingProjected = projectedData.find(
      p => p.date === latestActual.date
    );

    if (!matchingProjected) {
      return null;
    }

    const variance = calculateVariance(
      matchingProjected.amount,
      latestActual.amount
    );

    return {
      latestActual: latestActual.amount,
      latestProjected: matchingProjected.amount,
      variance,
      date: latestActual.date,
    };
  }, [investment]);

  if (!stats) {
    return (
      <div className="summary-stats">
        <p className="no-data">No actual data recorded yet. Add your first entry below!</p>
      </div>
    );
  }

  const isAhead = stats.variance.absolute > 0;

  const actualAvgIncrease = useMemo(() => {
    const result = calculateActualAverageIncrease(
      investment.actualData,
      investment.config.intervalDays
    );
    return result?.intervalPercentage ?? null;
  }, [investment.actualData, investment.cashFlows, investment.config.intervalDays]);

  return (
    <div className="summary-stats">
      <h3>Current Performance</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Latest Actual</div>
          <div className="stat-value">{formatCurrency(stats.latestActual)}</div>
          <div className="stat-date">{stats.date}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Projected Value</div>
          <div className="stat-value">{formatCurrency(stats.latestProjected)}</div>
          <div className="stat-date">{stats.date}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Variance</div>
          <div className={`stat-value ${isAhead ? 'positive' : 'negative'}`}>
            {formatCurrency(Math.abs(stats.variance.absolute))}
          </div>
          <div className={`stat-percentage ${isAhead ? 'positive' : 'negative'}`}>
            {formatPercentage(stats.variance.percentage)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Status</div>
          <div className={`stat-status ${isAhead ? 'positive' : 'negative'}`}>
            {isAhead ? '📈 Ahead' : '📉 Behind'}
          </div>
          <div className="stat-note">
            {isAhead ? 'Outperforming projection' : 'Below projection'}
          </div>
        </div>
      </div>

      <div className="config-info">
        <div className="config-item">
          <span className="config-label">Starting Amount:</span>
          <span className="config-value">${investment.config.startingAmount.toLocaleString()}</span>
        </div>
        <div className="config-item">
          <span className="config-label">Projected Increase:</span>
          <span className="config-value">
            {investment.config.projectedIncreasePercent}%
            {actualAvgIncrease !== null && (
              <span className="actual-avg"> (actual: {actualAvgIncrease.toFixed(2)}%)</span>
            )}
          </span>
        </div>
        <div className="config-item">
          <span className="config-label">Interval:</span>
          <span className="config-value">{investment.config.intervalDays} days</span>
        </div>
        {investment.config.lastSyncTimestamp && (
          <div className="config-item">
            <span className="config-label">Last Sync:</span>
            <span className="config-value">
              {new Date(investment.config.lastSyncTimestamp).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
