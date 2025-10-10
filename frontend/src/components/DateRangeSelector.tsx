import { useState, useEffect, useMemo } from 'react';
import { parseISO, format, differenceInDays, addDays } from 'date-fns';
import type { DateRange, InvestmentConfig } from '../types/investment';
import './DateRangeSelector.css';

interface DateRangeSelectorProps {
  config: InvestmentConfig;
  onChange: (range: DateRange) => void;
}

export function DateRangeSelector({ config, onChange }: DateRangeSelectorProps) {
  const fullStartDate = useMemo(() => parseISO(config.startDate), [config.startDate]);
  const fullEndDate = useMemo(() => parseISO(config.endDate), [config.endDate]);
  const totalDays = useMemo(() => differenceInDays(fullEndDate, fullStartDate), [fullEndDate, fullStartDate]);

  // Calculate today's position relative to start date
  const todayIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceStart = differenceInDays(today, fullStartDate);
    return Math.max(0, Math.min(daysSinceStart, totalDays));
  }, [fullStartDate, totalDays]);

  // Window size and position state
  const [windowSize, setWindowSize] = useState(30);
  const [viewStartIndex, setViewStartIndex] = useState(0);

  // Calculate end index based on window size
  const viewEndIndex = Math.min(viewStartIndex + windowSize, totalDays);

  // Calculate current view dates
  const viewStartDate = addDays(fullStartDate, viewStartIndex);
  const viewEndDate = addDays(fullStartDate, viewEndIndex);

  // Update parent when range changes
  useEffect(() => {
    const startDate = format(addDays(fullStartDate, viewStartIndex), 'yyyy-MM-dd');
    const endDate = format(addDays(fullStartDate, viewEndIndex), 'yyyy-MM-dd');
    onChange({
      startDate,
      endDate,
    });
  }, [viewStartIndex, viewEndIndex, fullStartDate, onChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = parseInt(e.target.value);
    setViewStartIndex(newStart);
  };

  const handleWindowSizeChange = (size: number) => {
    setWindowSize(size);
    // Adjust start position if window extends beyond total days
    if (viewStartIndex + size > totalDays) {
      setViewStartIndex(Math.max(0, totalDays - size));
    }
  };

  const handleReset = () => {
    setViewStartIndex(0);
    setWindowSize(30);
  };

  const viewDays = viewEndIndex - viewStartIndex;

  return (
    <div className="date-range-selector">
      <div className="range-info">
        <div className="range-dates">
          <span className="range-label">Viewing:</span>
          <span className="range-value">
            {format(viewStartDate, 'MMM dd, yyyy')} → {format(viewEndDate, 'MMM dd, yyyy')}
          </span>
          <span className="range-days">({viewDays} days)</span>
        </div>
        <div className="window-size-selector">
          <div className="window-size-buttons">
            {[7, 30, 60, 90, 180, 365].map(size => (
              <button
                key={size}
                onClick={() => handleWindowSizeChange(size)}
                className={`btn-window-size ${windowSize === size ? 'active' : ''}`}
                disabled={size > totalDays}
              >
                {size === 365 ? '1y' : `${size}d`}
              </button>
            ))}
            <button
              onClick={() => setViewStartIndex(todayIndex)}
              className={`btn-today ${viewStartIndex === todayIndex ? 'active' : ''}`}
            >
              Today
            </button>
            <button
              onClick={handleReset}
              className={`btn-today ${viewStartIndex === 0 ? 'active' : ''}`}
              title="Reset to start + 30 days"
            >
              Start Date
            </button>
          </div>
        </div>
      </div>

      <div className="range-slider-container">
        <div className="range-inputs">
          <div className="range-input-group">
            <label>Position</label>
            <input
              type="range"
              min="0"
              max={Math.max(0, totalDays - windowSize)}
              value={viewStartIndex}
              onChange={handleSliderChange}
              className="range-slider"
            />
            <div className="range-labels">
              <span className="range-date-label">
                {format(viewStartDate, 'MMM dd')}
              </span>
              <span className="range-date-label">
                {format(viewEndDate, 'MMM dd')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
