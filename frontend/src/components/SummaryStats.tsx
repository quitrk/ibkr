import { useMemo } from 'react';
import type { Tracker } from '../types/trackers';
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
  tracker: Tracker;
}

export function SummaryStats({ tracker }: SummaryStatsProps) {
  const stats = useMemo(() => {
    const latestActual = getLatestActualValue(tracker.actualData);

    if (!latestActual) {
      return null;
    }

    const projectedData = calculateProjectedValues(tracker.config);

    // Find the projected value for the same date as the latest actual value
    const matchingProjected = projectedData.find(
      p => p.date === latestActual.date
    );

    if (!matchingProjected) {
      return null;
    }

    const cashFlows = tracker.cashFlows || [];
    const variance = calculateVariance(
      matchingProjected.amount,
      latestActual.amount,
      latestActual.date,
      cashFlows
    );

    return {
      latestActual: latestActual.amount,
      latestProjected: variance.projectedWithCashFlows,
      variance,
      date: latestActual.date,
    };
  }, [tracker]);

  // MUST be called before any early returns to follow hooks rules
  const actualAvgIncrease = useMemo(() => {
    const cashFlows = tracker.cashFlows || [];
    const result = calculateActualAverageIncrease(
      tracker.actualData,
      tracker.config.intervalDays,
      cashFlows
    );
    return result?.intervalPercentage ?? null;
  }, [tracker.actualData, tracker.config.intervalDays, tracker.cashFlows]);

  if (!stats) {
    return (
      <div className="summary-stats">
        <p className="no-data">No actual data recorded yet. Add your first entry below!</p>
      </div>
    );
  }

  const isAhead = stats.variance.absolute > 0;

  return (
    <div className="summary-stats">
      <h3>Current Performance</h3>
      <div className="stats-grid">
        <div className="stat-card stat-card-combined">
          <div className="stat-combined-content">
            <div className="stat-section">
              <div className="stat-label">Current</div>
              <div className={`stat-value ${isAhead ? 'positive' : 'negative'}`}>
                {formatCurrency(stats.latestActual)}
              </div>
              <div className={`stat-note ${actualAvgIncrease !== null && actualAvgIncrease >= tracker.config.projectedIncreasePercent ? 'positive' : 'negative'}`}>
                {actualAvgIncrease !== null ? `${actualAvgIncrease.toFixed(2)}% / ${tracker.config.intervalDays} days` : 'No data'}
              </div>
            </div>
            <div className="stat-section">
              <div className="stat-label">Projected</div>
              <div className="stat-value">{formatCurrency(stats.latestProjected)}</div>
              <div className="stat-note">
                {tracker.config.projectedIncreasePercent}% / {tracker.config.intervalDays} days
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-combined">
          <div className="stat-combined-content">
            <div className="stat-section">
              <div className="stat-label">Status</div>
              <div className={`stat-status ${isAhead ? 'positive' : 'negative'}`}>
                {isAhead ? '📈 Ahead' : '📉 Behind'}
              </div>
              <div className="stat-note">
                {isAhead ? 'Outperforming projection' : 'Below projection'}
              </div>
            </div>
            <div className="stat-section">
              <div className="stat-label">Variance</div>
              <div className={`stat-value ${isAhead ? 'positive' : 'negative'}`}>
                {formatCurrency(Math.abs(stats.variance.absolute))}
              </div>
              <div className={`stat-percentage ${isAhead ? 'positive' : 'negative'}`}>
                {formatPercentage(stats.variance.percentage)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
