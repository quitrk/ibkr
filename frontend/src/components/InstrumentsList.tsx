import { useState } from 'react';
import { InstrumentConfig } from '../types/trackers';
import './InstrumentsList.css';

interface InstrumentsListProps {
  instruments: InstrumentConfig[];
  onChange: (instruments: InstrumentConfig[]) => void;
}

export function InstrumentsList({ instruments, onChange }: InstrumentsListProps) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleAdd = () => {
    if (!inputValue.trim()) {
      setShowInput(false);
      return;
    }

    const upperSymbol = inputValue.trim().toUpperCase();

    // Check for duplicates
    if (instruments.some(i => i.symbol === upperSymbol)) {
      alert('This instrument is already in the list');
      setInputValue('');
      return;
    }

    const newInstrument: InstrumentConfig = {
      id: crypto.randomUUID(),
      symbol: upperSymbol,
    };

    onChange([...instruments, newInstrument]);
    setInputValue('');
    setShowInput(false);
  };

  const handleRemove = (id: string) => {
    onChange(instruments.filter(i => i.id !== id));
  };

  const allocationPerInstrument = instruments.length > 0
    ? (100 / instruments.length).toFixed(1)
    : '0';

  return (
    <div className="instruments-container">
      <div className="instruments-header">
        <div className="form-section-title">
          Instruments
          <small className="form-hint">Portfolio is split equally across all instruments</small>
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
                <span className="instrument-symbol">{instrument.symbol}</span>
                <span className="instrument-allocation">{allocationPerInstrument}%</span>
              </div>
              <div className="instrument-actions">
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
