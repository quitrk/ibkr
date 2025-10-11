import { useState } from 'react';
import { TrackerForm } from './TrackerForm';
import { TrackerConfigEditor } from './TrackerConfigEditor';
import type { Tracker, TrackerConfig } from '../types/trackers';
import './TrackerSidebar.css';

interface TrackerSidebarProps {
  trackers: Tracker[];
  selectedTracker: Tracker | null;
  onSelectTracker: (tracker: Tracker) => void;
  onCreateTracker: (config: TrackerConfig) => void;
  onDeleteTracker: (id: string) => void;
  onConfigUpdate: (trackerId: string, name: string, startingAmount: number, projectedIncreasePercent: number, intervalDays: number, startDate: string, endDate: string) => void;
}

export function TrackerSidebar({
  trackers,
  selectedTracker,
  onSelectTracker,
  onCreateTracker,
  onDeleteTracker,
  onConfigUpdate,
}: TrackerSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [configuringId, setConfiguringId] = useState<string | null>(null);

  const handleCreateTracker = (config: TrackerConfig) => {
    onCreateTracker(config);
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
            <TrackerForm onSubmit={handleCreateTracker} />
          </div>
        )}

        <div className="tracker-list">
          {trackers
            .sort((a, b) => {
              // Portfolio tracker always first
              if (a.config.id === 'ibkr-portfolio') return -1;
              if (b.config.id === 'ibkr-portfolio') return 1;
              // Then by creation date
              return new Date(b.config.createdAt).getTime() - new Date(a.config.createdAt).getTime();
            })
            .map((tracker) => (
              <div
                key={tracker.config.id}
                className={`tracker-item ${
                  selectedTracker?.config.id === tracker.config.id ? 'active' : ''
                } ${tracker.config.id === 'ibkr-portfolio' ? 'portfolio-tracker' : ''}`}
              >
                <div>
                  <div
                    className="tracker-info"
                    onClick={() => {
                      onSelectTracker(tracker);
                      setIsOpen(false);
                    }}
                  >
                    <div className="tracker-name">
                      {tracker.config.name}
                      {tracker.config.ibkrSynced && (
                        <span className="ibkr-badge" title="Synced with IBKR">IBKR</span>
                      )}
                    </div>
                    <div className="tracker-meta">
                      {tracker.config.projectedIncreasePercent}% every{' '}
                      {tracker.config.intervalDays} days
                    </div>
                  </div>
                  <div className="tracker-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfiguringId(configuringId === tracker.config.id ? null : tracker.config.id);
                      }}
                      className="btn-icon"
                      title="Configure tracker"
                    >
                      ⚙️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTracker(tracker.config.id);
                      }}
                      className="btn-icon"
                      title="Delete tracker"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                {configuringId === tracker.config.id && (
                  <TrackerConfigEditor
                    currentConfig={{
                      name: tracker.config.name,
                      startingAmount: tracker.config.startingAmount,
                      projectedIncreasePercent: tracker.config.projectedIncreasePercent,
                      intervalDays: tracker.config.intervalDays,
                      startDate: tracker.config.startDate,
                      endDate: tracker.config.endDate,
                    }}
                    onSave={(name, startingAmount, projectedIncreasePercent, intervalDays, startDate, endDate) => {
                      onConfigUpdate(tracker.config.id, name, startingAmount, projectedIncreasePercent, intervalDays, startDate, endDate);
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
