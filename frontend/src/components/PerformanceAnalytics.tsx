import { useState, useMemo } from 'react';
import type { Tracker, DateRange } from '../types/trackers';
import {
  calculatePerformanceSummary,
  calculateRollingReturns,
  calculateDrawdown,
  getBestWorstPeriods
} from '../utils/analytics';
import { calculateProjectedValues } from '../utils/calculations';
import { formatPercentage } from '../utils/calculations';
import { RollingReturnsChart } from './RollingReturnsChart';
import { DrawdownChart } from './DrawdownChart';
import { PerformanceTable } from './PerformanceTable';
import { ComparisonSelector, type ComparisonType } from './ComparisonSelector';
import { useAppContext } from '../contexts/AppContext';
import './StatCard.css';
import './PerformanceAnalytics.css';

interface PerformanceAnalyticsProps {
  tracker: Tracker;
  dateRange?: DateRange;
}

type TabType = 'returns' | 'risk' | 'attribution';

export function PerformanceAnalytics({ tracker, dateRange }: PerformanceAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('returns');
  const { instrumentPerformance } = useAppContext();

  // Get visible projections and instruments
  const visibleProjections = tracker.config.projections?.filter(p => p.visible) || [];
  const visibleInstruments = tracker.config.instruments?.filter(inst => inst.visible) || [];

  // Default to first visible projection if available, otherwise first visible instrument
  const defaultType: ComparisonType = visibleProjections.length > 0 ? 'projection' : 'instrument';
  const defaultId = visibleProjections[0]?.id || visibleInstruments[0]?.id || null;

  const [selectedType, setSelectedType] = useState<ComparisonType>(defaultType);
  const [selectedId, setSelectedId] = useState<string | null>(defaultId);

  // Calculate all analytics data
  const analyticsData = useMemo(() => {
    // Filter data by date range if provided
    let actualData = tracker.actualData;
    if (dateRange) {
      actualData = actualData.filter(point => {
        const date = new Date(point.date);
        return date >= new Date(dateRange.startDate) && date <= new Date(dateRange.endDate);
      });
    }

    if (actualData.length === 0) {
      return null;
    }

    // Get projected data based on selected comparison
    let projectedData: { date: string; amount: number }[] = [];

    if (selectedType === 'projection' && selectedId) {
      const selectedProjection = tracker.config.projections?.find(p => p.id === selectedId);
      if (selectedProjection) {
        projectedData = calculateProjectedValues(
          selectedProjection,
          tracker.config.startDate,
          tracker.config.startingAmount,
          tracker.config.endDate
        );
      }
    } else if (selectedType === 'instrument' && selectedId) {
      // For instruments, use the performance data from context
      const instrumentData = instrumentPerformance.get(selectedId);
      if (instrumentData) {
        // Convert instrument performance to projected data format
        projectedData = Array.from(instrumentData.valueMap.entries()).map(([date, amount]) => ({
          date,
          amount
        }));
      }
    }

    // Calculate performance summary
    const summary = calculatePerformanceSummary(
      actualData,
      projectedData,
      tracker.cashFlows || []
    );

    // Calculate rolling returns
    const rollingReturns = calculateRollingReturns(
      actualData,
      tracker.cashFlows || [],
      [30, 60, 90]
    );

    // Calculate drawdown analysis (accounting for cash flows)
    const drawdownAnalysis = calculateDrawdown(actualData, tracker.cashFlows || []);

    // Get best/worst periods
    const bestWorstPeriods = getBestWorstPeriods(
      actualData,
      tracker.cashFlows || [],
      5
    );

    return {
      summary,
      rollingReturns,
      drawdownAnalysis,
      bestWorstPeriods,
      actualData,
      projectedData
    };
  }, [tracker, dateRange, selectedType, selectedId, instrumentPerformance]);

  if (!analyticsData) {
    return (
      <div className="performance-analytics">
        <div className="no-data-message">
          <p>No data available for analysis. Start adding actual values to see performance metrics.</p>
        </div>
      </div>
    );
  }

  const { summary } = analyticsData;

  return (
    <div className="performance-analytics">
      <div className="analytics-header">
        <h2>Performance Analytics</h2>
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

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="metric-card">
          <div className="metric-label">Total Return</div>
          <div className={`metric-value ${summary.totalReturn >= 0 ? 'positive' : 'negative'}`}>
            {formatPercentage(summary.totalReturn)}
          </div>
          <div className="metric-subtitle">
            Annualized: {formatPercentage(summary.annualizedReturn)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Current Drawdown</div>
          <div className={`metric-value ${summary.currentDrawdown > 10 ? 'negative' : ''}`}>
            {formatPercentage(-summary.currentDrawdown)}
          </div>
          <div className="metric-subtitle">
            Max: {formatPercentage(-summary.maxDrawdown)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Volatility (Annual)</div>
          <div className="metric-value">
            {formatPercentage(summary.volatility)}
          </div>
          <div className="metric-subtitle">
            Sharpe: {summary.sharpeRatio.toFixed(2)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Win Rate</div>
          <div className={`metric-value ${summary.winRate >= 50 ? 'positive' : 'negative'}`}>
            {formatPercentage(summary.winRate)}
          </div>
          <div className="metric-subtitle">
            vs Projection
          </div>
        </div>
      </div>

      <div className="analytics">
        {/* Tab Navigation */}
        <div className="analytics-tabs">
          <button
            className={`tab-button ${activeTab === 'returns' ? 'active' : ''}`}
            onClick={() => setActiveTab('returns')}
          >
            Returns Analysis
          </button>
          <button
            className={`tab-button ${activeTab === 'risk' ? 'active' : ''}`}
            onClick={() => setActiveTab('risk')}
          >
            Risk Analysis
          </button>
          <button
            className={`tab-button ${activeTab === 'attribution' ? 'active' : ''}`}
            onClick={() => setActiveTab('attribution')}
          >
            Performance Attribution
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'returns' && (
            <div className="returns-analysis">
              <RollingReturnsChart
                rollingReturns={analyticsData.rollingReturns}
              />
              <PerformanceTable
                actualData={analyticsData.actualData}
                cashFlows={tracker.cashFlows || []}
              />
            </div>
          )}

          {activeTab === 'risk' && (
            <div className="risk-analysis">
              <DrawdownChart
                drawdownAnalysis={analyticsData.drawdownAnalysis}
                actualData={analyticsData.actualData}
              />
              <div className="risk-metrics">
                <h3>Risk Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <span className="metric-name">Maximum Drawdown</span>
                    <span className="metric-val negative">
                      {formatPercentage(-summary.maxDrawdown)}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-name">Current Drawdown</span>
                    <span className={`metric-val ${summary.currentDrawdown > 0 ? 'negative' : ''}`}>
                      {formatPercentage(-summary.currentDrawdown)}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-name">Volatility (Annual)</span>
                    <span className="metric-val">
                      {formatPercentage(summary.volatility)}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-name">Sharpe Ratio</span>
                    <span className="metric-val">
                      {summary.sharpeRatio.toFixed(3)}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-name">Drawdown Periods</span>
                    <span className="metric-val">
                      {analyticsData.drawdownAnalysis.drawdownPeriods.length}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-name">Avg Recovery Days</span>
                    <span className="metric-val">
                      {calculateAvgRecoveryDays(analyticsData.drawdownAnalysis.drawdownPeriods)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attribution' && (
            <div className="attribution-analysis">
              <div className="best-worst-periods">
                <div className="period-section">
                  <h3>Best Performing Periods</h3>
                  <table className="period-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Return</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.bestWorstPeriods.best.map((period, idx) => (
                        <tr key={idx}>
                          <td>{formatPeriod(period.startDate, period.endDate)}</td>
                          <td className="positive">{formatPercentage(period.return)}</td>
                          <td>{period.duration} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="period-section">
                  <h3>Worst Performing Periods</h3>
                  <table className="period-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Return</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.bestWorstPeriods.worst.map((period, idx) => (
                        <tr key={idx}>
                          <td>{formatPeriod(period.startDate, period.endDate)}</td>
                          <td className="negative">{formatPercentage(period.return)}</td>
                          <td>{period.duration} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {summary.bestMonth && summary.worstMonth && (
                <div className="monthly-extremes">
                  <h3>Monthly Extremes</h3>
                  <div className="extremes-grid">
                    <div className="extreme-card best">
                      <div className="extreme-label">Best Month</div>
                      <div className="extreme-value positive">
                        {formatPercentage(summary.bestMonth.return)}
                      </div>
                      <div className="extreme-period">
                        {formatPeriod(summary.bestMonth.startDate, summary.bestMonth.endDate)}
                      </div>
                    </div>
                    <div className="extreme-card worst">
                      <div className="extreme-label">Worst Month</div>
                      <div className="extreme-value negative">
                        {formatPercentage(summary.worstMonth.return)}
                      </div>
                      <div className="extreme-period">
                        {formatPeriod(summary.worstMonth.startDate, summary.worstMonth.endDate)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function calculateAvgRecoveryDays(periods: any[]): string {
  const recovered = periods.filter(p => p.recovered);
  if (recovered.length === 0) return 'N/A';

  const totalDays = recovered.reduce((sum, p) => {
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, 0);

  return Math.round(totalDays / recovered.length).toString();
}

function formatPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  if (startMonth === endMonth) {
    return startMonth;
  }
  return `${startMonth} - ${endMonth}`;
}