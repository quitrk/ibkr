import { useState } from 'react';
import './TrackerConfigEditor.css';

interface TrackerConfigEditorProps {
  currentConfig?: {
    name: string;
    startingAmount: number;
    projectedIncreasePercent: number;
    intervalDays: number;
    startDate: string;
    endDate: string;
  };
  onSave: (name: string, startingAmount: number, projectedIncreasePercent: number, intervalDays: number, startDate: string, endDate: string) => void;
  onCancel?: () => void;
  isOpen?: boolean;
}

export function TrackerConfigEditor({ currentConfig, onSave, onCancel, isOpen = false }: TrackerConfigEditorProps) {
  const [name, setName] = useState(currentConfig?.name || '');
  const [startingAmount, setStartingAmount] = useState(
    currentConfig?.startingAmount.toString() || ''
  );
  const [projectedIncrease, setProjectedIncrease] = useState(
    currentConfig?.projectedIncreasePercent.toString() || '0.5'
  );
  const [interval, setInterval] = useState(
    currentConfig?.intervalDays.toString() || '30'
  );
  const [startDate, setStartDate] = useState(
    currentConfig?.startDate || new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    currentConfig?.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const handleSave = () => {
    const amount = parseFloat(startingAmount);
    const increase = parseFloat(projectedIncrease);
    const days = parseInt(interval, 10);

    if (!name || name.trim() === '') {
      alert('Please enter a name');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid starting amount');
      return;
    }

    if (isNaN(increase) || isNaN(days) || days < 1) {
      alert('Please enter valid values');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      alert('End date must be after start date');
      return;
    }

    onSave(name, amount, increase, days, startDate, endDate);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tracker-config-editor">
      <div className="config-panel">
        <h4>Tracker Settings</h4>
        <p className="config-help">
          Edit all tracker settings including name, starting amount, dates, and projections.
        </p>

          <div className="config-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Tracker"
              />
            </div>

            <div className="form-group">
              <label htmlFor="startingAmount">Starting Amount ($)</label>
              <input
                type="number"
                id="startingAmount"
                value={startingAmount}
                onChange={(e) => setStartingAmount(e.target.value)}
                step="0.01"
                placeholder="10000"
              />
            </div>

            <div className="form-group">
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <small>Beginning of tracking period</small>
            </div>

            <div className="form-group">
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
              <small>End of tracking period</small>
            </div>

            <div className="form-group">
              <label htmlFor="projectedIncrease">Projected Increase (%)</label>
              <input
                type="number"
                id="projectedIncrease"
                value={projectedIncrease}
                onChange={(e) => setProjectedIncrease(e.target.value)}
                step="0.1"
                placeholder="0.5"
              />
              <small>Expected percentage increase per interval</small>
            </div>

            <div className="form-group">
              <label htmlFor="interval">Interval (days)</label>
              <input
                type="number"
                id="interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                min="1"
                placeholder="30"
              />
              <small>How often the projected increase compounds</small>
            </div>

            <div className="config-actions">
              <button onClick={handleSave} className="btn-primary">
                Save Settings
              </button>
              <button
                onClick={handleCancel}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}
