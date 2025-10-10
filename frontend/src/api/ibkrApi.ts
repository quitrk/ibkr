import type {
  IBKRConnectionConfig,
} from '../types/investment';

const API_BASE = '/api/ibkr';

export async function getIBKRDefaults(): Promise<{ host: string; port: number }> {
  const response = await fetch(`${API_BASE}/config/defaults`);

  if (!response.ok) {
    throw new Error('Failed to get IBKR defaults');
  }

  return response.json();
}

export async function connectToIBKR(config: IBKRConnectionConfig): Promise<void> {
  const response = await fetch(`${API_BASE}/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to connect to IBKR');
  }

  return response.json();
}

export async function disconnectFromIBKR(): Promise<void> {
  const response = await fetch(`${API_BASE}/disconnect`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disconnect from IBKR');
  }

  return response.json();
}

export async function getIBKRConnectionStatus(): Promise<{ connected: boolean }> {
  const response = await fetch(`${API_BASE}/status`);

  if (!response.ok) {
    throw new Error('Failed to get connection status');
  }

  return response.json();
}

export async function getHistoricalData(
  symbol: string,
  duration: string = '1 M',
  barSize: string = '1 day'
): Promise<any[]> {
  const params = new URLSearchParams({
    duration,
    barSize,
  });

  const response = await fetch(`${API_BASE}/historical/${symbol}?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get historical data');
  }

  return response.json();
}
