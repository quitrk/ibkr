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
import './SummaryStats.css';

interface SummaryStatsProps {
  tracker: Tracker;
}

type ComparisonType = 'projection' | 'instrument';

export function SummaryStats({ tracker }: SummaryStatsProps) {
  const { instrumentPerformance } = useAppContext();

  // Default to first projection if available, otherwise first instrument
  const defaultType: ComparisonType = tracker.config.projections && tracker.config.projections.length > 0 ? 'projection' : 'instrument';
  const defaultId = tracker.config.projections?.[0]?.id || tracker.config.instruments?.[0]?.id || null;

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
    const intervalDays = tracker.config.projections?.[0]?.intervalDays || 30;
    const result = calculateActualAverageIncrease(
      tracker.actualData,
      intervalDays,
      cashFlows
    );
    return result?.intervalPercentage ?? null;
  }, [tracker.actualData, tracker.config.projections, tracker.cashFlows]);

  const hasProjections = tracker.config.projections && tracker.config.projections.length > 0;
  const hasInstruments = tracker.config.instruments && tracker.config.instruments.length > 0;
  const hasMultipleOptions = (hasProjections && hasInstruments) ||
    (hasProjections && tracker.config.projections!.length > 1) ||
    (hasInstruments && tracker.config.instruments!.length > 1);

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
        {hasMultipleOptions && (
          <div className="projection-selector-group">
            <label htmlFor="comparison-select">Compare to</label>
            <select
              id="comparison-select"
              value={`${selectedType}:${selectedId}`}
              onChange={(e) => {
                const [type, id] = e.target.value.split(':');
                setSelectedType(type as ComparisonType);
                setSelectedId(id);
              }}
              className="projection-selector"
            >
              {hasProjections && (
                <optgroup label="Projections">
                  {tracker.config.projections!.map((projection, index) => (
                    <option key={projection.id} value={`projection:${projection.id}`}>
                      {projection.name || `Projection ${index + 1}`}
                    </option>
                  ))}
                </optgroup>
              )}
              {hasInstruments && (
                <optgroup label="Instruments">
                  {tracker.config.instruments!.map((instrument) => {
                    const perfData = instrumentPerformance.get(instrument.id);
                    return (
                      <option key={instrument.id} value={`instrument:${instrument.id}`}>
                        {perfData?.symbol || instrument.symbol}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>
        )}
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
