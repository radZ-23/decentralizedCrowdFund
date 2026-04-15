import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUploadCloud,
  FiCpu,
  FiShield,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiChevronLeft,
  FiChevronDown,
  FiLock,
  FiEye,
  FiFileText,
  FiDatabase,
  FiArrowRight,
  FiGlobe,
} from "react-icons/fi";
import ThemeToggle from "../components/ui/ThemeToggle";

/* ═══════════════════════════════════════════════════════════════
   Pipeline step data
   ═══════════════════════════════════════════════════════════════ */

interface PipelineStep {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
  duration: string;
  details: string[];
  techStack: string[];
  visual: React.ReactNode;
}

const STEPS: PipelineStep[] = [
  {
    id: 1,
    title: "Document Upload",
    subtitle: "Patient submits medical records",
    icon: <FiUploadCloud className="w-6 h-6" />,
    color: "from-fuchsia-500 to-purple-500",
    glow: "rgba(192,38,211,0.3)",
    duration: "< 1s",
    details: [
      "Patients upload hospital bills, diagnosis reports, and identity documents through our secure React frontend",
      "Files are validated client-side: only JPEG, PNG, and PDF allowed, max 10 MB each",
      "Documents are encrypted with AES-256 before transmission to the backend",
      "SHA-256 hash is computed for each file to ensure integrity on the blockchain",
    ],
    techStack: ["React Dropzone", "Multer", "AES-256", "SHA-256"],
    visual: (
      <div className="space-y-2">
        {["identity_card.pdf", "hospital_bill.jpg", "diagnosis_report.pdf"].map((f, i) => (
          <motion.div
            key={f}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg"
          >
            <FiFileText className="w-3.5 h-3.5 text-fuchsia-400" />
            <span className="text-xs font-mono text-slate-400">{f}</span>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.5 + i * 0.2, duration: 0.8 }}
              className="flex-1 h-1 bg-fuchsia-500/20 rounded-full overflow-hidden"
            >
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.8 + i * 0.2, duration: 0.6 }}
                className="h-full bg-fuchsia-500 rounded-full"
              />
            </motion.div>
            <FiCheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: 2,
    title: "OCR Extraction",
    subtitle: "Text extraction from documents",
    icon: <FiEye className="w-6 h-6" />,
    color: "from-cyan-500 to-blue-500",
    glow: "rgba(6,182,212,0.3)",
    duration: "10–15s",
    details: [
      "PDFs are processed with PyMuPDF (fitz) for native text extraction from digital documents",
      "Images are run through Tesseract OCR engine for text recognition from scanned documents",
      "Extracted text is normalized to lowercase and fed into the classification pipeline",
      "Document type is auto-detected by keyword matching: identity, diagnosis, admission letter, or cost estimate",
    ],
    techStack: ["PyMuPDF", "Tesseract OCR", "FastAPI", "Python"],
    visual: (
      <div className="bg-black/40 rounded-xl border border-cyan-500/15 p-4 font-mono text-[11px] space-y-1.5">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-cyan-400">
          {">"} Processing hospital_bill.jpg...
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-slate-500">
          {">"} Tesseract OCR: extracting text
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }} className="text-emerald-400">
          {">"} Found: "patient", "hospital", "bill", "treatment"
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="text-amber-400">
          {">"} Document type: cost_estimate (confidence: 4/5 keywords)
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="text-cyan-400">
          {">"} Medical keyword coverage: 87.5%
        </motion.p>
      </div>
    ),
  },
  {
    id: 3,
    title: "AI Fraud Analysis",
    subtitle: "Multi-layer tampering detection",
    icon: <FiCpu className="w-6 h-6" />,
    color: "from-amber-500 to-orange-500",
    glow: "rgba(245,158,11,0.3)",
    duration: "~5s",
    details: [
      "Image tampering detection: checks file size anomalies, EXIF metadata stripping, unusual resolution, and JPEG compression artifacts",
      "AI-generated content detection: analyzes text for generic template patterns, word repetition, and medical terminology coverage",
      "Cross-document metadata validation: checks for inconsistent patient names, document creator mismatches, and date anomalies across uploaded files",
      "Each analysis layer produces an independent 0–100 score",
    ],
    techStack: ["PIL/Pillow", "Heuristic Engine", "Regex NLP", "Metadata Parser"],
    visual: (
      <div className="space-y-3">
        {[
          { label: "Tampering Score", value: 15, max: 100, color: "bg-emerald-500" },
          { label: "AI Probability", value: 22, max: 100, color: "bg-amber-500" },
          { label: "Metadata Mismatch", value: 0, max: 100, color: "bg-cyan-500" },
        ].map((bar, i) => (
          <div key={bar.label}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">{bar.label}</span>
              <span className="font-mono text-slate-500">{bar.value}/100</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${bar.value}%` }}
                transition={{ delay: 0.3 + i * 0.2, duration: 0.8, ease: "easeOut" }}
                className={`h-full ${bar.color} rounded-full`}
              />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 4,
    title: "Risk Score Computation",
    subtitle: "Weighted formula per SRS v2.0",
    icon: <FiShield className="w-6 h-6" />,
    color: "from-emerald-500 to-teal-500",
    glow: "rgba(16,185,129,0.3)",
    duration: "< 1s",
    details: [
      "Final risk score is computed using a weighted formula: RiskScore = w1 × Tampering + w2 × AI_Probability + w3 × Metadata_Mismatch",
      "Weights: Tampering (35%), AI Probability (35%), Metadata Mismatch (30%)",
      "If hospital is pre-verified, a 20% reduction is applied to the final score",
      "Score < 40 = Auto-approved | Score 40–70 = Escalated with advisory | Score > 70 = Manual admin review required",
    ],
    techStack: ["SRS v2.0 Formula", "Weighted Scoring", "Rate Limiting (10/min)"],
    visual: (
      <div className="bg-black/40 rounded-xl border border-emerald-500/15 p-4 space-y-3">
        <div className="font-mono text-[11px] text-slate-400 space-y-1">
          <p>w1 (tampering) = <span className="text-fuchsia-400">0.35</span></p>
          <p>w2 (ai_prob) &nbsp; = <span className="text-fuchsia-400">0.35</span></p>
          <p>w3 (metadata) &nbsp;= <span className="text-fuchsia-400">0.30</span></p>
        </div>
        <div className="border-t border-white/5 pt-3">
          <p className="text-[11px] font-mono text-slate-500">
            Risk = 0.35 × 15 + 0.35 × 22 + 0.30 × 0
          </p>
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg font-black text-emerald-400 mt-2"
          >
            Final Score: 13 / 100
          </motion.p>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">LOW RISK — Auto-Approved</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    title: "Blockchain Anchoring",
    subtitle: "Immutable on-chain record",
    icon: <FiLock className="w-6 h-6" />,
    color: "from-indigo-500 to-violet-500",
    glow: "rgba(99,102,241,0.3)",
    duration: "~12 block confirmations",
    details: [
      "Document SHA-256 hashes are stored on-chain for permanent tamper-proof verification",
      "Admin deploys a MedTrustFundEscrow smart contract bound to the campaign milestones",
      "Donor funds are locked in the escrow — inaccessible to any individual",
      "Only verified hospital confirmations trigger milestone-based fund release on-chain",
    ],
    techStack: ["Solidity 0.8.24", "Hardhat", "ethers.js", "Polygon"],
    visual: (
      <div className="bg-black/40 rounded-xl border border-indigo-500/15 p-4 font-mono text-[11px] space-y-1.5">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-indigo-400">
          {">"} Deploying MedTrustFundEscrow...
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-slate-500">
          {">"} Contract: 0x7F2A...3B9A
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="text-emerald-400">
          {">"} Confirmations: 12/12 ✓
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="text-amber-400">
          {">"} Escrow active — funds locked
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }} className="text-indigo-400">
          {">"} Milestone release: pending hospital
        </motion.p>
      </div>
    ),
  },
];

/* ═══════════════════════════════════════════════════════════════
   Risk verdict demo
   ═══════════════════════════════════════════════════════════════ */

const VERDICTS = [
  { range: "0 – 39", label: "Low Risk", action: "Auto-approved for publication", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: <FiCheckCircle /> },
  { range: "40 – 69", label: "Medium Risk", action: "Advisory note shown to donors", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: <FiAlertTriangle /> },
  { range: "70 – 100", label: "High Risk", action: "Blocked — manual admin review", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", icon: <FiXCircle /> },
];

/* ═══════════════════════════════════════════════════════════════
   Accordion Step Component
   ═══════════════════════════════════════════════════════════════ */

function StepAccordion({ step, isOpen, onToggle }: { step: PipelineStep; isOpen: boolean; onToggle: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      className={`rounded-2xl border transition-colors duration-300 overflow-hidden ${
        isOpen ? "border-white/15 shadow-[0_0_30px_rgba(0,0,0,0.3)]" : "border-white/5 hover:border-white/10"
      }`}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 sm:p-6 text-left group"
      >
        {/* Step number + icon */}
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-105 transition-transform`}>
          {step.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Step {step.id}</span>
            <span className="text-[10px] text-slate-600">&middot;</span>
            <span className="text-[10px] font-mono text-slate-600">{step.duration}</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white truncate">{step.title}</h3>
          <p className="text-sm text-slate-500 truncate">{step.subtitle}</p>
        </div>

        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0">
          <FiChevronDown className="w-5 h-5 text-slate-500" />
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-6 space-y-5">
              {/* Animated visual */}
              <div className="rounded-xl bg-black/30 border border-white/5 p-4">
                {step.visual}
              </div>

              {/* Details */}
              <ul className="space-y-2.5">
                {step.details.map((d, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-2.5 text-sm text-slate-400 leading-relaxed"
                  >
                    <FiArrowRight className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-1" />
                    {d}
                  </motion.li>
                ))}
              </ul>

              {/* Tech stack tags */}
              <div className="flex flex-wrap gap-1.5">
                {step.techStack.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[10px] font-mono text-slate-500"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function AIExplainer() {
  const navigate = useNavigate();
  const [openStep, setOpenStep] = useState<number>(1);

  return (
    <div className="min-h-screen bg-[#070514] text-white relative overflow-hidden selection:bg-fuchsia-500/40">
      {/* Background */}
      <div className="fixed inset-0 bg-[url('https://api.typedream.com/v0/document/public/80f7bc74-6869-45d2-a7d5-dacedaab59f7_Noise_Background_png.png')] opacity-[0.08] pointer-events-none mix-blend-overlay z-0" />
      <motion.div
        animate={{ y: [0, 35, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="fixed top-[-15%] left-[-10%] w-[600px] h-[600px] bg-fuchsia-600/12 rounded-full blur-[180px] pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, -30, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none"
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
                <FiCpu className="text-cyan-400 w-4 h-4" />
                AI Verification Pipeline
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                How MedTrustFund eliminates medical fundraising fraud
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10">

        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">5-Stage Pipeline</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            From Upload to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
              Blockchain
            </span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
            Every campaign on MedTrustFund passes through a 5-stage AI verification pipeline
            before a single rupee of donor funds is accepted. Here is exactly how it works.
          </p>
        </motion.div>

        {/* Pipeline steps */}
        <div className="space-y-3 mb-12">
          {STEPS.map((step) => (
            <StepAccordion
              key={step.id}
              step={step}
              isOpen={openStep === step.id}
              onToggle={() => setOpenStep(openStep === step.id ? 0 : step.id)}
            />
          ))}
        </div>

        {/* Risk verdict grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h3 className="text-xl font-black text-white mb-5 text-center">Risk Verdict Thresholds</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {VERDICTS.map((v) => (
              <div
                key={v.range}
                className={`rounded-xl border ${v.border} ${v.bg} p-5 text-center`}
              >
                <div className={`inline-flex p-2.5 rounded-lg ${v.bg} ${v.color} mb-3`}>
                  {v.icon}
                </div>
                <p className="text-xs font-mono text-slate-500 mb-1">{v.range}</p>
                <p className={`font-bold text-sm ${v.color} mb-1`}>{v.label}</p>
                <p className="text-xs text-slate-500">{v.action}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Architecture summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-black/40 backdrop-blur-xl p-6 sm:p-8 mb-8"
        >
          <h3 className="text-lg font-bold text-white mb-5">Architecture at a Glance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Frontend", tech: "React 19 + TypeScript", icon: <FiGlobe className="w-4 h-4" />, color: "text-cyan-400" },
              { label: "Backend", tech: "Express.js + MongoDB", icon: <FiDatabase className="w-4 h-4" />, color: "text-emerald-400" },
              { label: "AI Service", tech: "Python FastAPI", icon: <FiCpu className="w-4 h-4" />, color: "text-amber-400" },
              { label: "Blockchain", tech: "Solidity + Hardhat", icon: <FiLock className="w-4 h-4" />, color: "text-fuchsia-400" },
            ].map((item) => (
              <div key={item.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                <div className={`inline-flex mb-2 ${item.color}`}>{item.icon}</div>
                <p className="text-xs font-bold text-white">{item.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.tech}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center pb-8"
        >
          <button
            onClick={() => navigate("/campaigns")}
            className="px-8 py-3.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_0_25px_rgba(192,38,211,0.3)] hover:shadow-[0_0_35px_rgba(192,38,211,0.5)] transition-all border border-white/10 inline-flex items-center gap-2"
          >
            Browse Verified Campaigns <FiArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </main>
    </div>
  );
}