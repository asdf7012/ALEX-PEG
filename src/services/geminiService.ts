
import { GoogleGenAI, Type } from "@google/genai";
import { StockData, NewsItem } from "../types";

export const fetchStockData = async (ticker: string): Promise<StockData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Perform a detailed financial analysis for the stock ticker: ${ticker}. 
  IMPORTANT: If the ticker symbol is invalid, non-existent, or no financial data can be found for it, return a JSON object with an "error" field set to "INVALID_TICKER".
  
  Otherwise, perform the following steps carefully:
  1. Current stock price and Trailing Twelve Months (TTM) EPS.
  2. Retrieve the monthly closing prices for the past 36 months (3 years).
  3. Retrieve the corresponding quarterly EPS for the same period.
  4. Construct a 3-year historical P/E sequence by dividing each monthly price by the most recent TTM EPS available at that time.
  5. Calculate the Mean (average) and Standard Deviation (σ) of this 3-year P/E sequence.
  6. Calculate the Current P/E Percentile (where current P/E stands in the 3-year historical distribution).
  7. Find the Highest P/E ratio recorded in the most recent quarter (last 3 months).
  8. Retrieve the most recent daily trading volume and the average daily trading volume over the past 3 months.
  9. Retrieve Daily K-line data (Open, High, Low, Close, Volume) for the last 30 trading days.
  10. Retrieve Weekly K-line data (Open, High, Low, Close, Volume) for the last 24 weeks.
  11. Retrieve the current 150-day Moving Average (150MA) and 200-day Moving Average (200MA).
  
  Provide the result in clean JSON format:
  {
    "price": number,
    "eps": number,
    "companyName": string,
    "currency": string,
    "peMean": number,
    "peStdDev": number,
    "pePercentile": number (0-100),
    "peRangeHigh": number (Mean + 1σ),
    "peRangeLow": number (Mean - 1σ),
    "peMaxRecentQuarter": number,
    "volumeRecent": number,
    "volumeAvg3m": number,
    "ma150": number,
    "ma200": number,
    "peHistory": [
      {"date": "YYYY-MM", "value": number},
      ... (include at least 12-24 data points representing the 3-year trend)
    ],
    "dailyKLines": [
      {"date": "YYYY-MM-DD", "open": number, "high": number, "low": number, "close": number, "volume": number}
    ],
    "weeklyKLines": [
      {"date": "YYYY-MM-DD", "open": number, "high": number, "low": number, "close": number, "volume": number}
    ]
  }
  Ensure the data is accurate for the last 3 years. For Taiwan stocks (e.g., 2330.TW), use TWD.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          error: { type: Type.STRING, description: "Set to 'INVALID_TICKER' if the symbol is not found." },
          price: { type: Type.NUMBER },
          eps: { type: Type.NUMBER },
          companyName: { type: Type.STRING },
          currency: { type: Type.STRING },
          peMean: { type: Type.NUMBER },
          peStdDev: { type: Type.NUMBER },
          pePercentile: { type: Type.NUMBER },
          peRangeHigh: { type: Type.NUMBER },
          peRangeLow: { type: Type.NUMBER },
          peMaxRecentQuarter: { type: Type.NUMBER },
          volumeRecent: { type: Type.NUMBER },
          volumeAvg3m: { type: Type.NUMBER },
          ma150: { type: Type.NUMBER },
          ma200: { type: Type.NUMBER },
          peHistory: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                value: { type: Type.NUMBER }
              }
            }
          },
          dailyKLines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                open: { type: Type.NUMBER },
                high: { type: Type.NUMBER },
                low: { type: Type.NUMBER },
                close: { type: Type.NUMBER },
                volume: { type: Type.NUMBER }
              }
            }
          },
          weeklyKLines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                open: { type: Type.NUMBER },
                high: { type: Type.NUMBER },
                low: { type: Type.NUMBER },
                close: { type: Type.NUMBER },
                volume: { type: Type.NUMBER }
              }
            }
          }
        },
      }
    },
  });

  const rawText = response.text || "{}";
  const data = JSON.parse(rawText);

  if (data.error === "INVALID_TICKER" || (!data.price && !data.companyName)) {
    throw new Error(`代號 "${ticker}" 無效或找不到相關數據，請輸入正確的股票代號。`);
  }

  const pe = data.eps !== 0 ? data.price / data.eps : 0;

  return {
    ticker: ticker.toUpperCase(),
    companyName: data.companyName || ticker,
    price: data.price,
    eps: data.eps,
    pe: pe,
    peMean: data.peMean,
    peStdDev: data.peStdDev,
    pePercentile: data.pePercentile,
    peRangeHigh: data.peRangeHigh,
    peRangeLow: data.peRangeLow,
    peMaxRecentQuarter: data.peMaxRecentQuarter || data.peRangeHigh,
    currency: data.currency || 'USD',
    peHistory: data.peHistory || [],
    dailyKLines: data.dailyKLines || [],
    weeklyKLines: data.weeklyKLines || [],
    volumeRecent: data.volumeRecent || 0,
    volumeAvg3m: data.volumeAvg3m || 0,
    ma150: data.ma150 || 0,
    ma200: data.ma200 || 0,
    lastUpdated: new Date().toLocaleString(),
  };
};

export const fetchStockNews = async (ticker: string): Promise<NewsItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Search for the most recent and relevant financial news headlines for the stock ticker: ${ticker}. 
  Provide a list of 6 significant news items from the last week.
  Return the information in the following JSON format:
  {
    "news": [
      {
        "title": "Headline",
        "source": "News Source Name",
        "date": "Relative date (e.g. 2 hours ago, 1 day ago)",
        "snippet": "Short summary",
        "url": "Direct URL to article"
      }
    ]
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          news: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                source: { type: Type.STRING },
                date: { type: Type.STRING },
                snippet: { type: Type.STRING },
                url: { type: Type.STRING },
              },
              required: ["title", "source", "url"]
            }
          }
        },
        required: ["news"]
      }
    },
  });

  const rawText = response.text || "{}";
  const data = JSON.parse(rawText);
  
  // Also try to enrich URLs from grounding chunks if the AI provided broken ones
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const webUrls = chunks.map(c => c.web?.uri).filter(Boolean) as string[];

  const news = (data.news || []).map((item: any, idx: number) => {
    // If URL looks suspicious or missing, try to use a grounding chunk URL
    const finalUrl = (item.url && item.url.startsWith('http')) ? item.url : (webUrls[idx] || webUrls[0] || '#');
    return {
      ...item,
      url: finalUrl
    };
  });

  return news;
};
