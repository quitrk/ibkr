import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { Tracker, CashFlow } from '../types/trackers';
import { formatCurrency } from '../utils/calculations';
import './CashFlowManager.css';

interface CashFlowManagerProps {
  tracker: Tracker;
  onAdd: (cashFlow: Omit<CashFlow, 'id'>) => void;
  onDelete: (cashFlowId: string) => void;
}

export function CashFlowManager({ tracker, onAdd, onDelete }: CashFlowManagerProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    onAdd({
      date,
      amount: parseFloat(amount),
      type,
    });

    // Reset form
    setAmount('');
  };

  const handleDelete = (cashFlowId: string, cashFlowDate: string) => {
    if (confirm(`Are you sure you want to delete the cash flow from ${format(parseISO(cashFlowDate), 'MMM dd, yyyy')}?`)) {
      onDelete(cashFlowId);
    }
  };

  const cashFlows = tracker.cashFlows || [];

  // Calculate net cash flow
  const netCashFlow = cashFlows.reduce((sum, cf) => {
    return sum + (cf.type === 'deposit' ? cf.amount : -cf.amount);
  }, 0);

  return (
    <div className="cash-flow-manager">
      <h3>Cash Flows</h3>
      <p className="cash-flow-description">
        Track deposits and withdrawals to accurately measure trade performance
      </p>

      {cashFlows.length > 0 && (
        <>
          <div className="net-cash-flow">
            <span className="net-label">Net Cash Flow:</span>
            <span className={`net-value ${netCashFlow >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(netCashFlow)}
            </span>
          </div>

          <div className="cash-flow-list">
            <h4>History</h4>
            <div className="entries">
              {cashFlows.slice().reverse().map((cf) => (
                <div key={cf.id} className={`cash-flow-item ${cf.type}`}>
                  <div className="cash-flow-info">
                    <span className="cash-flow-date">{format(parseISO(cf.date), 'MMM dd, yyyy')}</span>
                    <span className={`cash-flow-amount ${cf.type}`}>
                      {cf.type === 'deposit' ? '+' : '-'}{formatCurrency(Math.abs(cf.amount))}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(cf.id, cf.date)}
                    className="btn-delete-entry"
                    title="Delete cash flow"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="cash-flow-form">
        <h4>Add Cash Flow</h4>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cf-date">Date</label>
            <input
              type="date"
              id="cf-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cf-type">Type</label>
            <select
              id="cf-type"
              value={type}
              onChange={(e) => setType(e.target.value as 'deposit' | 'withdrawal')}
            >
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cf-amount">Amount ($)</label>
            <input
              type="number"
              id="cf-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              step="0.01"
              required
            />
          </div>

          <button type="submit" className="btn-secondary">
            Add {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
          </button>
        </div>
      </form>
    </div>
  );
}
