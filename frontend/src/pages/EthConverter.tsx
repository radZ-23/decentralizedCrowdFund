import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiRefreshCw,
  FiArrowDown,
  FiChevronLeft,
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiInfo,
} from "react-icons/fi";
import ThemeToggle from "../components/ui/ThemeToggle";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface PriceData {
  inr: number;
  usd: number;
  inr_24h_change: number;
  usd_24h_change: number;
  last_updated_at: number;
}

interface HistoryPoint {
  time: string;
  price: number;
}

/* ═══════════════════════════════════════════════════════════════
   Fetch helpers — CoinGecko free API (no key needed)
   ═══════════════════════════════════════════════════════════════ */

async function fetchEthPrice(): Promise<PriceData> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=inr,usd&include_24hr_change=true&include_last_updated_at=true"
  );
  if (!res.ok) throw new Error("Failed to fetch price");
  const data = await res.json();
  return {
    inr: data.ethereum.inr,
    usd: data.ethereum.usd,
    inr_24h_change: data.ethereum.inr_24h_change,
    usd_24h_change: data.ethereum.usd_24h_change,
    last_updated_at: data.ethereum.last_updated_at,
  };
}

async function fetchPriceHistory(): Promise<HistoryPoint[]> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=inr&days=7&interval=daily"
  );
  if (!res.ok) throw new Error("Failed to fetch history");
  const data = await res.json();
  return data.prices.map(([timestamp, price]: [number, number]) => ({
    time: new Date(timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    price: Math.round(price),
  }));
}

/* ═══════════════════════════════════════════════════════════════
   Sparkline mini chart (pure SVG, no library needed)
   ═══════════════════════════════════════════════════════════════ */

function Sparkline({ data, color }: { data: HistoryPoint[]; color: string }) {
  if (data.length < 2) return null;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const width = 280;
  const height = 80;
  const padding = 4;

  const points = prices.map((p, i) => {
    const x = padding + (i / (prices.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${width - padding},${height} L${padding},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkFill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Latest point dot */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].split(",")[0]}
          cy={points[points.length - 1].split(",")[1]}
          r="3"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function EthConverter() {
  const navigate = useNavigate();
  const [price, setPrice] = useState<PriceData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Converter state
  const [ethAmount, setEthAmount] = useState("1");
  const [inrAmount, setInrAmount] = useState("");
  const [direction, setDirection] = useState<"eth2inr" | "inr2eth">("eth2inr");

  // Preset amounts for quick convert
  const ethPresets = ["0.01", "0.05", "0.1", "0.5", "1", "5"];
  const inrPresets = ["1000", "5000", "10000", "50000", "100000"];

  const loadData = useCallback(async () => {
    try {
      const [priceData, historyData] = await Promise.all([
        fetchEthPrice(),
        fetchPriceHistory(),
      ]);
      setPrice(priceData);
      setHistory(historyData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Unable to fetch live prices. CoinGecko may be rate-limiting.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Sync converter amounts
  useEffect(() => {
    if (!price) return;
    if (direction === "eth2inr") {
      const eth = parseFloat(ethAmount);
      if (!isNaN(eth)) {
        setInrAmount((eth * price.inr).toFixed(2));
      }
    } else {
      const inr = parseFloat(inrAmount);
      if (!isNaN(inr)) {
        setEthAmount((inr / price.inr).toFixed(6));
      }
    }
  }, [ethAmount, inrAmount, direction, price]);

  const flipDirection = () => {
    setDirection((prev) => (prev === "eth2inr" ? "inr2eth" : "eth2inr"));
  };

  const isUp = (price?.inr_24h_change ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-[#070514] text-white relative overflow-hidden selection:bg-fuchsia-500/40">
      {/* Background */}
      <div className="fixed inset-0 bg-[url('https://api.typedream.com/v0/document/public/80f7bc74-6869-45d2-a7d5-dacedaab59f7_Noise_Background_png.png')] opacity-[0.08] pointer-events-none mix-blend-overlay z-0" />
      <motion.div
        animate={{ y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="fixed top-[-15%] right-[-10%] w-[600px] h-[600px] bg-fuchsia-600/15 rounded-full blur-[180px] pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, -25, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none"
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <FiChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <FiDollarSign className="text-amber-400 w-4 h-4" />
                ETH ↔ INR Converter
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Live prices from CoinGecko &middot; Auto-refreshes every 60s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Refresh prices"
            >
              <FiRefreshCw className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-6 flex items-center gap-2 text-sm text-amber-300"
          >
            <FiInfo className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
              <FiRefreshCw className="w-8 h-8 text-purple-400" />
            </motion.div>
            <p className="text-slate-400 font-medium">Fetching live ETH prices...</p>
          </div>
        ) : price ? (
          <div className="space-y-6">

            {/* ── Live Price Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 backdrop-blur-xl p-6 sm:p-8 relative overflow-hidden"
            >
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg">
                      Ξ
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 font-medium">Ethereum</p>
                      <p className="text-2xl sm:text-3xl font-black text-white">
                        ₹{price.inr.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 ml-[52px]">
                    ${price.usd.toLocaleString("en-US")} USD
                  </p>
                </div>

                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                  isUp
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}>
                  {isUp ? <FiTrendingUp className="w-4 h-4" /> : <FiTrendingDown className="w-4 h-4" />}
                  <span className="font-bold text-sm">
                    {isUp ? "+" : ""}{price.inr_24h_change.toFixed(2)}%
                  </span>
                  <span className="text-xs opacity-60">24h</span>
                </div>
              </div>

              {/* Sparkline */}
              {history.length > 0 && (
                <div className="relative z-10">
                  <Sparkline data={history} color={isUp ? "#10b981" : "#f43f5e"} />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1 px-1">
                    {history.map((h, i) => (
                      <span key={i}>{h.time}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* ── Converter Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 backdrop-blur-xl p-6 sm:p-8 relative overflow-hidden"
            >
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />

              <h2 className="text-lg font-bold text-white mb-6 relative z-10">Quick Convert</h2>

              <div className="space-y-4 relative z-10">
                {/* Top input */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                    {direction === "eth2inr" ? "ETH Amount" : "INR Amount"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                      {direction === "eth2inr" ? "Ξ" : "₹"}
                    </span>
                    <input
                      type="number"
                      value={direction === "eth2inr" ? ethAmount : inrAmount}
                      onChange={(e) => {
                        if (direction === "eth2inr") setEthAmount(e.target.value);
                        else setInrAmount(e.target.value);
                      }}
                      className="w-full pl-10 pr-4 py-3.5 bg-white/[0.04] border border-white/10 rounded-xl text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
                      placeholder="0.00"
                      step="any"
                      min="0"
                    />
                  </div>
                  {/* Presets */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(direction === "eth2inr" ? ethPresets : inrPresets).map((val) => (
                      <button
                        key={val}
                        onClick={() => {
                          if (direction === "eth2inr") setEthAmount(val);
                          else setInrAmount(val);
                        }}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] font-mono text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {direction === "eth2inr" ? `${val} ETH` : `₹${Number(val).toLocaleString("en-IN")}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flip button */}
                <div className="flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 180 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={flipDirection}
                    className="p-3 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-400 hover:bg-purple-500/25 transition-colors"
                  >
                    <FiArrowDown className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Bottom input (readonly) */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                    {direction === "eth2inr" ? "INR Equivalent" : "ETH Equivalent"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                      {direction === "eth2inr" ? "₹" : "Ξ"}
                    </span>
                    <input
                      type="text"
                      value={
                        direction === "eth2inr"
                          ? inrAmount ? Number(inrAmount).toLocaleString("en-IN") : ""
                          : ethAmount
                      }
                      readOnly
                      className="w-full pl-10 pr-4 py-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-emerald-400 font-mono text-lg cursor-default"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Rate info */}
              <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 relative z-10">
                <span>1 ETH = ₹{price.inr.toLocaleString("en-IN")}</span>
                <span>
                  Updated {new Date(price.last_updated_at * 1000).toLocaleTimeString("en-IN")}
                </span>
              </div>
            </motion.div>

            {/* ── Info Banner ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4 flex items-start gap-3"
            >
              <FiInfo className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 leading-relaxed">
                <strong className="text-cyan-300">For donors:</strong> All donations on MedTrustFund are made in ETH.
                Use this converter to understand the INR equivalent before donating.
                Prices are live from CoinGecko and refresh automatically.
              </div>
            </motion.div>
          </div>
        ) : null}
      </main>
    </div>
  );
}