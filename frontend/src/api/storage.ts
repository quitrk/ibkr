import type { Investment, InvestmentConfig, ActualDataPoint, CashFlow } from '../types/investment';

const STORAGE_KEY = 'investment-tracing-data';

/**
 * Storage API Layer - handles all localStorage operations
 */

export function getAllInvestments(): Investment[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return [];
  }
}

export function getInvestmentById(id: string): Investment | null {
  const investments = getAllInvestments();
  return investments.find(inv => inv.config.id === id) || null;
}

export function saveInvestment(investment: Investment): void {
  try {
    const investments = getAllInvestments();
    const existingIndex = investments.findIndex(inv => inv.config.id === investment.config.id);

    if (existingIndex >= 0) {
      investments[existingIndex] = investment;
    } else {
      investments.push(investment);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(investments));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    throw new Error('Failed to save investment data');
  }
}

export function createInvestment(config: InvestmentConfig): Investment {
  const investment: Investment = {
    config,
    actualData: [],
    cashFlows: [],
  };

  saveInvestment(investment);
  return investment;
}

export function addActualDataPoint(investmentId: string, dataPoint: ActualDataPoint): void {
  const investment = getInvestmentById(investmentId);
  if (!investment) {
    throw new Error('Investment not found');
  }

  // Remove existing data point for the same date if it exists
  investment.actualData = investment.actualData.filter(
    point => point.date !== dataPoint.date
  );

  // Add new data point
  investment.actualData.push(dataPoint);

  // Sort by date
  investment.actualData.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  saveInvestment(investment);
}

export function updateActualDataPoint(
  investmentId: string,
  date: string,
  amount: number
): void {
  addActualDataPoint(investmentId, { date, amount });
}

export function deleteActualDataPoint(investmentId: string, date: string): void {
  const investment = getInvestmentById(investmentId);
  if (!investment) {
    throw new Error('Investment not found');
  }

  investment.actualData = investment.actualData.filter(
    point => point.date !== date
  );

  saveInvestment(investment);
}

export function updateInvestmentEndDate(investmentId: string, endDate: string): void {
  const investment = getInvestmentById(investmentId);
  if (!investment) {
    throw new Error('Investment not found');
  }

  investment.config.endDate = endDate;
  saveInvestment(investment);
}

export function updateInvestmentConfig(investmentId: string, updates: Partial<InvestmentConfig>): void {
  const investment = getInvestmentById(investmentId);
  if (!investment) {
    throw new Error('Investment not found');
  }

  investment.config = { ...investment.config, ...updates };
  saveInvestment(investment);
}

export function deleteInvestment(id: string): void {
  try {
    const investments = getAllInvestments();
    const filtered = investments.filter(inv => inv.config.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting from localStorage:', error);
    throw new Error('Failed to delete investment');
  }
}

export function addCashFlow(investmentId: string, cashFlow: Omit<CashFlow, 'id'>): void {
  const investment = getInvestmentById(investmentId);
  if (!investment) {
    throw new Error('Investment not found');
  }

  // Initialize cashFlows array if it doesn't exist (backwards compatibility)
  if (!investment.cashFlows) {
    investment.cashFlows = [];
  }

  // Add new cash flow with unique ID
  const newCashFlow: CashFlow = {
    ...cashFlow,
    id: crypto.randomUUID(),
  };

  investment.cashFlows.push(newCashFlow);

  // Sort by date
  investment.cashFlows.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  saveInvestment(investment);
}

export function deleteCashFlow(investmentId: string, cashFlowId: string): void {
  const investment = getInvestmentById(investmentId);
  if (!investment) {
    throw new Error('Investment not found');
  }

  if (!investment.cashFlows) return;

  investment.cashFlows = investment.cashFlows.filter(cf => cf.id !== cashFlowId);

  saveInvestment(investment);
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}
