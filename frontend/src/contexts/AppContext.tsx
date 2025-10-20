import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Tracker } from '../types/trackers';
import { getInstrumentPerformance } from '../utils/instrumentTracking';

interface InstrumentPerformanceData {
  symbol: string;
  valueMap: Map<string, number>;
  priceMap: Map<string, number>;
}

interface AppContextType {
  trackers: Tracker[];
  setTrackers: (trackers: Tracker[]) => void;
  selectedTracker: Tracker | null;
  setSelectedTracker: (tracker: Tracker | null) => void;
  instrumentPerformance: Map<string, InstrumentPerformanceData>;
  isLoadingInstruments: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);
  const [instrumentPerformance, setInstrumentPerformance] = useState<Map<string, InstrumentPerformanceData>>(new Map());
  const [isLoadingInstruments, setIsLoadingInstruments] = useState(false);

  // Fetch instrument performance when selected tracker or instruments change
  useEffect(() => {
    const fetchInstruments = async () => {
      if (!selectedTracker || !selectedTracker.config.instruments || selectedTracker.config.instruments.length === 0) {
        setInstrumentPerformance(new Map());
        setIsLoadingInstruments(false);
        return;
      }

      setIsLoadingInstruments(true);

      const today = new Date().toISOString().split('T')[0];
      const cashFlows = selectedTracker.cashFlows || [];
      const perfMap = new Map<string, InstrumentPerformanceData>();

      try {
        await Promise.all(
          selectedTracker.config.instruments.map(async (inst) => {
            try {
              const perf = await getInstrumentPerformance(
                inst.symbol,
                selectedTracker.config.startDate,
                today,
                selectedTracker.config.startingAmount,
                cashFlows
              );
              perfMap.set(inst.id, {
                symbol: inst.symbol,
                ...perf
              });
            } catch (error) {
              console.error(`Failed to fetch performance for ${inst.symbol}:`, error);
            }
          })
        );
        setInstrumentPerformance(perfMap);
      } catch (error) {
        console.error('Failed to fetch instrument performance:', error);
      } finally {
        setIsLoadingInstruments(false);
      }
    };

    fetchInstruments();
  }, [selectedTracker?.config.instruments, selectedTracker?.config.startDate, selectedTracker?.config.startingAmount, selectedTracker?.cashFlows]);

  return (
    <AppContext.Provider value={{
      trackers,
      setTrackers,
      selectedTracker,
      setSelectedTracker,
      instrumentPerformance,
      isLoadingInstruments
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
