import { IBApi, Contract, ErrorCode, EventName, SecType, BarSizeSetting } from '@stoqey/ib';
import type { IBKRConfig, PortfolioPosition, AccountSummary } from '../types/index.js';
import { EventEmitter } from 'events';

export class IBKRService extends EventEmitter {
  private api: IBApi | null = null;
  private config: IBKRConfig;
  private isConnected = false;
  private positions: PortfolioPosition[] = [];
  private accountValues: Map<string, string> = new Map();
  private accountName = '';

  constructor(config: IBKRConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('[IBKRService] Already connected to IBKR');
      return;
    }

    if (this.api) {
      console.log('[IBKRService] API instance already exists, disconnecting first');
      await this.disconnect();
    }

    console.log('[IBKRService] Creating new connection with clientId:', this.config.clientId);

    return new Promise((resolve, reject) => {
      this.api = new IBApi({
        host: this.config.host,
        port: this.config.port,
        clientId: this.config.clientId,
      });

      this.api.on(EventName.connected, () => {
        const timestamp = new Date().toISOString();
        console.log(`[IBKRService ${timestamp}] Connected to IBKR TWS/Gateway with clientId: ${this.config.clientId}`);
        this.isConnected = true;

        // Subscribe to account updates to start receiving portfolio and account value events
        console.log('[IBKRService] Subscribing to account updates...');
        this.api!.reqAccountUpdates(true, '');

        resolve();
      });

      this.api.on(EventName.disconnected, () => {
        const timestamp = new Date().toISOString();
        console.log(`[IBKRService ${timestamp}] Disconnected from IBKR (clientId: ${this.config.clientId})`);
        this.isConnected = false;
      });

      this.api.on(EventName.error, (error: Error, code: ErrorCode, reqId: number) => {
        console.error(`[IBKRService] IBKR Error [${code}]: ${error.message} (reqId: ${reqId})`);
        if (!this.isConnected) {
          reject(error);
        }
      });

      // Setup portfolio update handlers
      this.setupPortfolioHandlers();

      // Connect
      console.log('[IBKRService] Calling api.connect()...');
      this.api.connect();
    });
  }

  private setupPortfolioHandlers(): void {
    if (!this.api) return;

    this.api.on(EventName.updatePortfolio, (
      contract: Contract,
      position: number,
      marketPrice: number,
      marketValue: number,
      averageCost?: number,
      unrealizedPNL?: number,
      realizedPNL?: number,
      accountName?: string
    ) => {
      const portfolioPosition: PortfolioPosition = {
        symbol: contract.symbol || '',
        position,
        marketPrice,
        marketValue,
        averageCost: averageCost || 0,
        unrealizedPNL: unrealizedPNL || 0,
        realizedPNL: realizedPNL || 0,
        accountName: accountName || '',
      };

      // Update account name if not set
      if (accountName && !this.accountName) {
        this.accountName = accountName;
      }

      // Update or add position
      const existingIndex = this.positions.findIndex(
        p => p.symbol === portfolioPosition.symbol && p.accountName === accountName
      );

      if (existingIndex >= 0) {
        this.positions[existingIndex] = portfolioPosition;
      } else {
        this.positions.push(portfolioPosition);
      }

      // Emit real-time update event
      this.emitAccountUpdate();
    });

    this.api.on(EventName.updateAccountValue, (
      key: string,
      value: string,
      currency: string,
      accountName: string
    ) => {
      const mapKey = `${key}_${accountName}`;
      this.accountValues.set(mapKey, value);

      // Update account name if not set
      if (accountName && !this.accountName) {
        this.accountName = accountName;
      }

      // Emit real-time update event
      this.emitAccountUpdate();
    });
  }

  private emitAccountUpdate(): void {
    const summary = this.buildAccountSummary();
    this.emit('accountUpdate', summary);
  }

  private buildAccountSummary(): AccountSummary {
    const totalCashValue = parseFloat(
      this.accountValues.get(`TotalCashValue_${this.accountName}`) || '0'
    );
    const netLiquidation = parseFloat(
      this.accountValues.get(`NetLiquidation_${this.accountName}`) || '0'
    );

    return {
      totalCashValue,
      netLiquidation,
      positions: this.positions,
      timestamp: new Date().toISOString(),
    };
  }

  async disconnect(): Promise<void> {
    if (this.api && this.isConnected) {
      // Unsubscribe from account updates before disconnecting
      console.log('[IBKRService] Unsubscribing from account updates...');
      this.api.reqAccountUpdates(false, '');

      this.api.disconnect();
      this.isConnected = false;
      this.positions = [];
      this.accountValues.clear();
    }
  }

  getCachedAccountSummary(): AccountSummary | null {
    if (!this.isConnected || this.positions.length === 0) {
      return null;
    }
    return this.buildAccountSummary();
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async createContractFromSymbol(symbol: string): Promise<Contract> {
    const contract: Contract = {
      symbol,
      secType: SecType.STK,
      exchange: 'SMART',
      currency: 'USD',
    };
    return contract;
  }

  // Get historical data for a symbol (useful for tracking)
  async getHistoricalData(
    symbol: string,
    endDateTime: string,
    durationStr: string,
    barSizeSetting: BarSizeSetting
  ): Promise<any[]> {
    if (!this.isConnected || !this.api) {
      throw new Error('Not connected to IBKR');
    }

    return new Promise((resolve, reject) => {
      const contract: Contract = {
        symbol,
        secType: SecType.STK,
        exchange: 'SMART',
        currency: 'USD',
      };

      const historicalData: any[] = [];

      // Generate unique request ID
      const reqId = Math.floor(Math.random() * 10000);

      const timeout = setTimeout(() => {
        reject(new Error('Historical data request timed out'));
      }, 30000);

      const handler = (
        requestId: number,
        time: string,
        open: number,
        high: number,
        low: number,
        close: number,
        volume: number,
        count: number | undefined,
        WAP: number,
        hasGaps: boolean | undefined
      ): void => {
        if (requestId === reqId) {
          if (time.startsWith('finished')) {
            clearTimeout(timeout);
            this.api?.off(EventName.historicalData, handler);
            resolve(historicalData);
          } else {
            historicalData.push({
              date: time,
              open,
              high,
              low,
              close,
              volume,
            });
          }
        }
      };

      this.api!.on(EventName.historicalData, handler);

      this.api!.reqHistoricalData(
        reqId,
        contract,
        endDateTime,
        durationStr,
        barSizeSetting,
        'TRADES',
        1,
        1,
        false
      );
    });
  }
}
