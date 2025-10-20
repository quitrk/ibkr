export interface ProjectionConfig {
  id: string;
  name?: string;
  increasePercent: number;
  intervalDays: number;
  visible: boolean;
}

export interface InstrumentConfig {
  id: string;
  symbol: string; // Stock ticker symbol (e.g., AAPL, TSLA)
}

export interface TrackerConfig {
  id: string;
  name: string;
  startingAmount: number;
  projections: ProjectionConfig[];
  startDate: string; // ISO string
  endDate: string; // ISO string
  createdAt: string;
  depositSchedule?: DepositSchedule; // Optional scheduled deposits
  // IBKR-specific fields
  ibkrSynced?: boolean;
  lastSyncTimestamp?: string;
  // Instrument tracking - portfolio is always 100% allocated across these instruments
  instruments?: InstrumentConfig[];
}

export interface ActualDataPoint {
  date: string; // ISO string
  amount: number;
  source?: 'manual' | 'ibkr'; // Track data source
}

export interface CashFlow {
  id: string; // unique identifier
  date: string; // ISO string
  amount: number; // positive for deposits, negative for withdrawals
  type: 'deposit' | 'withdrawal';
  source?: 'manual' | 'scheduled'; // Track if this was manually added or from a schedule
}

export interface DepositSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  amount: number;
  startDate?: string; // Optional - defaults to tracker start date
  endDate?: string; // Optional - defaults to tracker end date
}

export interface Tracker {
  config: TrackerConfig;
  actualData: ActualDataPoint[];
  cashFlows?: CashFlow[]; // Optional for backwards compatibility
}

export interface ProjectedDataPoint {
  date: string;
  amount: number;
  dayNumber: number;
}

export interface ChartData {
  labels: string[];
  projected: number[];
  actual: (number | null)[];
}

export interface DateRange {
  startDate: string; // ISO string
  endDate: string; // ISO string
}

// IBKR-specific types
export interface IBKRPosition {
  symbol: string;
  position: number;
  marketPrice: number;
  marketValue: number;
  averageCost: number;
  unrealizedPNL: number;
  realizedPNL: number;
  accountName: string;
}

export interface IBKRAccountSummary {
  totalCashValue: number;
  netLiquidation: number;
  positions: IBKRPosition[];
  timestamp: string;
}

export interface IBKRConnectionConfig {
  host: string;
  port: number;
  clientId: number;
}