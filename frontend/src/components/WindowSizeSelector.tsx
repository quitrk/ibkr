import { format } from 'date-fns';
import './WindowSizeSelector.css';

interface WindowSizeSelectorProps {
  windowSize: number;
  totalDays: number;
  viewStartDate: Date;
  viewEndDate: Date;
  viewStartIndex: number;
  todayIndex: number;
  onWindowSizeChange: (size: number) => void;
  onJumpToToday: () => void;
  onReset: () => void;
}

export function WindowSizeSelector({
  windowSize,
  totalDays,
  viewStartDate,
  viewEndDate,
  viewStartIndex,
  todayIndex,
  onWindowSizeChange,
  onJumpToToday,
  onReset
}: WindowSizeSelectorProps) {
  return (
    <div className="window-size-selector">
      <div className="viewing-info">
        <span className="range-value">
          {format(viewStartDate, 'MMM dd, yyyy')} - {format(viewEndDate, 'MMM dd, yyyy')}
        </span>
      </div>
      <div className="controls-right">
        <div className="window-size-buttons">
          {[7, 30, 60, 90, 180, 365, 1825, 3650].map(size => (
            <button
              key={size}
              onClick={() => onWindowSizeChange(size)}
              className={`btn-window-size ${windowSize === size ? 'active' : ''}`}
              disabled={size > totalDays}
            >
              {size === 365 ? '1y' : size === 1825 ? '5y' : size === 3650 ? '10y' : `${size}d`}
            </button>
          ))}
        </div>
        <div className="range-actions">
          <button
            onClick={onJumpToToday}
            className={`btn-action ${viewStartIndex === todayIndex ? 'active' : ''}`}
          >
            Today
          </button>
          <button
            onClick={onReset}
            className={`btn-action ${viewStartIndex === 0 ? 'active' : ''}`}
            title="Reset to start + 30 days"
          >
            Start Date
          </button>
        </div>
      </div>
    </div>
  );
}
