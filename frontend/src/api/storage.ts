import type { Tracker, TrackerConfig, ActualDataPoint, CashFlow } from '../types/trackers';
import { generateScheduledCashFlows } from '../utils/calculations';

const STORAGE_KEY = 'tracker-tracing-data';

/**
 * Storage API Layer - handles all localStorage operations
 */

export function getAllTrackers(): Tracker[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return [];
  }
}

export function getTrackerById(id: string): Tracker | null {
  const trackers = getAllTrackers();
  return trackers.find(inv => inv.config.id === id) || null;
}

export function saveTracker(tracker: Tracker): void {
  try {
    const trackers = getAllTrackers();
    const existingIndex = trackers.findIndex(inv => inv.config.id === tracker.config.id);

    if (existingIndex >= 0) {
      trackers[existingIndex] = tracker;
    } else {
      trackers.push(tracker);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trackers));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    throw new Error('Failed to save tracker data');
  }
}

export function createTracker(config: TrackerConfig): Tracker {
  const tracker: Tracker = {
    config,
    actualData: [],
    cashFlows: [],
  };

  // Generate scheduled cash flows if schedule is provided
  if (config.depositSchedule && config.depositSchedule.enabled) {
    const scheduledCashFlows = generateScheduledCashFlows(
      config.depositSchedule,
      config.startDate,
      config.endDate
    );
    tracker.cashFlows = scheduledCashFlows;
  }

  saveTracker(tracker);
  return tracker;
}

export function addActualDataPoint(trackerId: string, dataPoint: ActualDataPoint): void {
  const tracker = getTrackerById(trackerId);
  if (!tracker) {
    throw new Error('Tracker not found');
  }

  // Remove existing data point for the same date if it exists
  tracker.actualData = tracker.actualData.filter(
    point => point.date !== dataPoint.date
  );

  // Add new data point
  tracker.actualData.push(dataPoint);

  // Sort by date
  tracker.actualData.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  saveTracker(tracker);
}

export function updateActualDataPoint(
  trackerId: string,
  date: string,
  amount: number
): void {
  addActualDataPoint(trackerId, { date, amount });
}

export function deleteActualDataPoint(trackerId: string, date: string): void {
  const tracker = getTrackerById(trackerId);
  if (!tracker) {
    throw new Error('Tracker not found');
  }

  tracker.actualData = tracker.actualData.filter(
    point => point.date !== date
  );

  saveTracker(tracker);
}

export function updateTrackerEndDate(trackerId: string, endDate: string): void {
  const tracker = getTrackerById(trackerId);
  if (!tracker) {
    throw new Error('Tracker not found');
  }

  tracker.config.endDate = endDate;
  saveTracker(tracker);
}

export function updateTrackerConfig(trackerId: string, updates: Partial<TrackerConfig>): void {
  const tracker = getTrackerById(trackerId);
  if (!tracker) {
    throw new Error('Tracker not found');
  }

  tracker.config = { ...tracker.config, ...updates };
  saveTracker(tracker);
}

export function regenerateScheduledCashFlows(trackerId: string): void {
  const tracker = getTrackerById(trackerId);
  if (!tracker) {
    throw new Error('Tracker not found');
  }

  // Remove existing scheduled cash flows
  if (tracker.cashFlows) {
    tracker.cashFlows = tracker.cashFlows.filter(cf => cf.source !== 'scheduled');
  } else {
    tracker.cashFlows = [];
  }

  // Generate new scheduled cash flows if schedule is enabled
  if (tracker.config.depositSchedule && tracker.config.depositSchedule.enabled) {
    const scheduledCashFlows = generateScheduledCashFlows(
      tracker.config.depositSchedule,
      tracker.config.startDate,
      tracker.config.endDate
    );
    tracker.cashFlows = [...tracker.cashFlows, ...scheduledCashFlows];

    // Sort by date
    tracker.cashFlows.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  saveTracker(tracker);
}

export function deleteTracker(id: string): void {
  try {
    const trackers = getAllTrackers();
    const filtered = trackers.filter(inv => inv.config.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting from localStorage:', error);
    throw new Error('Failed to delete tracker');
  }
}

export function addCashFlow(trackerId: string, cashFlow: Omit<CashFlow, 'id'>): void {
  const tracker = getTrackerById(trackerId);
  if (!tracker) {
    throw new Error('Tracker not found');
  }

  // Initialize cashFlows array if it doesn't exist (backwards compatibility)
  if (!tracker.cashFlows) {
    tracker.cashFlows = [];
  }

  // Add new cash flow with unique ID
  const newCashFlow: CashFlow = {
    ...cashFlow,
    id: crypto.randomUUID(),
  };

  tracker.cashFlows.push(newCashFlow);

  // Sort by date
  tracker.cashFlows.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  saveTracker(tracker);
}

export function deleteCashFlow(trackerId: string, cashFlowId: string): void {
  const tracker = getTrackerById(trackerId);
  if (!tracker) {
    throw new Error('Tracker not found');
  }

  if (!tracker.cashFlows) return;

  tracker.cashFlows = tracker.cashFlows.filter(cf => cf.id !== cashFlowId);

  saveTracker(tracker);
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}
