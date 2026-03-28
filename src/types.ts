
export interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockData {
  ticker: string;
  companyName: string;
  price: number;
  eps: number;
  pe: number;
  peMean: number;
  peStdDev: number;
  pePercentile: number;
  peRangeHigh: number;
  peRangeLow: number;
  peMaxRecentQuarter: number;
  currency: string;
  peHistory: { date: string; value: number }[];
  dailyKLines: KLineData[];
  weeklyKLines: KLineData[];
  volumeRecent: number;
  volumeAvg3m: number;
  ma150: number;
  ma200: number;
  lastUpdated: string;
}

export interface NewsItem {
  title: string;
  source: string;
  date: string;
  url: string;
  snippet: string;
}

export interface AnalysisScenario {
  peg: number;
  winRate: number;
  odds: number;
  impliedGrowth: number;
  targetPrice: number;
  kellyFraction: number;
  kellyFractionQuarter: number;
  biasRate: number;
  maBias150: number;
  maBias200: number;
  isHighBias: boolean;
  riskStatus: 'NORMAL' | 'HIGH_RISK';
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}
