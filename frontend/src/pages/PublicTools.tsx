/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiRefreshCw,
  FiArrowRight,
  FiArrowDown,
  FiShield,
  FiCpu,
  FiUploadCloud,
  FiCheckCircle,
  FiAlertTriangle,
  FiFileText,
  FiSearch,
  FiDatabase,
  FiActivity,
  FiEye,
  FiHeart,
} from "react-icons/fi";
import ThemeToggle from "../components/ui/ThemeToggle";

/* ═══════════════════════════════════════════════════════════════
   SHARED NAV — lightweight top bar for public tool pages
   ═══════════════════════════════════════════════════════════════ */

function ToolNav({ title, subtitle }: { title: string; subtitle: string }) {
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center font-black text-xs text-white shadow-[0_0_12px_rgba(192,38,211,0.4)] group-hover:shadow-[0_0_20px_rgba(192,38,211,0.6)] transition-shadow">
              M
            </div>
            <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors hidden sm:inline">
              MedTrustFund
            </span>
          </button>
          <div className="hidden sm:block w-px h-6 bg-white/10 mx-1" />
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-white leading-none">{title}</h1>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/eth-converter"
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Converter
          </Link>
          <Link
            to="/ai-verification"
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            AI Pipeline
          </Link>
          <Link
            to="/campaigns"
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors hidden sm:block"
          >
            Campaigns
          </Link>
          <ThemeToggle />
          <Link
            to="/signup"
            className="px-4 py-1.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-[0_0_12px_rgba(192,38,211,0.25)] hover:shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1. ETH ↔ INR LIVE CONVERTER
   ═══════════════════════════════════════════════════════════════ */

interface PriceData {
  inr: number;
  usd: number;
  inr_24h_change: number;
  usd_24h_change: number;
  last_updated_at: number;
}

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

const PRESETS_INR = [1000, 5000, 10000, 50000, 100000];
const PRESETS_ETH = [0.01, 0.05, 0.1, 0.5, 1];

export function EthConverter() {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<"inr_to_eth" | "eth_to_inr">("inr_to_eth");
  const [inputValue, setInputValue] = useState("10000");
  const [refreshing, setRefreshing] = useState(false);

  const loadPrice = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchEthPrice();
      setPrice(data);
      setError("");
    } catch {
      setError("Could not fetch live price. Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPrice();
    // Auto-refresh every 60s
    const interval = setInterval(() => { loadPrice(); }, 60000);
    return () => clearInterval(interval);
  }, [loadPrice]);

  const numValue = parseFloat(inputValue) || 0;

  const converted = useMemo(() => {
    if (!price) return { value: 0, symbol: "" };
    if (direction === "inr_to_eth") {
      return { value: numValue / price.inr, symbol: "ETH" };
    }
    return { value: numValue * price.inr, symbol: "INR" };
  }, [numValue, direction, price]);

  const usdEquivalent = useMemo(() => {
    if (!price) return 0;
    if (direction === "inr_to_eth") return converted.value * price.usd;
    return numValue * price.usd;
  }, [numValue, converted.value, direction, price]);

  const presets = direction === "inr_to_eth" ? PRESETS_INR : PRESETS_ETH;
  const inputSymbol = direction === "inr_to_eth" ? "₹" : "Ξ";
  const outputSymbol = direction === "inr_to_eth" ? "Ξ" : "₹";

  const formatOutput = (val: number) => {
    if (direction === "inr_to_eth") return val.toFixed(6);
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  return (
    <div className="min-h-screen bg-[#070514] text-white relative overflow-hidden selection:bg-fuchsia-500/40">
      {/* Background */}
      <div className="fixed inset-0 bg-[url('https://api.typedream.com/v0/document/public/80f7bc74-6869-45d2-a7d5-dacedaab59f7_Noise_Background_png.png')] opacity-[0.08] pointer-events-none mix-blend-overlay z-0" />
      <motion.div animate={{ y: [0, 30, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-fuchsia-600/15 rounded-full blur-[180px] pointer-events-none" />
      <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none" />

      <ToolNav title="ETH ↔ INR Converter" subtitle="Live Ethereum prices" />

      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full text-fuchsia-400 text-xs font-bold tracking-widest uppercase mb-4">
            <FiActivity className="w-3 h-3" /> Live Price
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            ETH <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400">↔</span> INR Converter
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Calculate how much your donation is worth before contributing to a campaign. Prices update every 60 seconds from CoinGecko.
          </p>
        </motion.div>

        {/* Live Price Strip */}
        {price && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">ETH / INR</p>
              <p className="text-lg font-black text-white">₹{price.inr.toLocaleString("en-IN")}</p>
              <p className={`text-xs font-bold ${price.inr_24h_change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {price.inr_24h_change >= 0 ? "+" : ""}{price.inr_24h_change.toFixed(2)}%
              </p>
            </div>
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">ETH / USD</p>
              <p className="text-lg font-black text-white">${price.usd.toLocaleString()}</p>
              <p className={`text-xs font-bold ${price.usd_24h_change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {price.usd_24h_change >= 0 ? "+" : ""}{price.usd_24h_change.toFixed(2)}%
              </p>
            </div>
            <button
              onClick={() => loadPrice(true)}
              disabled={refreshing}
              className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Refresh price"
            >
              <FiRefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </motion.div>
        )}

        {loading && (
          <div className="text-center py-8">
            <FiRefreshCw className="w-6 h-6 text-purple-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Fetching live ETH price...</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 mb-6 text-center text-rose-300 text-sm">
            {error}
          </div>
        )}

        {price && !loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {/* Converter Card */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_8px_60px_rgba(0,0,0,0.5)]">
              {/* Input section */}
              <div className="mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  {direction === "inr_to_eth" ? "You have (INR)" : "You have (ETH)"}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">
                    {inputSymbol}
                  </span>
                  <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white/[0.04] border border-white/10 rounded-2xl text-2xl font-black text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/30 transition-all"
                    placeholder="0"
                    min="0"
                    step="any"
                  />
                </div>
                {/* Quick presets */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {presets.map((p) => (
                    <button
                      key={p}
                      onClick={() => setInputValue(String(p))}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        inputValue === String(p)
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : "bg-white/[0.03] text-slate-500 border-white/5 hover:bg-white/[0.06] hover:text-slate-300"
                      }`}
                    >
                      {direction === "inr_to_eth" ? `₹${p.toLocaleString("en-IN")}` : `${p} ETH`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Swap button */}
              <div className="flex justify-center my-4">
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setDirection((d) => (d === "inr_to_eth" ? "eth_to_inr" : "inr_to_eth"));
                    setInputValue("");
                  }}
                  className="p-3 bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/20 border border-white/10 rounded-2xl text-purple-400 hover:text-white transition-colors shadow-lg"
                >
                  <FiArrowDown className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Output section */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  {direction === "inr_to_eth" ? "You get (ETH)" : "You get (INR)"}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">
                    {outputSymbol}
                  </span>
                  <div className="w-full pl-12 pr-4 py-4 bg-white/[0.04] border border-white/10 rounded-2xl text-2xl font-black text-emerald-400 min-h-[60px] flex items-center">
                    {numValue > 0 ? formatOutput(converted.value) : "—"}
                  </div>
                </div>
                {numValue > 0 && (
                  <p className="text-xs text-slate-500 mt-2 ml-1">
                    ≈ ${usdEquivalent.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                  </p>
                )}
              </div>

              {/* Rate info */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-600">
                <span>1 ETH = ₹{price.inr.toLocaleString("en-IN")} INR</span>
                <span>
                  Updated {new Date(price.last_updated_at * 1000).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* CTA */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center mt-8">
              <Link
                to="/campaigns"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(192,38,211,0.3)] hover:shadow-[0_0_30px_rgba(192,38,211,0.5)] transition-all text-sm"
              >
                <FiHeart className="w-4 h-4" /> Browse Campaigns to Donate
                <FiArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. AI VERIFICATION EXPLAINER — animated pipeline walkthrough
   ═══════════════════════════════════════════════════════════════ */

interface PipelineStep {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
  details: string[];
  formula?: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "upload",
    title: "Document Upload",
    subtitle: "Patient submits medical records",
    icon: <FiUploadCloud className="w-6 h-6" />,
    color: "from-cyan-500 to-blue-500",
    glow: "rgba(6,182,212,0.3)",
    details: [
      "Accepts PDF, JPEG, and PNG documents",
      "Max 10 files per request (10 MB each)",
      "Documents include: identity proof, diagnosis reports, admission letters, cost estimates",
      "Files are encrypted with AES-256 before storage",
    ],
  },
  {
    id: "ocr",
    title: "OCR Text Extraction",
    subtitle: "Stage 1 — 10-15 second processing",
    icon: <FiFileText className="w-6 h-6" />,
    color: "from-fuchsia-500 to-purple-500",
    glow: "rgba(192,38,211,0.3)",
    details: [
      "PDFs parsed via PyMuPDF (fitz) for native text layers",
      "Images processed through Tesseract OCR engine",
      "Document type auto-classified: identity, diagnosis, admission, cost estimate",
      "Patient name extracted via regex pattern matching",
    ],
  },
  {
    id: "tampering",
    title: "Tampering Detection",
    subtitle: "Stage 2 — Image forensics analysis",
    icon: <FiSearch className="w-6 h-6" />,
    color: "from-amber-500 to-orange-500",
    glow: "rgba(245,158,11,0.3)",
    details: [
      "File size anomaly check — suspiciously small files flagged",
      "EXIF metadata presence validation — stripped metadata penalized",
      "Resolution analysis — unusual dimensions indicate upsampling",
      "JPEG compression ratio analysis to detect manipulation artifacts",
    ],
  },
  {
    id: "ai",
    title: "AI Content Analysis",
    subtitle: "Stage 3 — Forgery probability scoring",
    icon: <FiCpu className="w-6 h-6" />,
    color: "from-emerald-500 to-teal-500",
    glow: "rgba(16,185,129,0.3)",
    details: [
      "Detects generic template language patterns (AI-generated content)",
      "Word frequency analysis for repetition anomalies",
      "Medical keyword coverage check — low coverage = suspicious",
      "Document length validation — excessively short documents flagged",
    ],
  },
  {
    id: "metadata",
    title: "Cross-Document Validation",
    subtitle: "Stage 4 — Metadata consistency check",
    icon: <FiDatabase className="w-6 h-6" />,
    color: "from-indigo-500 to-violet-500",
    glow: "rgba(99,102,241,0.3)",
    details: [
      "Patient name consistency across all uploaded documents",
      "Date range plausibility — flags unreasonable time spans",
      "Document creator/producer software fingerprint comparison",
      "Multiple mismatched names trigger high mismatch penalty",
    ],
  },
  {
    id: "risk",
    title: "Weighted Risk Score",
    subtitle: "Final verdict — automated decision engine",
    icon: <FiShield className="w-6 h-6" />,
    color: "from-rose-500 to-pink-500",
    glow: "rgba(244,63,94,0.3)",
    details: [
      "Score < 40: Low Risk → auto-approved for publication",
      "Score 40-70: Medium Risk → advisory note shown to donors",
      "Score > 70: High Risk → escalated for admin manual review",
      "Hospital-verified documents receive a 20% risk reduction",
    ],
    formula: "RiskScore = 0.35 × Tampering + 0.35 × AI Probability + 0.30 × Metadata Mismatch",
  },
];

export function AIVerificationExplainer() {
  const [activeStep, setActiveStep] = useState<string>("upload");
  const [autoPlay, setAutoPlay] = useState(true);

  // Auto-cycle through steps
  useEffect(() => {
    if (!autoPlay) return;
    const idx = PIPELINE_STEPS.findIndex((s) => s.id === activeStep);
    const timer = setTimeout(() => {
      const next = (idx + 1) % PIPELINE_STEPS.length;
      setActiveStep(PIPELINE_STEPS[next].id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [activeStep, autoPlay]);

  const currentStep = PIPELINE_STEPS.find((s) => s.id === activeStep)!;
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div className="min-h-screen bg-[#070514] text-white relative overflow-hidden selection:bg-fuchsia-500/40">
      {/* Background */}
      <div className="fixed inset-0 bg-[url('https://api.typedream.com/v0/document/public/80f7bc74-6869-45d2-a7d5-dacedaab59f7_Noise_Background_png.png')] opacity-[0.08] pointer-events-none mix-blend-overlay z-0" />
      <motion.div animate={{ y: [0, 25, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[180px] pointer-events-none" />
      <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[150px] pointer-events-none" />

      <ToolNav title="AI Verification Pipeline" subtitle="How we detect fraud" />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4">
            <FiCpu className="w-3 h-3" /> Deep Learning Pipeline
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            How Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">AI Verification</span> Works
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
            Every campaign undergoes a 6-stage automated verification pipeline before going live.
            Our isolated Python Neural Network cross-references documents in real-time to block fabricated medical invoices.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left — Step Timeline */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pipeline Stages</h2>
              <button
                onClick={() => setAutoPlay((p) => !p)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                  autoPlay
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-white/5 text-slate-500 border-white/10"
                }`}
              >
                {autoPlay ? "Auto-playing" : "Paused"}
              </button>
            </div>

            {PIPELINE_STEPS.map((step, i) => {
              const isActive = step.id === activeStep;
              return (
                <motion.button
                  key={step.id}
                  whileHover={{ x: 4 }}
                  onClick={() => {
                    setActiveStep(step.id);
                    setAutoPlay(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 flex items-center gap-3 relative overflow-hidden ${
                    isActive
                      ? "border-white/15 shadow-[0_0_20px_rgba(0,0,0,0.3)]"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                  style={isActive ? { background: `linear-gradient(135deg, rgba(0,0,0,0.5), rgba(0,0,0,0.3))` } : {}}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeStepGlow"
                      className={`absolute inset-0 bg-gradient-to-r ${step.color} opacity-[0.07] pointer-events-none`}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isActive
                        ? `bg-gradient-to-br ${step.color} text-white shadow-lg`
                        : "bg-white/5 text-slate-500 border border-white/10"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0 relative z-10">
                    <p className={`text-sm font-bold transition-colors ${isActive ? "text-white" : "text-slate-300"}`}>
                      {step.title}
                    </p>
                    <p className={`text-[11px] truncate transition-colors ${isActive ? "text-slate-400" : "text-slate-600"}`}>
                      {step.subtitle}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 transition-colors ${isActive ? "text-slate-400" : "text-slate-700"}`}>
                    {i + 1}/{PIPELINE_STEPS.length}
                  </span>
                </motion.button>
              );
            })}

            {/* Auto-play progress bar */}
            {autoPlay && (
              <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-3">
                <motion.div
                  key={activeStep}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "linear" }}
                  className={`h-full bg-gradient-to-r ${currentStep.color} rounded-full`}
                />
              </div>
            )}
          </div>

          {/* Right — Step Detail Panel */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 backdrop-blur-2xl p-6 sm:p-8 relative overflow-hidden shadow-[0_8px_60px_rgba(0,0,0,0.4)]"
              >
                {/* Glow */}
                <div
                  className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-[100px] pointer-events-none opacity-30"
                  style={{ background: currentStep.glow }}
                />

                {/* Header */}
                <div className="flex items-start gap-4 mb-6 relative z-10">
                  <div className={`p-3 rounded-2xl bg-gradient-to-br ${currentStep.color} text-white shadow-lg`}>
                    {currentStep.icon}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                      Stage {currentIndex + 1} of {PIPELINE_STEPS.length}
                    </p>
                    <h2 className="text-2xl font-black text-white">{currentStep.title}</h2>
                    <p className="text-sm text-slate-400 mt-1">{currentStep.subtitle}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 relative z-10">
                  {currentStep.details.map((detail, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                    >
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${currentStep.color} flex items-center justify-center shrink-0 mt-0.5`}>
                        <span className="text-[10px] font-black text-white">{i + 1}</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{detail}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Formula */}
                {currentStep.formula && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-6 p-4 rounded-2xl bg-black/40 border border-white/10 relative z-10"
                  >
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">SRS v2.0 Formula</p>
                    <p className="text-sm font-mono text-emerald-400 break-all leading-relaxed">
                      {currentStep.formula}
                    </p>
                  </motion.div>
                )}

                {/* Flow arrow to next step */}
                {currentIndex < PIPELINE_STEPS.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 flex justify-end relative z-10"
                  >
                    <button
                      onClick={() => {
                        setActiveStep(PIPELINE_STEPS[currentIndex + 1].id);
                        setAutoPlay(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors group"
                    >
                      Next: {PIPELINE_STEPS[currentIndex + 1].title}
                      <FiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </motion.div>
                )}

                {/* Final verdict visual for last step */}
                {currentIndex === PIPELINE_STEPS.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 grid grid-cols-3 gap-3 relative z-10"
                  >
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <FiCheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                      <p className="text-xs font-bold text-emerald-400">Low Risk</p>
                      <p className="text-[10px] text-slate-500">Score &lt; 40</p>
                      <p className="text-[10px] text-slate-600 mt-1">Auto-approve</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                      <FiAlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                      <p className="text-xs font-bold text-amber-400">Medium Risk</p>
                      <p className="text-[10px] text-slate-500">Score 40–70</p>
                      <p className="text-[10px] text-slate-600 mt-1">Donor advisory</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                      <FiShield className="w-5 h-5 text-rose-400 mx-auto mb-1" />
                      <p className="text-xs font-bold text-rose-400">High Risk</p>
                      <p className="text-[10px] text-slate-500">Score &gt; 70</p>
                      <p className="text-[10px] text-slate-600 mt-1">Admin review</p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-center mt-12">
          <p className="text-slate-500 text-sm mb-4">
            Ready to submit a campaign through our verified pipeline?
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(192,38,211,0.3)] hover:shadow-[0_0_30px_rgba(192,38,211,0.5)] transition-all text-sm"
            >
              Get Started <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/campaigns"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-slate-300 hover:text-white font-semibold rounded-xl hover:bg-white/10 transition-all text-sm"
            >
              <FiEye className="w-4 h-4" /> View Campaigns
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}