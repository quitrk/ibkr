export interface InvestmentConfig {
  id: string;
  name: string;
  startingAmount: number;
  projectedIncreasePercent: number;
  intervalDays: number;
  startDate: string; // ISO string
  endDate: string; // ISO string
  createdAt: string;
  // IBKR-specific fields
  ibkrSynced?: boolean;
  lastSyncTimestamp?: string;
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
}

export interface Investment {
  config: InvestmentConfig;
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
