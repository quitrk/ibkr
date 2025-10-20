import { useState, useEffect } from 'react';
import { format, addYears } from 'date-fns';
import type { Tracker, TrackerConfig, DepositSchedule, ProjectionConfig, InstrumentConfig } from '../types/trackers';
import { ProjectionsList } from './ProjectionsList';
import { InstrumentsList } from './InstrumentsList';
import { Dialog } from './Dialog';

interface TrackerEditDialogProps {
  isOpen: boolean;
  tracker?: Tracker | null; // Optional for create mode
  onSave: (config: TrackerConfig) => void;
  onCancel: () => void;
}

export function TrackerEditDialog({
  isOpen,
  tracker,
  onSave,
  onCancel,
}: TrackerEditDialogProps) {
  const isEditMode = !!tracker;

  // Initialize form state
  const today = new Date();
  const oneYearLater = addYears(today, 1);

  const [name, setName] = useState('');
  const [startingAmount, setStartingAmount] = useState('');
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(oneYearLater, 'yyyy-MM-dd'));
  const [projections, setProjections] = useState<ProjectionConfig[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [scheduleAmount, setScheduleAmount] = useState('');
  const [instruments, setInstruments] = useState<InstrumentConfig[]>([]);

  // Reset form when dialog opens or tracker changes
  useEffect(() => {
    if (isOpen) {
      if (tracker) {
        // Edit mode - populate with existing tracker data
        setName(tracker.config.name || '');
        setStartingAmount(tracker.config.startingAmount.toString());
        setStartDate(tracker.config.startDate);
        setEndDate(tracker.config.endDate);
        setProjections(tracker.config.projections || []);
        setScheduleEnabled(tracker.config.depositSchedule?.enabled || false);
        setScheduleFrequency(tracker.config.depositSchedule?.frequency || 'monthly');
        setScheduleAmount(tracker.config.depositSchedule?.amount?.toString() || '');
        setInstruments(tracker.config.instruments || []);
      } else {
        // Create mode - reset to defaults
        const newToday = new Date();
        const newOneYearLater = addYears(newToday, 1);
        setName('');
        setStartingAmount('');
        setStartDate(format(newToday, 'yyyy-MM-dd'));
        setEndDate(format(newOneYearLater, 'yyyy-MM-dd'));
        setProjections([]);
        setScheduleEnabled(false);
        setScheduleFrequency('monthly');
        setScheduleAmount('');
        setInstruments([]);
      }
    }
  }, [isOpen, tracker]);

  const handleSave = () => {
    // Validate name
    const trackerName = name.trim() || (isEditMode ? '' : 'My Trade');
    if (isEditMode && !trackerName) {
      alert('Please enter a name');
      return;
    }

    // Validate amounts
    const amount = parseFloat(startingAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid starting amount');
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
          ...tracker.config,
          name: trackerName,
          startingAmount: amount,
          projections,
          startDate,
          endDate,
          depositSchedule,
          instruments: instruments.length > 0 ? instruments : undefined,
        }
      : {
          id: crypto.randomUUID(),
          name: trackerName,
          startingAmount: amount,
          projections,
          startDate,
          endDate,
          createdAt: new Date().toISOString(),
          depositSchedule,
          instruments: instruments.length > 0 ? instruments : undefined,
        };

    onSave(config);
  };

  return (
    <Dialog
      isOpen={isOpen}
      title={isEditMode ? 'Tracker Settings' : 'Create Trade Tracker'}
      onCancel={onCancel}
      maxWidth="large"
      actions={
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary"
        >
          {isEditMode ? 'Save Settings' : 'Create Tracker'}
        </button>
      }
    >
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
        <label htmlFor="startingAmount">
          Starting Amount ($) *
          <small className="form-hint">Initial investment amount</small>
        </label>
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

      <ProjectionsList
        projections={projections}
        onChange={setProjections}
      />

      <InstrumentsList
        instruments={instruments}
        onChange={setInstruments}
      />

      <div className="form-section-title">Scheduled Deposits</div>
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
              setScheduleEnabled(e.target.value !== '' && parseFloat(e.target.value) > 0);
            }}
            placeholder="0"
            step="0.01"
            min="0"
          />
        </div>
      </div>
    </Dialog>
  );
}
