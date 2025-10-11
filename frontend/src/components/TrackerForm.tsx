import { useState } from 'react';
import { format, addYears } from 'date-fns';
import type { TrackerConfig } from '../types/trackers';
import './TrackerForm.css';

interface TrackerFormProps {
  onSubmit: (config: TrackerConfig) => void;
}

export function TrackerForm({ onSubmit }: TrackerFormProps) {
  const today = new Date();
  const oneYearLater = addYears(today, 1);

  const [name, setName] = useState('');
  const [startingAmount, setStartingAmount] = useState('');
  const [projectedIncreasePercent, setProjectedIncreasePercent] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(oneYearLater, 'yyyy-MM-dd'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that end date is after start date
    if (new Date(endDate) <= new Date(startDate)) {
      alert('End date must be after start date');
      return;
    }

    const config: TrackerConfig = {
      id: crypto.randomUUID(),
      name: name || 'Trade Tracker',
      startingAmount: parseFloat(startingAmount),
      projectedIncreasePercent: parseFloat(projectedIncreasePercent),
      intervalDays: parseInt(intervalDays, 10),
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
    };

    onSubmit(config);

    // Reset form
    const newToday = new Date();
    const newOneYearLater = addYears(newToday, 1);
    setName('');
    setStartingAmount('');
    setProjectedIncreasePercent('');
    setIntervalDays('');
    setStartDate(format(newToday, 'yyyy-MM-dd'));
    setEndDate(format(newOneYearLater, 'yyyy-MM-dd'));
  };

  return (
    <form onSubmit={handleSubmit} className="tracker-form">
      <h2>Create Trade Tracker</h2>

      <div className="form-group">
        <label htmlFor="name">Name (optional)</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Trade"
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
          required
        />
      </div>

      <button type="submit" className="btn-primary">
        Create Tracker
      </button>
    </form>
  );
}
