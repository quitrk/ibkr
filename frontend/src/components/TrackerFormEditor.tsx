import { useState } from 'react';
import { format, addYears } from 'date-fns';
import type { Tracker, TrackerConfig, DepositSchedule } from '../types/trackers';
import './TrackerFormEditor.css';

interface TrackerFormEditorProps {
  existingTracker?: Tracker; // If provided, edit mode; otherwise create mode
  onSave: (config: TrackerConfig) => void;
  onCancel?: () => void;
  isOpen?: boolean; // For inline display in edit mode
}

export function TrackerFormEditor({
  existingTracker,
  onSave,
  onCancel,
  isOpen = true
}: TrackerFormEditorProps) {
  const isEditMode = !!existingTracker;

  // Initialize form state from existing tracker or defaults
  const today = new Date();
  const oneYearLater = addYears(today, 1);

  const [name, setName] = useState(existingTracker?.config.name || '');
  const [startingAmount, setStartingAmount] = useState(
    existingTracker?.config.startingAmount.toString() || ''
  );
  const [projectedIncreasePercent, setProjectedIncreasePercent] = useState(
    existingTracker?.config.projectedIncreasePercent.toString() || ''
  );
  const [intervalDays, setIntervalDays] = useState(
    existingTracker?.config.intervalDays.toString() || ''
  );
  const [startDate, setStartDate] = useState(
    existingTracker?.config.startDate || format(today, 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    existingTracker?.config.endDate || format(oneYearLater, 'yyyy-MM-dd')
  );

  // Deposit schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(
    existingTracker?.config.depositSchedule?.enabled || false
  );
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>(
    existingTracker?.config.depositSchedule?.frequency || 'monthly'
  );
  const [scheduleAmount, setScheduleAmount] = useState(
    existingTracker?.config.depositSchedule?.amount?.toString() || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name
    if (!name || name.trim() === '') {
      alert('Please enter a name');
      return;
    }

    // Validate amounts
    const amount = parseFloat(startingAmount);
    const increase = parseFloat(projectedIncreasePercent);
    const days = parseInt(intervalDays, 10);

    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid starting amount');
      return;
    }

    if (isNaN(increase) || isNaN(days) || days < 1) {
      alert('Please enter valid values');
      return;
    }

    // Validate dates
    if (new Date(endDate) <= new Date(startDate)) {
      alert('End date must be after start date');
      return;
    }

    // Validate deposit schedule amount if provided
    const schedAmount = parseFloat(scheduleAmount);
    if (scheduleAmount && (isNaN(schedAmount) || schedAmount < 0)) {
      alert('Please enter a valid deposit amount');
      return;
    }

    const depositSchedule: DepositSchedule | undefined = scheduleEnabled
      ? {
          enabled: true,
          frequency: scheduleFrequency,
          amount: parseFloat(scheduleAmount),
        }
      : undefined;

    const config: TrackerConfig = isEditMode
      ? {
          ...existingTracker.config,
          name,
          startingAmount: amount,
          projectedIncreasePercent: increase,
          intervalDays: days,
          startDate,
          endDate,
          depositSchedule,
        }
      : {
          id: crypto.randomUUID(),
          name,
          startingAmount: amount,
          projectedIncreasePercent: increase,
          intervalDays: days,
          startDate,
          endDate,
          createdAt: new Date().toISOString(),
          depositSchedule,
        };

    onSave(config);

    // Reset form only in create mode
    if (!isEditMode) {
      const newToday = new Date();
      const newOneYearLater = addYears(newToday, 1);
      setName('');
      setStartingAmount('');
      setProjectedIncreasePercent('');
      setIntervalDays('');
      setStartDate(format(newToday, 'yyyy-MM-dd'));
      setEndDate(format(newOneYearLater, 'yyyy-MM-dd'));
      setScheduleEnabled(false);
      setScheduleFrequency('monthly');
      setScheduleAmount('');
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Don't render if edit mode and not open
  if (isEditMode && !isOpen) return null;

  const FormContent = (
    <>
      <h2>{isEditMode ? 'Tracker Settings' : 'Create Trade Tracker'}</h2>
      {isEditMode && (
        <p className="config-help">
          Edit all tracker settings including name, starting amount, dates, and projections.
        </p>
      )}

      <div className="form-group">
        <label htmlFor="name">Name {!isEditMode && '(optional)'}</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isEditMode ? 'My Tracker' : 'My Trade'}
          required={isEditMode}
        />
      </div>

      <div className="form-group">
        <label htmlFor="startingAmount">Starting Amount ($) *</label>
        <input
          type="number"
          id="startingAmount"
          value={startingAmount}
          onChange={(e) => setStartingAmount(e.target.value)}
          placeholder="10000"
          step="0.01"
          required
        />
      </div>
      {isEditMode && <small className="form-hint">Initial investment amount</small>}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="startDate">Start Date *</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="endDate">End Date *</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="projectedIncreasePercent">Projected Increase (%) *</label>
          <input
            type="number"
            id="projectedIncreasePercent"
            value={projectedIncreasePercent}
            onChange={(e) => setProjectedIncreasePercent(e.target.value)}
            placeholder="1"
            step="0.01"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="intervalDays">Interval (days) *</label>
          <input
            type="number"
            id="intervalDays"
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)}
            placeholder="5"
            min="1"
            required
          />
        </div>
      </div>
      <small className="form-hint">Expected percentage increase per interval and how often it compounds</small>

      <div className="form-section-title">Scheduled Deposits (optional)</div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="scheduleFrequency">Frequency</label>
          <select
            id="scheduleFrequency"
            value={scheduleFrequency}
            onChange={(e) => setScheduleFrequency(e.target.value as 'daily' | 'weekly' | 'biweekly' | 'monthly')}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="scheduleAmount">Amount ($)</label>
          <input
            type="number"
            id="scheduleAmount"
            value={scheduleAmount}
            onChange={(e) => {
              setScheduleAmount(e.target.value);
              // Auto-enable if amount is entered
              setScheduleEnabled(e.target.value !== '' && parseFloat(e.target.value) > 0);
            }}
            placeholder="0"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      <div className={isEditMode ? 'config-actions' : 'form-actions'}>
        <button type="submit" className="btn-primary">
          {isEditMode ? 'Save Settings' : 'Create Tracker'}
        </button>
        {isEditMode && onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
        )}
      </div>
    </>
  );

  return isEditMode ? (
    <div className="tracker-config-editor">
      <div className="config-panel">
        <div className="config-form">
          <form onSubmit={handleSubmit}>
            {FormContent}
          </form>
        </div>
      </div>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="tracker-form">
      {FormContent}
    </form>
  );
}
