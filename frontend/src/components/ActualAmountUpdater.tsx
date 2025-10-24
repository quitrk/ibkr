import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import type { Tracker } from '../types/trackers';
import { getLatestActualValue, formatCurrency } from '../utils/calculations';
import { useToast } from '../contexts/ToastContext';
import { ToastDuration } from './Toast';
import './ActualAmountUpdater.css';

interface ActualAmountUpdaterProps {
  tracker: Tracker;
  onUpdate: (date: string, amount: number) => void;
  onDelete: (date: string) => void;
}

export function ActualAmountUpdater({ tracker, onUpdate, onDelete }: ActualAmountUpdaterProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { showError, showSuccess } = useToast();

  // Get latest actual amount or use starting amount as default
  const getDefaultAmount = () => {
    const latestActual = getLatestActualValue(tracker.actualData);
    return latestActual ? latestActual.amount : tracker.config.startingAmount;
  };

  const [amount, setAmount] = useState(getDefaultAmount().toString());

  // Update amount when tracker changes
  useEffect(() => {
    setAmount(getDefaultAmount().toString());
  }, [tracker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      showError('Please enter a valid amount', ToastDuration.Short);
      return;
    }

    onUpdate(date, parseFloat(amount));
    showSuccess('Actual amount updated successfully', ToastDuration.Short);
    // Keep the amount so user can easily make small adjustments
  };

  const handleDelete = (dateToDelete: string) => {
    // For now, we'll keep the confirm dialog as it's a destructive action
    // In a future improvement, we could replace this with a custom confirmation modal
    if (confirm(`Are you sure you want to delete the entry from ${format(parseISO(dateToDelete), 'MMM dd, yyyy')}?`)) {
      onDelete(dateToDelete);
      showSuccess('Entry deleted successfully', ToastDuration.Short);
    }
  };

  return (
    <div className="actual-amount-updater">
      <h3>Actual Amounts</h3>

      {tracker.actualData.length > 0 && (
        <div className="actual-entries-list">
          <h4>Recorded Entries</h4>
          <div className="entries">
            {tracker.actualData.slice().reverse().map((entry) => (
              <div key={entry.date} className="entry-item">
                <div className="entry-info">
                  <span className="entry-date">{format(parseISO(entry.date), 'MMM dd, yyyy')}</span>
                  <span className="entry-amount">{formatCurrency(entry.amount)}</span>
                </div>
                <button
                  onClick={() => handleDelete(entry.date)}
                  className="btn-delete-entry"
                  title="Delete entry"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="update-form">
        <h4>Add/Update Entry</h4>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="update-date">Date</label>
            <input
              type="date"
              id="update-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="update-amount">Amount ($)</label>
            <input
              type="number"
              id="update-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10500"
              step="0.01"
              required
            />
          </div>

          <button type="submit" className="btn-secondary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
