import { useState } from 'react';
import { format, addDays } from 'date-fns';
import './DateRangeSlider.css';

interface DateRangeSliderProps {
  fullStartDate: Date;
  totalDays: number;
  viewStartIndex: number;
  viewEndIndex: number;
  windowSize: number;
  onSliderChange: (newStart: number) => void;
}

export function DateRangeSlider({
  fullStartDate,
  totalDays,
  viewStartIndex,
  viewEndIndex,
  windowSize,
  onSliderChange,
}: DateRangeSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(0);

  const maxSliderValue = Math.max(0, totalDays - windowSize);
  const sliderIsUseful = maxSliderValue >= 7;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = parseInt(e.target.value);
    onSliderChange(newStart);

    // Update tooltip position
    const percent = (newStart / maxSliderValue) * 100;
    setTooltipPosition(percent);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const tooltipDate = addDays(fullStartDate, viewStartIndex);

  return (
    <div className="date-range-slider">
      {sliderIsUseful && (
        <div className="range-slider-container">
          <div className="range-inputs">
            <div className="range-input-group">
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max={maxSliderValue}
                  value={viewStartIndex}
                  onChange={handleSliderChange}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onTouchStart={handleMouseDown}
                  onTouchEnd={handleMouseUp}
                  className="range-slider"
                />
                {isDragging && (
                  <div
                    className="slider-tooltip"
                    style={{ left: `${tooltipPosition}%` }}
                  >
                    {format(tooltipDate, 'MMM dd, yyyy')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {!sliderIsUseful && (
        <div className="range-info-message">
          Window size covers entire or most of the project timeline
        </div>
      )}
    </div>
  );
}
