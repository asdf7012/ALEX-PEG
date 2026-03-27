
import React, { useState } from 'react';
import { fetchStockData, fetchStockNews } from './services/geminiService';
import { StockData, AnalysisScenario, NewsItem } from './types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Cell 
} from 'recharts';

const PEGS = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0];
const WIN_RATES = [0.8, 0.65, 0.55, 0.4, 0.3, 0.2]; 

const App: React.FC = () => {
  const [tickerInput, setTickerInput] = useState('');
  const [manualEps, setManualEps] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [scenarios, setScenarios] = useState<AnalysisScenario[]>([]);

  const calculateKelly = (p: number, b: number) => {
    const q = 1 - p;
    if (b <= 0) return 0;
    const f = (b * p - q) / b;
    return Math.max(0, f);
  };

  const runAnalysis = (data: StockData, epsToUse: number) => {
    const a = data.price;
    const meanPrice = data.peMean * epsToUse;
    const biasRate = ((a - meanPrice) / meanPrice) * 100;
    const maBias150 = data.ma150 > 0 ? ((a - data.ma150) / data.ma150) * 100 : 0;
    const maBias200 = data.ma200 > 0 ? ((a - data.ma200) / data.ma200) * 100 : 0;
    const isHighBias = biasRate > 20;

    let b_price = data.peRangeHigh * epsToUse;
    let c_price = data.peRangeLow * epsToUse;
    
    if (a > b_price) {
      b_price = data.peMaxRecentQuarter * epsToUse;
    }

    if (a < c_price) {
      c_price = a * 0.9;
    }
    
    const risk = a - c_price;
    const reward = b_price - a;
    const calculatedOdds = risk > 0 ? Math.max(0, reward / risk) : (reward > 0 ? 10 : 0);

    const currentPe = epsToUse !== 0 ? a / epsToUse : 0;

    const calculatedScenarios = PEGS.map((peg, index) => {
      const winRate = WIN_RATES[index];
      const odds = calculatedOdds;
      const impliedGrowth = (currentPe / peg);
      const targetPrice = epsToUse * impliedGrowth * peg;
      const kellyFraction = calculateKelly(winRate, odds);
      
      const kellyFractionQuarter = isHighBias ? kellyFraction * 0.125 : kellyFraction * 0.25;
      
      return {
        peg,
        winRate,
        odds,
        impliedGrowth,
        targetPrice,
        kellyFraction,
        kellyFractionQuarter,
        biasRate,
        maBias150,
        maBias200,
        isHighBias,
        riskStatus: impliedGrowth > 30 ? 'HIGH_RISK' : 'NORMAL'
      } as AnalysisScenario;
    });

    setScenarios(calculatedScenarios);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerInput.trim()) return;

    setLoading(true);
    setError(null);
    setStockData(null);
    setNews([]);
    setScenarios([]);

    try {
      const [data, stockNews] = await Promise.all([
        fetchStockData(tickerInput),
        fetchStockNews(tickerInput)
      ]);
      
      setStockData(data);
      setNews(stockNews);
      setManualEps(data.eps.toString());

      runAnalysis(data, data.eps);
    } catch (err: any) {
      setError(err.message || '無法取得數據，請確認代號是否正確。');
    } finally {
      setLoading(false);
    }
  };

  const handleManualEpsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualEps(e.target.value);
  };

  const handleReAnalyze = () => {
    if (!stockData) return;
    const epsValue = parseFloat(manualEps);
    if (isNaN(epsValue)) return;
    runAnalysis(stockData, epsValue);
  };

  const getPeIndicatorColor = (percentile: number) => {
    if (percentile > 80) return 'text-red-500';
    if (percentile < 20) return 'text-green-500';
    return 'text-blue-500';
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto text-slate-800">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2 flex items-center justify-center gap-3">
          <i className="fas fa-chart-line text-blue-600"></i>
          PEG & 凱利公式策略分析器 v3.2
        </h1>
        <p className="text-slate-500">3年歷史 P/E 統計分析：平均值 (μ)、標準差 (σ) 與 百分位 (Percentile)</p>
      </header>

      <section className="bg-white p-6 rounded-2xl shadow-sm mb-8 border border-slate-100 sticky top-4 z-10">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <i className="fas fa-search"></i>
            </span>
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              placeholder="輸入代號 (如: NVDA, 2454.TW)"
              className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-600 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all text-lg font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt"></i>}
            {loading ? '分析中...' : '開始分析'}
          </button>
        </form>
        {error && <p className="mt-3 text-red-500 text-sm font-medium"><i className="fas fa-exclamation-circle mr-1"></i> {error}</p>}
      </section>

      {stockData && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">標的名 / 代號</p>
              <h2 className="text-xl font-bold text-slate-800 truncate">{stockData.companyName}</h2>
              <p className="text-sm font-mono text-blue-600">{stockData.ticker}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">當前 P/E & 百分位</p>
              <h2 className="text-2xl font-bold text-slate-800">{stockData.pe.toFixed(2)}x</h2>
              <div className={`text-xs font-bold flex items-center gap-1 mt-1 ${getPeIndicatorColor(stockData.pePercentile)}`}>
                <i className="fas fa-tachometer-alt"></i>
                3年歷史百分位: {stockData.pePercentile.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">3年 歷史平均 P/E (μ)</p>
              <h2 className="text-2xl font-bold text-slate-800">{stockData.peMean.toFixed(2)}x</h2>
              <p className="text-xs text-slate-400 mt-1">±1標準差範圍: {stockData.peRangeLow.toFixed(1)}x - {stockData.peRangeHigh.toFixed(1)}x</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">股價 / 每股盈餘</p>
              <h2 className="text-2xl font-bold text-slate-800">{stockData.price.toFixed(2)} <span className="text-sm font-normal text-slate-500">{stockData.currency}</span></h2>
              {(() => {
                const epsToUse = parseFloat(manualEps) || stockData.eps;
                const meanPrice = stockData.peMean * epsToUse;
                const biasRate = ((stockData.price - meanPrice) / meanPrice) * 100;
                const maBias150 = stockData.ma150 > 0 ? ((stockData.price - stockData.ma150) / stockData.ma150) * 100 : 0;
                const maBias200 = stockData.ma200 > 0 ? ((stockData.price - stockData.ma200) / stockData.ma200) * 100 : 0;
                return (
                  <div className="flex flex-col gap-1 mt-1">
                    <p className={`text-xs font-bold ${biasRate >= 20 ? 'text-red-500' : 'text-green-600'}`}>
                      乖離率 (PE): {biasRate.toFixed(2)}%
                    </p>
                    <div className="pt-1 border-t border-slate-50">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter">均線乖離 (參考用)</p>
                      <div className="flex gap-2">
                        <p className="text-[10px] font-medium text-slate-500">150MA: {maBias150.toFixed(1)}%</p>
                        <p className="text-[10px] font-medium text-slate-500">200MA: {maBias200.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    step="0.01"
                    value={manualEps}
                    onChange={handleManualEpsChange}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="輸入自定義 EPS"
                  />
                  <button 
                    onClick={handleReAnalyze}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    重算
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">當前 EPS (TTM): {stockData.eps.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Volume Alert */}
          {stockData.volumeRecent > stockData.volumeAvg3m * 1.3 && (
            <div className="mb-8 bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                <i className="fas fa-chart-bar"></i>
              </div>
              <div>
                <h4 className="font-bold text-orange-800 text-sm">成交量異常示警</h4>
                <p className="text-xs text-orange-700">
                  最近一日成交量 ({stockData.volumeRecent.toLocaleString()}) 大於 3個月平均 ({stockData.volumeAvg3m.toLocaleString()}) 的 30% 以上。
                </p>
              </div>
            </div>
          )}

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <div>
                <h3 className="font-bold text-slate-700">PEG 多元情境分析表 (Max PEG 2.0)</h3>
                <p className="text-xs text-blue-600 font-medium">基於 36 個月歷史 PE 序列計算 (Mean ± 1σ)</p>
              </div>
              <div className="text-xs text-slate-400 flex gap-4">
                <span>歷史平均 μ: {stockData.peMean.toFixed(1)}</span>
                <span>標準差 σ: {stockData.peStdDev.toFixed(2)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-500 text-xs uppercase border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">假設 PEG</th>
                    <th className="px-6 py-4 font-semibold">勝率 (p)</th>
                    <th className="px-6 py-4 font-semibold">賠率 (b)</th>
                    <th className="px-6 py-4 font-semibold">隱含成長率 (G)</th>
                    <th className="px-6 py-4 font-semibold">3年歷史P/E (μ ± 1σ)</th>
                    <th className="px-6 py-4 font-semibold">建議倉位 (Kelly)</th>
                    <th className="px-6 py-4 font-semibold">建議倉位 ({scenarios[0]?.isHighBias ? '1/8' : '1/4'} Kelly)</th>
                    <th className="px-6 py-4 font-semibold">均線乖離 (參考)</th>
                    <th className="px-6 py-4 font-semibold text-right">風險</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scenarios.map((s, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700">{s.peg.toFixed(1)}</td>
                        <td className="px-6 py-4 text-slate-600">{(s.winRate * 100).toFixed(0)}%</td>
                        <td className="px-6 py-4 text-slate-600 font-mono">{s.odds.toFixed(1)}</td>
                        <td className={`px-6 py-4 font-mono font-bold ${s.riskStatus === 'HIGH_RISK' ? 'text-red-500' : 'text-slate-800'}`}>
                          {s.impliedGrowth.toFixed(2)}%
                          {s.riskStatus === 'HIGH_RISK' && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded tracking-tighter">HIGH RISK</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium">
                          <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                            {stockData.peRangeLow.toFixed(1)}x - {stockData.peRangeHigh.toFixed(1)}x
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${s.kellyFraction > 0.5 ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${s.kellyFraction * 100}%` }}></div>
                            </div>
                            <span className="font-medium text-slate-700">{(s.kellyFraction * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className={`font-bold ${s.isHighBias ? 'text-orange-600' : 'text-blue-700'}`}>{(s.kellyFractionQuarter * 100).toFixed(1)}%</span>
                            {s.isHighBias && <span className="text-[9px] text-orange-500 font-bold leading-tight">乖離率過高 ({s.biasRate.toFixed(1)}%)<br/>強制 1/8 凱利</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-[10px] text-slate-500">
                            <span>150MA: {s.maBias150.toFixed(1)}%</span>
                            <span>200MA: {s.maBias200.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {s.riskStatus === 'HIGH_RISK' ? (
                            <span className="text-red-500 animate-pulse"><i className="fas fa-exclamation-triangle"></i></span>
                          ) : (
                            <span className="text-green-500"><i className="fas fa-check-circle"></i></span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                <i className="fas fa-chart-line text-blue-500"></i>
                日 K 線圖 (30日)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...stockData.dailyKLines].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 10}} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="low" stroke="#22c55e" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-500"></span> 最高</span>
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-green-500"></span> 最低</span>
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-500"></span> 收盤</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                <i className="fas fa-chart-line text-blue-500"></i>
                週 K 線圖 (24週)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...stockData.weeklyKLines].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 10}} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="low" stroke="#22c55e" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-500"></span> 最高</span>
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-green-500"></span> 最低</span>
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-500"></span> 收盤</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                <i className="fas fa-history text-blue-500"></i>
                3年歷史 P/E 走勢圖
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...stockData.peHistory].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 10}} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value.toFixed(2)}x`, 'P/E Ratio']}
                    />
                    {/* Mean Line */}
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      dot={{ r: 4 }} 
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span>歷史 P/E</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <i className="fas fa-info-circle"></i>
                  <span>平均值 (μ): {stockData.peMean.toFixed(2)}x</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <i className="fas fa-arrows-alt-v"></i>
                  <span>標準差 (σ): {stockData.peStdDev.toFixed(2)}x</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                <i className="fas fa-chart-line text-blue-500"></i>
                假設 PEG vs 隱含成長率 (G)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scenarios}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="peg" label={{ value: '假設 PEG', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Growth %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="impliedGrowth" stroke="#2563eb" strokeWidth={3} dot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                <i className="fas fa-wallet text-blue-500"></i>
                凱利公式建議分配 (f*)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarios}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="peg" label={{ value: '假設 PEG', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Allocation %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="kellyFraction" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent News Section */}
          <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
              <i className="fas fa-newspaper text-blue-500"></i>
              近期相關財經新聞
            </h3>
            {news.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {news.map((item, idx) => (
                  <a 
                    key={idx} 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group block p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">{item.source}</span>
                      <span className="text-xs text-slate-400">{item.date}</span>
                    </div>
                    <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors mb-2 line-clamp-2">
                      {item.title}
                    </h4>
                    <p className="text-sm text-slate-500 line-clamp-2">{item.snippet}</p>
                    <div className="mt-3 text-xs text-blue-500 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      閱讀更多 <i className="fas fa-arrow-right text-[10px]"></i>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 italic">
                暫無近期相關新聞數據
              </div>
            )}
          </section>

          <footer className="text-center text-slate-400 text-xs py-8 border-t border-slate-100 mt-8">
            <p>免責聲明：本工具僅供學術研究與參考，不構成任何投資建議。投資有風險，入市需謹慎。</p>
            <p className="mt-2 text-orange-500 font-medium">示警機制：當股價高於歷史平均+1σ (a &gt; b) 時，目標 P/E 改用近一季最高 P/E；當 PE 乖離率 &gt; 20% 時，強制採用 1/8 凱利。</p>
            <p className="mt-1">數據來源：Gemini 3 Flash 實時檢索與統計模擬</p>
          </footer>
        </div>
      )}

      {!stockData && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <i className="fas fa-search-dollar text-6xl mb-4"></i>
          <p className="text-lg font-medium">輸入一個美股或台股代號（如 2330.TW）</p>
        </div>
      )}
    </div>
  );
};

export default App;
