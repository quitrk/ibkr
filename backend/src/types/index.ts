export interface IBKRConfig {
  host: string;
  port: number;
  clientId: number;
}

export interface PortfolioPosition {
  symbol: string;
  position: number;
  marketPrice: number;
  marketValue: number;
  averageCost: number;
  unrealizedPNL: number;
  realizedPNL: number;
  accountName: string;
}

export interface AccountValue {
  key: string;
  value: string;
  currency: string;
  accountName: string;
}

export interface AccountSummary {
  totalCashValue: number;
  netLiquidation: number;
  positions: PortfolioPosition[];
  timestamp: string;
}

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
