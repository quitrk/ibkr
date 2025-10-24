import { useState, useMemo } from 'react';
import type { Tracker } from '../types/trackers';
import {
  calculateProjectedValues,
  calculateVariance,
  getLatestActualValue,
  formatCurrency,
  formatPercentage,
  calculateActualAverageIncrease,
} from '../utils/calculations';
import { useAppContext } from '../contexts/AppContext';
import { ComparisonSelector, type ComparisonType } from './ComparisonSelector';
import './StatCard.css';
import './SummaryStats.css';

interface SummaryStatsProps {
  tracker: Tracker;
}

export function SummaryStats({ tracker }: SummaryStatsProps) {
  const { instrumentPerformance } = useAppContext();

  // Get visible projections and instruments
  const visibleProjections = tracker.config.projections?.filter(p => p.visible) || [];
  const visibleInstruments = tracker.config.instruments?.filter(inst => inst.visible) || [];

  // Default to first visible projection if available, otherwise first visible instrument
  const defaultType: ComparisonType = visibleProjections.length > 0 ? 'projection' : 'instrument';
  const defaultId = visibleProjections[0]?.id || visibleInstruments[0]?.id || null;

  const [selectedType, setSelectedType] = useState<ComparisonType>(defaultType);
  const [selectedId, setSelectedId] = useState<string | null>(defaultId);

  // Calculate stats based on selected comparison type
  const stats = useMemo(() => {
    const latestActual = getLatestActualValue(tracker.actualData);

    if (!latestActual || !selectedId) {
      return null;
    }

    const cashFlows = tracker.cashFlows || [];

    if (selectedType === 'projection') {
      const selectedProjection = tracker.config.projections?.find(p => p.id === selectedId);
      if (!selectedProjection) {
        return null;
      }

      const projectedData = calculateProjectedValues(
        selectedProjection,
        tracker.config.startDate,
        tracker.config.startingAmount,
        tracker.config.endDate
      );

      const matchingProjected = projectedData.find(p => p.date === latestActual.date);
      if (!matchingProjected) {
        return null;
      }

      const variance = calculateVariance(
        matchingProjected.amount,
        latestActual.amount,
        latestActual.date,
        cashFlows
      );

      return {
        latestActual: latestActual.amount,
        latestCompared: variance.projectedWithCashFlows,
        variance,
        date: latestActual.date,
        comparisonName: selectedProjection.name || 'Projection',
        comparisonType: 'projection' as ComparisonType,
        projectionData: selectedProjection,
      };
    } else {
      // Instrument comparison
      const instrumentData = instrumentPerformance.get(selectedId);
      if (!instrumentData) {
        return null;
      }

      const instrumentValue = instrumentData.valueMap.get(latestActual.date);
      if (instrumentValue === undefined) {
        return null;
      }

      // Don't pass cash flows to calculateVariance for instruments
      // because instrumentValue already includes cash flows
      const variance = calculateVariance(
        instrumentValue,
        latestActual.amount,
        latestActual.date,
        [] // Empty - instrument value already includes cash flows
      );

      return {
        latestActual: latestActual.amount,
        latestCompared: instrumentValue, // Use instrumentValue directly since it already has cash flows
        variance,
        date: latestActual.date,
        comparisonName: instrumentData.symbol,
        comparisonType: 'instrument' as ComparisonType,
      };
    }
  }, [tracker, selectedType, selectedId, instrumentPerformance]);

  // Calculate actual average increase
  const actualAvgIncrease = useMemo(() => {
    const cashFlows = tracker.cashFlows || [];
    // Use selected projection's intervalDays if projection is selected, otherwise use first projection
    let intervalDays = 30;
    if (selectedType === 'projection' && selectedId) {
      const selectedProjection = tracker.config.projections?.find(p => p.id === selectedId);
      intervalDays = selectedProjection?.intervalDays || 30;
    } else {
      intervalDays = tracker.config.projections?.[0]?.intervalDays || 30;
    }
    const result = calculateActualAverageIncrease(
      tracker.actualData,
      intervalDays,
      cashFlows
    );
    return result?.intervalPercentage ?? null;
  }, [tracker.actualData, tracker.config.projections, tracker.cashFlows, selectedType, selectedId]);

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
      <div className="stats-header">
        <h3>Current Performance</h3>
        <ComparisonSelector
          tracker={tracker}
          selectedType={selectedType}
          selectedId={selectedId}
          onSelectionChange={(type, id) => {
            setSelectedType(type);
            setSelectedId(id);
          }}
        />
      </div>
      <div className="stats-grid">
        <div className="stat-card stat-card-combined">
          <div className="stat-combined-content">
            <div className="stat-section">
              <div className="stat-label">Current</div>
              <div className={`stat-value ${isAhead ? 'positive' : 'negative'}`}>
                {formatCurrency(stats.latestActual)}
              </div>
              {stats.projectionData && actualAvgIncrease !== null && (
                <div className={`stat-note ${actualAvgIncrease >= stats.projectionData.increasePercent ? 'positive' : 'negative'}`}>
                  {actualAvgIncrease.toFixed(2)}% / {stats.projectionData.intervalDays} days
                </div>
              )}
            </div>
            <div className="stat-section">
              <div className="stat-label">
                {stats.comparisonType === 'projection' ? 'Projected' : 'Instrument'}
                {stats.comparisonName && ` (${stats.comparisonName})`}
              </div>
              <div className="stat-value">{formatCurrency(stats.latestCompared)}</div>
              {stats.projectionData && (
                <div className="stat-note">
                  {stats.projectionData.increasePercent}% / {stats.projectionData.intervalDays} days
                </div>
              )}
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
                {isAhead ? `Outperforming ${stats.comparisonName}` : `Below ${stats.comparisonName}`}
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
