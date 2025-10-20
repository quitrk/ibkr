import { format, parseISO, differenceInDays } from 'date-fns';
import type { CashFlow } from '../types/trackers';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface HistoricalPrice {
  date: string;
  close: number;
}

/**
 * Fetch historical prices for a single instrument from IBKR
 */
export async function fetchInstrumentHistory(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<HistoricalPrice[]> {
  // Calculate duration in days
  const days = differenceInDays(parseISO(endDate), parseISO(startDate));

  // IBKR duration format: "X D" for days, "X W" for weeks, "X M" for months, "X Y" for years
  // Use appropriate unit to stay within IBKR limits
  let duration: string;
  if (days <= 30) {
    duration = `${Math.max(1, days)} D`;
  } else if (days <= 52 * 7) {  // Up to ~1 year
    const weeks = Math.max(1, Math.ceil(days / 7));
    duration = `${weeks} W`;
  } else if (days <= 365 * 5) {  // Up to 5 years
    const months = Math.max(1, Math.ceil(days / 30));
    duration = `${months} M`;
  } else {
    const years = Math.max(1, Math.ceil(days / 365));
    duration = `${years} Y`;
  }

  // IBKR endDateTime: empty string means "now"
  // We always use empty string to get data up to the current moment
  const response = await fetch(
    `${BACKEND_URL}/api/ibkr/historical/${symbol}?` +
    `endDateTime=&` +
    `duration=${encodeURIComponent(duration)}&` +
    `barSize=DAYS_ONE`,
    { credentials: 'include' }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch historical data for ${symbol}`);
  }

  const data = await response.json();

  // Convert IBKR format to our format
  return data.map((bar: any) => ({
    date: format(parseISO(bar.date), 'yyyy-MM-dd'),
    close: bar.close,
  }));
}

/**
 * Get historical performance for a single instrument
 * Returns normalized data (starting at startingAmount) and price per share
 * Includes cash flows to enable fair comparison with actual portfolio
 */
export async function getInstrumentPerformance(
  symbol: string,
  startDate: string,
  endDate: string,
  startingAmount: number,
  cashFlows: CashFlow[] = []
): Promise<{ valueMap: Map<string, number>; priceMap: Map<string, number> }> {
  const prices = await fetchInstrumentHistory(symbol, startDate, endDate);

  if (prices.length === 0) {
    return { valueMap: new Map(), priceMap: new Map() };
  }

  // Sort by date and filter to only include dates >= startDate
  // IBKR may return data from before startDate due to how duration works
  const sorted = [...prices]
    .filter(p => parseISO(p.date) >= parseISO(startDate))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  if (sorted.length === 0) {
    return { valueMap: new Map(), priceMap: new Map() };
  }

  const valueMap = new Map<string, number>();
  const priceMap = new Map<string, number>();

  // Track shares and cash separately for accurate cash flow handling
  let shares = 0;
  let cash = startingAmount;

  sorted.forEach(({ date, close }) => {
    // First day: buy shares with starting amount
    if (shares === 0 && cash > 0) {
      shares = cash / close;
      cash = 0;
    }

    // Apply cash flows on this date
    const cashFlowsOnDate = cashFlows.filter(cf => cf.date === date);
    cashFlowsOnDate.forEach(cf => {
      cash += cf.amount;
    });

    // Buy/sell shares with accumulated cash
    if (cash !== 0) {
      shares += cash / close;
      cash = 0;
    }

    // Calculate portfolio value (shares * current price)
    const value = shares * close;
    valueMap.set(date, value);
    priceMap.set(date, close);
  });

  return { valueMap, priceMap };
}
