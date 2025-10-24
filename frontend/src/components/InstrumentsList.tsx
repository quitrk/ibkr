import { useState } from 'react';
import { InstrumentConfig } from '../types/trackers';
import { useToast } from '../contexts/ToastContext';
import { ToastDuration } from './Toast';
import './InstrumentsList.css';

interface InstrumentsListProps {
  instruments: InstrumentConfig[];
  onChange: (instruments: InstrumentConfig[]) => void;
}

export function InstrumentsList({ instruments, onChange }: InstrumentsListProps) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);
  const { showError, showSuccess } = useToast();

  const handleAdd = () => {
    if (!inputValue.trim()) {
      setShowInput(false);
      return;
    }

    const upperSymbol = inputValue.trim().toUpperCase();

    // Check for duplicates
    if (instruments.some(i => i.symbol === upperSymbol)) {
      showError('This instrument is already in the list', ToastDuration.Short);
      setInputValue('');
      return;
    }

    const newInstrument: InstrumentConfig = {
      id: crypto.randomUUID(),
      symbol: upperSymbol,
      visible: true,
    };

    onChange([...instruments, newInstrument]);
    setInputValue('');
    setShowInput(false);
    showSuccess(`${upperSymbol} added to instruments`, ToastDuration.Short);
  };

  const handleRemove = (id: string) => {
    const instrument = instruments.find(i => i.id === id);
    onChange(instruments.filter(i => i.id !== id));
    if (instrument) {
      showSuccess(`${instrument.symbol} removed from instruments`, ToastDuration.Short);
    }
  };

  const handleToggleVisibility = (id: string) => {
    onChange(instruments.map(i =>
      i.id === id ? { ...i, visible: !i.visible } : i
    ));
  };

  return (
    <div className="instruments-container">
      <div className="instruments-header">
        <div className="form-section-title">
          Instruments
          <small className="form-hint">Each instrument is tracked as if the full investment amount was allocated to it</small>
        </div>
        <button
          type="button"
          onClick={() => setShowInput(!showInput)}
          className="btn-add-instrument-icon"
          title="Add instrument"
        >
          +
        </button>
      </div>

      {showInput && (
        <div className="instrument-input-row">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') {
                setInputValue('');
                setShowInput(false);
              }
            }}
            placeholder="Enter symbol (e.g., AAPL, TSLA)"
            autoFocus
            className="instrument-input"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="btn-icon"
            title="Add"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setShowInput(false);
            }}
            className="btn-icon"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {instruments.length > 0 && (
        <div className="instruments-list">
          {instruments.map((instrument) => (
            <div key={instrument.id} className="instrument-item">
              <div className="instrument-info">
                <span className="instrument-symbol">
                  {instrument.symbol}
                </span>
                <span className="instrument-details">
                  {!instrument.visible && '(hidden)'}
                </span>
              </div>
              <div className="instrument-actions">
                <button
                  type="button"
                  onClick={() => handleToggleVisibility(instrument.id)}
                  className="btn-icon"
                  title={instrument.visible ? 'Hide instrument' : 'Show instrument'}
                >
                  {instrument.visible ? '✓' : '✕'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(instrument.id)}
                  className="btn-icon"
                  title="Remove instrument"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
