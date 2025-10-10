import { useState } from 'react';
import { InvestmentForm } from './InvestmentForm';
import { InvestmentConfigEditor } from './InvestmentConfigEditor';
import type { Investment, InvestmentConfig } from '../types/investment';
import './TrackerSidebar.css';

interface TrackerSidebarProps {
  investments: Investment[];
  selectedInvestment: Investment | null;
  onSelectInvestment: (investment: Investment) => void;
  onCreateInvestment: (config: InvestmentConfig) => void;
  onDeleteInvestment: (id: string) => void;
  onConfigUpdate: (investmentId: string, name: string, startingAmount: number, projectedIncreasePercent: number, intervalDays: number, startDate: string, endDate: string) => void;
}

export function TrackerSidebar({
  investments,
  selectedInvestment,
  onSelectInvestment,
  onCreateInvestment,
  onDeleteInvestment,
  onConfigUpdate,
}: TrackerSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [configuringId, setConfiguringId] = useState<string | null>(null);

  const handleCreateInvestment = (config: InvestmentConfig) => {
    onCreateInvestment(config);
    setShowForm(false);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className="sidebar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle trackers"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <div className={`tracker-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>Your Trackers</h3>
          <div className="header-actions">
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-secondary"
              title={showForm ? 'Cancel' : 'Add new tracker'}
            >
              {showForm ? '✕' : '+'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="form-container">
            <InvestmentForm onSubmit={handleCreateInvestment} />
          </div>
        )}

        <div className="investment-list">
          {investments
            .sort((a, b) => {
              // Portfolio tracker always first
              if (a.config.id === 'ibkr-portfolio') return -1;
              if (b.config.id === 'ibkr-portfolio') return 1;
              // Then by creation date
              return new Date(b.config.createdAt).getTime() - new Date(a.config.createdAt).getTime();
            })
            .map((investment) => (
              <div
                key={investment.config.id}
                className={`investment-item ${
                  selectedInvestment?.config.id === investment.config.id ? 'active' : ''
                } ${investment.config.id === 'ibkr-portfolio' ? 'portfolio-tracker' : ''}`}
              >
                <div>
                  <div
                    className="investment-info"
                    onClick={() => {
                      onSelectInvestment(investment);
                      setIsOpen(false);
                    }}
                  >
                    <div className="investment-name">
                      {investment.config.name}
                      {investment.config.ibkrSynced && (
                        <span className="ibkr-badge" title="Synced with IBKR">IBKR</span>
                      )}
                    </div>
                    <div className="investment-meta">
                      {investment.config.projectedIncreasePercent}% every{' '}
                      {investment.config.intervalDays} days
                    </div>
                  </div>
                  <div className="investment-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfiguringId(configuringId === investment.config.id ? null : investment.config.id);
                      }}
                      className="btn-icon"
                      title="Configure tracker"
                    >
                      ⚙️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteInvestment(investment.config.id);
                      }}
                      className="btn-icon"
                      title="Delete tracker"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                {configuringId === investment.config.id && (
                  <InvestmentConfigEditor
                    currentConfig={{
                      name: investment.config.name,
                      startingAmount: investment.config.startingAmount,
                      projectedIncreasePercent: investment.config.projectedIncreasePercent,
                      intervalDays: investment.config.intervalDays,
                      startDate: investment.config.startDate,
                      endDate: investment.config.endDate,
                    }}
                    onSave={(name, startingAmount, projectedIncreasePercent, intervalDays, startDate, endDate) => {
                      onConfigUpdate(investment.config.id, name, startingAmount, projectedIncreasePercent, intervalDays, startDate, endDate);
                      setConfiguringId(null);
                    }}
                    onCancel={() => setConfiguringId(null)}
                    isOpen={true}
                  />
                )}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
