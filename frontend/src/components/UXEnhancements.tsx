/* eslint-disable react-refresh/only-export-components */
/**
 * UXEnhancements.tsx
 * ─────────────────
 * Drop-in UI/UX upgrade kit for MedTrustFund.
 * One file, zero backend changes, zero existing-page edits.
 *
 * Exports:
 *   ScrollToTop        – resets scroll on route change
 *   BackToTopButton    – floating "back to top" pill
 *   ToastProvider      – context wrapper for toast notifications
 *   useToast           – hook: showToast("msg", "success"|"error"|"info")
 *   PageShell          – wraps pages with animated transition + Footer
 *   AppFooter          – reusable site footer
 *   Breadcrumbs        – auto-generates crumbs from current path
 *   EmptyState         – illustrated placeholder for empty lists
 *   SkeletonCard       – shimmer loading card
 *   SkeletonText       – shimmer loading text lines
 *   SkeletonRow        – shimmer loading table/list row
 *   PageLoadingScreen  – full-page skeleton (replaces bare spinners)
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,

  type ReactNode,
} from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowUp,
  FiX,
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiHome,
  FiChevronRight,
  FiInbox,
  FiHeart,
  FiShield,
  FiGlobe,
} from "react-icons/fi";

/* ═══════════════════════════════════════════════════════════════
   1. SCROLL TO TOP — resets window scroll on every route change
   ═══════════════════════════════════════════════════════════════ */

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   2. BACK TO TOP BUTTON — floating pill, appears after 400px
   ═══════════════════════════════════════════════════════════════ */

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 backdrop-blur-sm border border-white/10 transition-all group"
          aria-label="Back to top"
        >
          <FiArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. TOAST NOTIFICATION SYSTEM
   ═══════════════════════════════════════════════════════════════ */

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const iconMap: Record<ToastType, ReactNode> = {
    success: <FiCheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <FiAlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <FiInfo className="w-5 h-5 text-cyan-400 shrink-0" />,
  };

  const borderMap: Record<ToastType, string> = {
    success: "border-emerald-500/30",
    error: "border-rose-500/30",
    info: "border-cyan-500/30",
  };

  const bgMap: Record<ToastType, string> = {
    success: "bg-emerald-500/10",
    error: "bg-rose-500/10",
    info: "bg-cyan-500/10",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — top-right stack */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-xl border ${borderMap[toast.type]} ${bgMap[toast.type]} backdrop-blur-xl shadow-xl`}
            >
              {iconMap[toast.type]}
              <p className="text-sm font-medium text-slate-200 flex-1 leading-relaxed">
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <FiX className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
   4. APP FOOTER — consistent bottom for every authenticated page
   ═══════════════════════════════════════════════════════════════ */

export function AppFooter() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/5 mt-auto z-10">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div
              className="flex items-center gap-3 cursor-pointer mb-3 group"
              onClick={() => navigate("/")}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/50 transition-shadow">
                M
              </div>
              <span className="text-lg font-black tracking-tight text-white">
                MedTrustFund
              </span>
            </div>
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
              AI-verified, blockchain-escrowed medical crowdfunding. Every
              donation is locked until hospitals confirm treatment on-chain.
            </p>
            {/* Trust badges */}
            <div className="flex items-center gap-4 mt-4 text-slate-600 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <FiShield className="text-emerald-600" /> AI Verified
              </span>
              <span className="flex items-center gap-1.5">
                <FiHeart className="text-pink-500" /> Escrow Locked
              </span>
              <span className="flex items-center gap-1.5">
                <FiGlobe className="text-cyan-500" /> On-Chain
              </span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
              Platform
            </h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <Link
                  to="/campaigns"
                  className="hover:text-purple-400 transition-colors"
                >
                  Browse Campaigns
                </Link>
              </li>
              <li>
                <Link
                  to="/create-campaign"
                  className="hover:text-purple-400 transition-colors"
                >
                  Start Fundraising
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="hover:text-purple-400 transition-colors"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
              Resources
            </h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <span className="hover:text-cyan-400 cursor-pointer transition-colors">
                  Documentation
                </span>
              </li>
              <li>
                <span className="hover:text-cyan-400 cursor-pointer transition-colors">
                  Smart Contracts
                </span>
              </li>
              <li>
                <span className="hover:text-cyan-400 cursor-pointer transition-colors">
                  Hospital Partners
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-600 font-medium">
          <span>
            MedTrustFund &copy; {currentYear}. All rights cryptographically
            secured.
          </span>
          <span className="text-slate-700">
            Built with Hardhat &middot; React &middot; Polygon
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. BREADCRUMBS — auto-generated from current route path
   ═══════════════════════════════════════════════════════════════ */

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  campaigns: "Campaigns",
  campaign: "Campaign",
  "create-campaign": "Create Campaign",
  "my-campaigns": "My Campaigns",
  "my-donations": "My Donations",
  milestones: "Milestones",
  analytics: "Analytics",
  profile: "Profile",
  admin: "Admin",
  users: "Users",
  "audit-logs": "Audit Logs",
  contracts: "Contracts",
  "campaign-review": "Campaign Review",
  "kyc-review": "KYC Review",
  "kyc-submission": "KYC Submission",
  "hospital-profile": "Hospital Profile",
  notifications: "Notifications",
  transactions: "Transactions",
  edit: "Edit",
};

export function Breadcrumbs() {
  const { pathname } = useLocation();

  // Don't render on root, login, signup, etc.
  const hiddenPaths = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];
  if (hiddenPaths.includes(pathname)) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    const label =
      ROUTE_LABELS[seg] ||
      (seg.length === 24 ? "Details" : seg.charAt(0).toUpperCase() + seg.slice(1));
    const isLast = i === segments.length - 1;
    return { label, path, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm font-medium mb-6 flex-wrap"
    >
      <Link
        to="/dashboard"
        className="text-slate-500 hover:text-purple-400 transition-colors flex items-center gap-1"
      >
        <FiHome className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Home</span>
      </Link>

      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1.5">
          <FiChevronRight className="w-3.5 h-3.5 text-slate-600" />
          {crumb.isLast ? (
            <span className="text-slate-300 truncate max-w-[180px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="text-slate-500 hover:text-purple-400 transition-colors truncate max-w-[180px]"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. PAGE SHELL — wraps pages with transition animation + footer
   Does NOT add a Navbar (pages already have their own headers).
   ═══════════════════════════════════════════════════════════════ */

export function PageShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col min-h-screen">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex-1"
      >
        {children}
      </motion.div>
      <AppFooter />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7. EMPTY STATE — illustrated placeholder for zero-data views
   ═══════════════════════════════════════════════════════════════ */

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title = "Nothing here yet",
  description = "There's no data to display at the moment.",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      {/* Illustration ring */}
      <div className="relative mb-8">
        <div className="w-28 h-28 rounded-full bg-purple-500/5 border border-purple-500/10 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400">
            {icon || <FiInbox className="w-9 h-9" />}
          </div>
        </div>
        {/* Decorative dots */}
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-pink-500/20 rounded-full blur-[2px]" />
        <div className="absolute -bottom-1 -left-3 w-3 h-3 bg-cyan-500/20 rounded-full blur-[2px]" />
      </div>

      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   8. SKELETON LOADERS — shimmer placeholders for loading states
   ═══════════════════════════════════════════════════════════════ */

/* Shimmer keyframe is done with a pseudo-element + CSS animation */
const shimmerClass =
  "relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent before:animate-[shimmer_2s_infinite] before:-translate-x-full";

const SKELETON_WIDTHS = ["92%", "88%", "95%", "85%", "90%", "87%", "93%", "86%"];

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-full bg-white/5 ${shimmerClass}`}
          style={{ width: i === lines - 1 ? "60%" : SKELETON_WIDTHS[i % SKELETON_WIDTHS.length] }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`glass-card rounded-2xl border border-white/10 overflow-hidden ${className}`}
    >
      {/* Header shimmer */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div
            className={`h-5 w-20 rounded-md bg-white/5 ${shimmerClass}`}
          />
          <div
            className={`h-5 w-16 rounded-md bg-white/5 ${shimmerClass}`}
          />
        </div>

        {/* Title */}
        <div className={`h-6 w-3/4 rounded-md bg-white/5 ${shimmerClass}`} />

        {/* Description lines */}
        <div className="space-y-2.5">
          <div className={`h-3 w-full rounded-full bg-white/5 ${shimmerClass}`} />
          <div className={`h-3 w-5/6 rounded-full bg-white/5 ${shimmerClass}`} />
          <div className={`h-3 w-2/3 rounded-full bg-white/5 ${shimmerClass}`} />
        </div>

        {/* Progress bar */}
        <div className="pt-2 space-y-2">
          <div className="flex justify-between">
            <div className={`h-4 w-16 rounded bg-white/5 ${shimmerClass}`} />
            <div className={`h-4 w-20 rounded bg-white/5 ${shimmerClass}`} />
          </div>
          <div
            className={`h-2 w-full rounded-full bg-white/5 ${shimmerClass}`}
          />
        </div>
      </div>

      {/* Footer shimmer */}
      <div className="px-6 py-4 border-t border-white/5">
        <div className={`h-4 w-32 rounded bg-white/5 ${shimmerClass}`} />
      </div>
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border border-white/5 ${className}`}
    >
      <div
        className={`w-10 h-10 rounded-full bg-white/5 shrink-0 ${shimmerClass}`}
      />
      <div className="flex-1 space-y-2">
        <div className={`h-4 w-2/5 rounded bg-white/5 ${shimmerClass}`} />
        <div className={`h-3 w-3/5 rounded bg-white/5 ${shimmerClass}`} />
      </div>
      <div className={`h-8 w-20 rounded-lg bg-white/5 shrink-0 ${shimmerClass}`} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   9. PAGE LOADING SCREEN — replaces bare spinners, matches layout
   ═══════════════════════════════════════════════════════════════ */

export function PageLoadingScreen({
  variant = "cards",
}: {
  variant?: "cards" | "detail" | "list";
}) {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background orbs matching app design */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed top-[40%] left-[-10%] w-[500px] h-[500px] bg-pink-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Fake header */}
      <div className="sticky top-0 z-30 glass-panel border-b border-white/5 py-4 px-6 sm:px-10 flex justify-between items-center backdrop-blur-xl">
        <div className="space-y-2">
          <div className={`h-6 w-40 rounded-lg bg-white/5 ${shimmerClass}`} />
          <div className={`h-3 w-56 rounded bg-white/5 ${shimmerClass}`} />
        </div>
        <div className="flex items-center gap-3">
          <div className={`h-9 w-48 rounded-xl bg-white/5 ${shimmerClass} hidden sm:block`} />
          <div className={`h-9 w-9 rounded-lg bg-white/5 ${shimmerClass}`} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-10 mt-8">
        {variant === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <SkeletonCard />
              </motion.div>
            ))}
          </div>
        )}

        {variant === "detail" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className={`h-10 w-2/3 rounded-xl bg-white/5 ${shimmerClass}`} />
            <div className={`h-64 w-full rounded-2xl bg-white/5 ${shimmerClass}`} />
            <SkeletonText lines={5} />
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className={`h-24 rounded-xl bg-white/5 ${shimmerClass}`} />
              <div className={`h-24 rounded-xl bg-white/5 ${shimmerClass}`} />
            </div>
          </div>
        )}

        {variant === "list" && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <SkeletonRow />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   10. GLOBAL PROGRESS BAR — thin animated bar at top of viewport
       during page transitions
   ═══════════════════════════════════════════════════════════════ */

export function RouteProgressBar() {
  const { pathname } = useLocation();
  const [loadKey, setLoadKey] = useState(pathname);
  const visible = loadKey !== pathname;

  // When pathname changes, the mismatch makes `visible` true.
  // A timeout then syncs loadKey → hides the bar.
  useEffect(() => {
    const timeout = setTimeout(() => setLoadKey(pathname), 500);
    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={pathname}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 0.7 }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 z-[200] origin-left"
        />
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════
   11. KEYBOARD SHORTCUT HINT — shows "Press / to search" badge
   ═══════════════════════════════════════════════════════════════ */

export function SearchShortcutHint({
  inputRef,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [inputRef]);

  return (
    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[10px] font-mono text-slate-500 ml-2">
      /
    </kbd>
  );
}

/* ═══════════════════════════════════════════════════════════════
   12. STAT CARD — small KPI card for dashboard-style pages
   ═══════════════════════════════════════════════════════════════ */

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendUp,
  color = "from-purple-500 to-pink-500",
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="glass-card rounded-2xl p-5 relative overflow-hidden group"
    >
      <div
        className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${color} rounded-full blur-[40px] opacity-15 group-hover:opacity-30 transition-opacity duration-500`}
      />
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div
          className={`p-2.5 rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-bold px-2 py-1 rounded-md ${
              trendUp
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-white relative z-10">{value}</p>
      <p className="text-sm text-slate-400 font-medium mt-1 relative z-10">
        {label}
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   13. CONFIRMATION MODAL — reusable yes/no dialog
   ═══════════════════════════════════════════════════════════════ */

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-card rounded-2xl p-6 sm:p-8 w-full max-w-md relative z-10 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {message}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl font-medium text-sm transition-all"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-5 py-2.5 font-semibold rounded-xl text-sm transition-all ${
                  variant === "danger"
                    ? "bg-rose-500/90 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg shadow-purple-500/25"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════
   14. BADGE — small status pill component
   ═══════════════════════════════════════════════════════════════ */

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

const badgeStyles: Record<BadgeVariant, string> = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  error: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  info: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  neutral: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold uppercase tracking-wider ${badgeStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   15. TOOLTIP — lightweight hover tooltip
   ═══════════════════════════════════════════════════════════════ */

export function Tooltip({
  children,
  text,
}: {
  children: ReactNode;
  text: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-xs text-slate-200 font-medium whitespace-nowrap shadow-xl z-50 pointer-events-none"
          >
            {text}
            <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-slate-800 border-r border-b border-white/10 rotate-45" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}