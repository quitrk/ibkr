import { useState, useEffect, useMemo, ReactNode } from 'react';
import { parseISO, format, differenceInDays, addDays } from 'date-fns';
import type { DateRange, TrackerConfig } from '../types/trackers';
import { WindowSizeSelector } from './WindowSizeSelector';
import { DateRangeSlider } from './DateRangeSlider';

interface DateRangeSelectorProps {
  config: TrackerConfig;
  onChange: (range: DateRange) => void;
  children: (controls: { topControls: ReactNode; bottomControls: ReactNode }) => ReactNode;
}

export function DateRangeSelector({ config, onChange, children }: DateRangeSelectorProps) {
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

  // Update parent when range changes
  useEffect(() => {
    const startDate = format(addDays(fullStartDate, viewStartIndex), 'yyyy-MM-dd');
    const endDate = format(addDays(fullStartDate, viewEndIndex), 'yyyy-MM-dd');
    onChange({
      startDate,
      endDate,
    });
  }, [viewStartIndex, viewEndIndex, fullStartDate, onChange]);

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

  const handleJumpToToday = () => {
    setViewStartIndex(todayIndex);
  };

  const handleSliderChange = (newStart: number) => {
    setViewStartIndex(newStart);
  };

  const viewStartDate = addDays(fullStartDate, viewStartIndex);
  const viewEndDate = addDays(fullStartDate, viewEndIndex);

  const topControls = (
    <WindowSizeSelector
      windowSize={windowSize}
      totalDays={totalDays}
      viewStartDate={viewStartDate}
      viewEndDate={viewEndDate}
      viewStartIndex={viewStartIndex}
      todayIndex={todayIndex}
      onWindowSizeChange={handleWindowSizeChange}
      onJumpToToday={handleJumpToToday}
      onReset={handleReset}
    />
  );

  const bottomControls = (
    <DateRangeSlider
      fullStartDate={fullStartDate}
      totalDays={totalDays}
      viewStartIndex={viewStartIndex}
      viewEndIndex={viewEndIndex}
      windowSize={windowSize}
      onSliderChange={handleSliderChange}
    />
  );

  return <>{children({ topControls, bottomControls })}</>;
}
