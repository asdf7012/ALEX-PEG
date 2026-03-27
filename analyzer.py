import yfinance as yf
import pandas as pd
import numpy as np

def calculate_kelly(p, b):
    """
    Kelly formula: f* = (bp - q) / b where q = 1 - p
    """
    q = 1 - p
    if b <= 0:
        return 0
    f = (b * p - q) / b
    return max(0, f)

def analyze_stock(ticker_symbol):
    try:
        # Fetch stock data
        stock = yf.Ticker(ticker_symbol)
        info = stock.info
        
        if not info or 'currentPrice' not in info:
            print(f"Error: 無法取得代號 '{ticker_symbol}' 的數據。請確認代號是否正確。")
            return None

        price = info.get('currentPrice')
        eps = info.get('trailingEps')
        company_name = info.get('longName', ticker_symbol)
        currency = info.get('currency', 'USD')

        if price is None or eps is None:
            print(f"Error: 代號 '{ticker_symbol}' 的數據不完整 (價格或 EPS 缺失)。")
            return None

        # Fetch historical data for P/E analysis (3 years)
        hist = stock.history(period="3y")
        if hist.empty:
            print(f"Error: 無法取得代號 '{ticker_symbol}' 的歷史數據。")
            return None

        # Simplified P/E calculation for demonstration
        # In a real scenario, you'd align quarterly EPS with historical prices
        # Here we use the current TTM EPS for the historical average as a proxy
        pe_series = hist['Close'] / eps
        pe_mean = pe_series.mean()
        pe_std = pe_series.std()
        pe_current = price / eps
        
        # Calculate Percentile
        pe_percentile = (pe_series < pe_current).mean() * 100

        pe_range_high = pe_mean + pe_std
        pe_range_low = pe_mean - pe_std

        # Fetch max PE of recent quarter (last 63 trading days approx)
        recent_hist = hist.tail(63)
        pe_max_recent = (recent_hist['Close'] / eps).max()

        # Bias Ratio (乖離率)
        mean_price = pe_mean * eps
        bias_rate = ((price - mean_price) / mean_price) * 100
        is_high_bias = bias_rate > 20

        # Odds (B) = (b - a) / (a - c)
        a = price
        b_price = pe_range_high * eps
        c_price = pe_range_low * eps
        
        # 如果 a > b，設定為 b 的 PE 改用近一季最高 PE
        if a > b_price:
            b_price = pe_max_recent * eps

        # 當 a < c 時，將 c 設定為現價的 90%
        if a < c_price:
            c_price = a * 0.9
            
        risk = a - c_price
        reward = b_price - a
        
        if risk > 0:
            odds = max(0, reward / risk)
        else:
            odds = 10 if reward > 0 else 0

        print(f"\n--- {company_name} ({ticker_symbol.upper()}) 分析報告 ---")
        print(f"當前股價: {price:.2f} {currency}")
        print(f"EPS (TTM): {eps:.2f}")
        print(f"當前 P/E: {pe_current:.2f}x")
        print(f"3年歷史平均 P/E (μ): {pe_mean:.2f}x")
        print(f"標準差 (σ): {pe_std:.2f}x")
        print(f"歷史百分位: {pe_percentile:.1f}%")
        print(f"乖離率: {bias_rate:.1f}% {'[警告: 乖離過高]' if is_high_bias else ''}")
        print(f"計算賠率 (b): {odds:.2f}")

        # Scenarios
        pegs = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0]
        win_rates = [0.8, 0.65, 0.55, 0.4, 0.3, 0.2]
        
        results = []
        for peg, p in zip(pegs, win_rates):
            implied_growth = (pe_current / peg)
            kelly_f = calculate_kelly(p, odds)
            
            # 如果乖離率 > 20% ，凱利公式應強制切換為 「1/8 凱利」
            fraction_label = "1/8 Kelly" if is_high_bias else "1/4 Kelly"
            fraction_val = kelly_f * 0.125 if is_high_bias else kelly_f * 0.25

            results.append({
                "假設 PEG": peg,
                "勝率 (p)": f"{p*100:.0f}%",
                "賠率 (b)": f"{odds:.2f}",
                "隱含成長率 (G)": f"{implied_growth:.2f}%",
                "建議倉位 (Kelly)": f"{kelly_f*100:.1f}%",
                f"建議倉位 ({fraction_label})": f"{fraction_val*100:.1f}%",
                "風險": "HIGH RISK" if implied_growth > 30 else "NORMAL"
            })

        df = pd.DataFrame(results)
        print("\nPEG 多元情境分析表:")
        print(df.to_markdown(index=False))
        return df

    except Exception as e:
        print(f"發生錯誤: {e}")
        return None

if __name__ == "__main__":
    while True:
        ticker = input("\n請輸入股票代號 (如 AAPL 或 2330.TW, 輸入 'q' 離開): ").strip()
        if ticker.lower() == 'q':
            break
        if not ticker:
            continue
        analyze_stock(ticker)
