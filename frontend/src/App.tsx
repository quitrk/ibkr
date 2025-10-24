import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressChart } from './components/ProgressChart';
import { ActualAmountUpdater } from './components/ActualAmountUpdater';
import { CashFlowManager } from './components/CashFlowManager';
import { SummaryStats } from './components/SummaryStats';
import { DateRangeSelector } from './components/DateRangeSelector';
import { IBKRConnection } from './components/IBKRConnection';
import { TrackerSidebar } from './components/TrackerSidebar';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';
import type { TrackerConfig, DateRange, CashFlow } from './types/trackers';
import {
  getAllTrackers,
  createTracker,
  updateActualDataPoint,
  deleteActualDataPoint,
  updateTrackerConfig,
  regenerateScheduledCashFlows,
  deleteTracker,
  addCashFlow,
  deleteCashFlow,
} from './api/storage';
import { useAppContext } from './contexts/AppContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ToastDuration } from './components/Toast';
import './App.css';

type ViewType = 'dashboard' | 'analytics';

function AppContent() {
  const { trackers, setTrackers, selectedTracker, setSelectedTracker } = useAppContext();
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const { showSuccess } = useToast();

  // Use ref to track the currently selected tracker to avoid stale closures
  const selectedTrackerRef = useRef(selectedTracker);

  // Keep ref in sync with state
  useEffect(() => {
    selectedTrackerRef.current = selectedTracker;
  }, [selectedTracker]);

  // Load trackers from localStorage on mount
  useEffect(() => {
    const stored = getAllTrackers();
    setTrackers(stored);

    // Find portfolio tracker
    const portfolio = stored.find(inv => inv.config.id === 'ibkr-portfolio');
    if (portfolio) {
      setSelectedTracker(portfolio);
    } else if (stored.length > 0) {
      setSelectedTracker(stored[0]);
    }
  }, []);

  const handleCreateTracker = (config: TrackerConfig) => {
    const newTracker = createTracker(config);
    const updated = getAllTrackers();
    setTrackers(updated);
    setSelectedTracker(newTracker);
    showSuccess(`Tracker "${config.name}" created successfully`, ToastDuration.Short);
  };

  const handleUpdateActual = (date: string, amount: number) => {
    if (!selectedTracker) return;

    updateActualDataPoint(selectedTracker.config.id, date, amount);

    // Refresh data
    const updated = getAllTrackers();
    setTrackers(updated);
    const refreshed = updated.find(inv => inv.config.id === selectedTracker.config.id);
    if (refreshed) {
      setSelectedTracker(refreshed);
    }
  };

  const handleDeleteActual = (date: string) => {
    if (!selectedTracker) return;

    deleteActualDataPoint(selectedTracker.config.id, date);

    // Refresh data
    const updated = getAllTrackers();
    setTrackers(updated);
    const refreshed = updated.find(inv => inv.config.id === selectedTracker.config.id);
    if (refreshed) {
      setSelectedTracker(refreshed);
    }
  };

  const handleAddCashFlow = (cashFlow: Omit<CashFlow, 'id'>) => {
    if (!selectedTracker) return;

    addCashFlow(selectedTracker.config.id, cashFlow);

    // Refresh data
    const updated = getAllTrackers();
    setTrackers(updated);
    const refreshed = updated.find(inv => inv.config.id === selectedTracker.config.id);
    if (refreshed) {
      setSelectedTracker(refreshed);
    }
  };

  const handleDeleteCashFlow = (cashFlowId: string) => {
    if (!selectedTracker) return;

    deleteCashFlow(selectedTracker.config.id, cashFlowId);

    // Refresh data
    const updated = getAllTrackers();
    setTrackers(updated);
    const refreshed = updated.find(inv => inv.config.id === selectedTracker.config.id);
    if (refreshed) {
      setSelectedTracker(refreshed);
    }
  };

  const handleConfigUpdate = useCallback((trackerId: string, config: TrackerConfig) => {
    // Update the config using storage API
    updateTrackerConfig(trackerId, config);

    // Regenerate scheduled cash flows based on new config
    regenerateScheduledCashFlows(trackerId);

    // Refresh UI
    const updated = getAllTrackers();
    setTrackers(updated);
    const refreshed = updated.find(inv => inv.config.id === trackerId);
    if (refreshed && selectedTracker?.config.id === trackerId) {
      setSelectedTracker(refreshed);
      // DateRangeSelector will handle resetting its view based on config changes
    }
    showSuccess(`Tracker "${config.name}" updated successfully`, ToastDuration.Short);
  }, [selectedTracker, showSuccess]);

  const handleDeleteTracker = (id: string) => {
    if (confirm('Are you sure you want to delete this trade tracker?')) {
      const trackerToDelete = trackers.find(t => t.config.id === id);
      deleteTracker(id);
      const updated = getAllTrackers();
      setTrackers(updated);

      if (selectedTracker?.config.id === id) {
        setSelectedTracker(updated.length > 0 ? updated[0] : null);
      }

      showSuccess(`Tracker "${trackerToDelete?.config.name}" deleted successfully`, ToastDuration.Short);
    }
  };


  const handlePortfolioUpdate = useCallback((summary: any) => {
    console.log('Portfolio update received:', summary);

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString();

    // Check if portfolio tracker exists
    const existing = getAllTrackers().find(inv => inv.config.id === 'ibkr-portfolio');

    if (!existing) {
      // Create new portfolio tracker with default settings
      const portfolioConfig: TrackerConfig = {
        id: 'ibkr-portfolio',
        name: '💼 IBKR Total Portfolio',
        startingAmount: summary.netLiquidation,
        projections: [],
        startDate: today,
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        ibkrSynced: true,
        lastSyncTimestamp: summary.timestamp,
      };

      createTracker(portfolioConfig);
      console.log(`[${now}] Created portfolio tracker with value: $${summary.netLiquidation.toLocaleString()}`);
    } else {
      console.log(`[${now}] Updating portfolio tracker - Current value: $${summary.netLiquidation.toLocaleString()}`);

      // Only update the sync timestamp, keep user's configured starting amount
      updateTrackerConfig('ibkr-portfolio', {
        lastSyncTimestamp: summary.timestamp,
      });
    }

    // Always update/create today's actual data point with current value
    // This ensures the chart always shows the latest data
    updateActualDataPoint('ibkr-portfolio', today, summary.netLiquidation);
    console.log(`[${now}] Updated actual data for ${today}: $${summary.netLiquidation.toLocaleString()}`);

    // Refresh trackers list
    const updated = getAllTrackers();
    setTrackers(updated);

    // Find the portfolio tracker
    const portfolio = updated.find(inv => inv.config.id === 'ibkr-portfolio');
    if (portfolio) {
      // Log the actual data points for verification
      const todayData = portfolio.actualData.find(d => d.date === today);
      console.log(`[${now}] Portfolio tracker data for today:`, todayData);

      // Use ref to get current selection to avoid stale closure
      const currentlySelected = selectedTrackerRef.current;

      // Only auto-select portfolio if no tracker is currently selected
      if (!currentlySelected) {
        setSelectedTracker(portfolio);
      } else if (currentlySelected.config.id === 'ibkr-portfolio') {
        // If IBKR tracker is already selected, update it with fresh data
        setSelectedTracker(portfolio);
      }
      // Otherwise, don't switch - just update data in background
    } else {
      console.error('Portfolio tracker not found after update');
    }
  }, []); // No dependencies - use ref instead


  return (
    <div className="app">
      <header className="app-header">
        <h1>IBKR Trade Tracing</h1>
        <div className="header-nav">
          <button
            className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-link ${currentView === 'analytics' ? 'active' : ''}`}
            onClick={() => setCurrentView('analytics')}
          >
            Analytics
          </button>
        </div>
        <IBKRConnection
          onPortfolioUpdate={handlePortfolioUpdate}
        />
      </header>

      <TrackerSidebar
        trackers={trackers}
        selectedTracker={selectedTracker}
        onSelectTracker={setSelectedTracker}
        onCreateTracker={handleCreateTracker}
        onDeleteTracker={handleDeleteTracker}
        onConfigUpdate={handleConfigUpdate}
      />

      <div className="app-content">
        {trackers.length === 0 ? (
          <div className="empty-state">
            <h2>No Trade Trackers Yet</h2>
            <p>Click the menu button in the top left to create your first tracker</p>
          </div>
        ) : (
          <div className="main-content">
              {currentView === 'dashboard' ? (
                <div className="dashboard-view">
                  {selectedTracker ? (
                    <>
                      <SummaryStats tracker={selectedTracker} />
                      <DateRangeSelector
                        config={selectedTracker.config}
                        onChange={setDateRange}
                      >
                        {({ topControls, bottomControls }) => (
                          <div className="chart-wrapper">
                            {topControls}
                            <ProgressChart
                              tracker={selectedTracker}
                              dateRange={dateRange || undefined}
                            />
                            {bottomControls}
                          </div>
                        )}
                      </DateRangeSelector>
                      <CashFlowManager
                        tracker={selectedTracker}
                        onAdd={handleAddCashFlow}
                        onDelete={handleDeleteCashFlow}
                      />
                      {selectedTracker.config.id !== 'ibkr-portfolio' && (
                        <ActualAmountUpdater
                          tracker={selectedTracker}
                          onUpdate={handleUpdateActual}
                          onDelete={handleDeleteActual}
                        />
                      )}
                    </>
                  ) : (
                    <div className="empty-state">
                      <p>Select a tracker from the menu</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {selectedTracker ? (
                    <PerformanceAnalytics
                      tracker={selectedTracker}
                      dateRange={dateRange || undefined}
                    />
                  ) : (
                    <div className="empty-state">
                      <p>Select a tracker to view analytics</p>
                    </div>
                  )}
                </>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
