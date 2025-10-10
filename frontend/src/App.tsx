import { useState, useEffect, useCallback } from 'react';
import { ProgressChart } from './components/ProgressChart';
import { ActualAmountUpdater } from './components/ActualAmountUpdater';
import { CashFlowManager } from './components/CashFlowManager';
import { SummaryStats } from './components/SummaryStats';
import { DateRangeSelector } from './components/DateRangeSelector';
import { IBKRConnection } from './components/IBKRConnection';
import { TrackerSidebar } from './components/TrackerSidebar';
import type { Investment, InvestmentConfig, DateRange, CashFlow } from './types/investment';
import {
  getAllInvestments,
  createInvestment,
  updateActualDataPoint,
  deleteActualDataPoint,
  updateInvestmentConfig,
  deleteInvestment,
  addCashFlow,
  deleteCashFlow,
} from './api/storage';
import './App.css';

function App() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Load investments from localStorage on mount
  useEffect(() => {
    const stored = getAllInvestments();
    setInvestments(stored);

    // Find portfolio tracker
    const portfolio = stored.find(inv => inv.config.id === 'ibkr-portfolio');
    if (portfolio) {
      setSelectedInvestment(portfolio);
    } else if (stored.length > 0) {
      setSelectedInvestment(stored[0]);
    }
  }, []);

  const handleCreateInvestment = (config: InvestmentConfig) => {
    const newInvestment = createInvestment(config);
    const updated = getAllInvestments();
    setInvestments(updated);
    setSelectedInvestment(newInvestment);
  };

  const handleUpdateActual = (date: string, amount: number) => {
    if (!selectedInvestment) return;

    updateActualDataPoint(selectedInvestment.config.id, date, amount);

    // Refresh data
    const updated = getAllInvestments();
    setInvestments(updated);
    const refreshed = updated.find(inv => inv.config.id === selectedInvestment.config.id);
    if (refreshed) {
      setSelectedInvestment(refreshed);
    }
  };

  const handleDeleteActual = (date: string) => {
    if (!selectedInvestment) return;

    deleteActualDataPoint(selectedInvestment.config.id, date);

    // Refresh data
    const updated = getAllInvestments();
    setInvestments(updated);
    const refreshed = updated.find(inv => inv.config.id === selectedInvestment.config.id);
    if (refreshed) {
      setSelectedInvestment(refreshed);
    }
  };

  const handleAddCashFlow = (cashFlow: Omit<CashFlow, 'id'>) => {
    if (!selectedInvestment) return;

    addCashFlow(selectedInvestment.config.id, cashFlow);

    // Refresh data
    const updated = getAllInvestments();
    setInvestments(updated);
    const refreshed = updated.find(inv => inv.config.id === selectedInvestment.config.id);
    if (refreshed) {
      setSelectedInvestment(refreshed);
    }
  };

  const handleDeleteCashFlow = (cashFlowId: string) => {
    if (!selectedInvestment) return;

    deleteCashFlow(selectedInvestment.config.id, cashFlowId);

    // Refresh data
    const updated = getAllInvestments();
    setInvestments(updated);
    const refreshed = updated.find(inv => inv.config.id === selectedInvestment.config.id);
    if (refreshed) {
      setSelectedInvestment(refreshed);
    }
  };

  const handleConfigUpdate = useCallback((investmentId: string, name: string, startingAmount: number, projectedIncreasePercent: number, intervalDays: number, startDate: string, endDate: string) => {
    // Update the config using storage API
    updateInvestmentConfig(investmentId, {
      name,
      startingAmount,
      projectedIncreasePercent,
      intervalDays,
      startDate,
      endDate,
    });

    // Refresh UI and reset date range
    const updated = getAllInvestments();
    setInvestments(updated);
    const refreshed = updated.find(inv => inv.config.id === investmentId);
    if (refreshed && selectedInvestment?.config.id === investmentId) {
      setSelectedInvestment(refreshed);
      // Reset date range so DateRangeSelector recalculates
      setDateRange(null);
    }
  }, [selectedInvestment]);

  const handleDeleteInvestment = (id: string) => {
    if (confirm('Are you sure you want to delete this investment tracker?')) {
      deleteInvestment(id);
      const updated = getAllInvestments();
      setInvestments(updated);

      if (selectedInvestment?.config.id === id) {
        setSelectedInvestment(updated.length > 0 ? updated[0] : null);
      }
    }
  };


  const handlePortfolioUpdate = useCallback((summary: any) => {
    console.log('Portfolio update received:', summary);

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString();

    // Check if portfolio tracker exists
    const existing = getAllInvestments().find(inv => inv.config.id === 'ibkr-portfolio');

    if (!existing) {
      // Create new portfolio tracker with default settings
      const portfolioConfig: InvestmentConfig = {
        id: 'ibkr-portfolio',
        name: '💼 IBKR Total Portfolio',
        startingAmount: summary.netLiquidation,
        projectedIncreasePercent: 0.5, // Default 0.5% growth
        intervalDays: 30,
        startDate: today,
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        ibkrSynced: true,
        lastSyncTimestamp: summary.timestamp,
      };

      createInvestment(portfolioConfig);
      console.log(`[${now}] Created portfolio tracker with value: $${summary.netLiquidation.toLocaleString()}`);
    } else {
      console.log(`[${now}] Updating portfolio tracker - Current value: $${summary.netLiquidation.toLocaleString()}`);

      // Only update the sync timestamp, keep user's configured starting amount
      updateInvestmentConfig('ibkr-portfolio', {
        lastSyncTimestamp: summary.timestamp,
      });
    }

    // Always update/create today's actual data point with current value
    // This ensures the chart always shows the latest data
    updateActualDataPoint('ibkr-portfolio', today, summary.netLiquidation);
    console.log(`[${now}] Updated actual data for ${today}: $${summary.netLiquidation.toLocaleString()}`);

    // Refresh investments list
    const updated = getAllInvestments();
    setInvestments(updated);

    // Find the portfolio tracker
    const portfolio = updated.find(inv => inv.config.id === 'ibkr-portfolio');
    if (portfolio) {
      // Log the actual data points for verification
      const todayData = portfolio.actualData.find(d => d.date === today);
      console.log(`[${now}] Portfolio tracker data for today:`, todayData);

      // Auto-select if no selection or if portfolio was already selected
      if (!selectedInvestment || selectedInvestment.config.id === 'ibkr-portfolio') {
        setSelectedInvestment(portfolio);
      }
    } else {
      console.error('Portfolio tracker not found after update');
    }
  }, [selectedInvestment]);


  return (
    <div className="app">
      <header className="app-header">
        <h1>IBKR Investment Tracing</h1>
        <IBKRConnection
          onPortfolioUpdate={handlePortfolioUpdate}
        />
      </header>

      <TrackerSidebar
        investments={investments}
        selectedInvestment={selectedInvestment}
        onSelectInvestment={setSelectedInvestment}
        onCreateInvestment={handleCreateInvestment}
        onDeleteInvestment={handleDeleteInvestment}
        onConfigUpdate={handleConfigUpdate}
      />

      <div className="app-content">
        {investments.length === 0 ? (
          <div className="empty-state">
            <h2>No Investment Trackers Yet</h2>
            <p>Click the menu button in the top left to create your first tracker</p>
          </div>
        ) : (
          <div className="main-content">
              {selectedInvestment ? (
                <>
                  <SummaryStats investment={selectedInvestment} />
                  <ProgressChart
                    investment={selectedInvestment}
                    dateRange={dateRange || undefined}
                  />
                  <DateRangeSelector
                    config={selectedInvestment.config}
                    onChange={setDateRange}
                  />
                  <CashFlowManager
                    investment={selectedInvestment}
                    onAdd={handleAddCashFlow}
                    onDelete={handleDeleteCashFlow}
                  />
                  {selectedInvestment.config.id !== 'ibkr-portfolio' && (
                    <ActualAmountUpdater
                      investment={selectedInvestment}
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
        )}
      </div>
    </div>
  );
}

export default App;
