import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiBriefcase,
  FiMapPin,
  FiMail,
  FiShield,
  FiThumbsUp,
  FiActivity,
  FiGlobe,
  FiAlertCircle,
} from "react-icons/fi";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type ProfileUser = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  walletAddress?: string;
  hospitalName?: string;
  hospitalLicense?: string;
  profile?: { verified?: boolean; location?: string };
  kyc?: { status?: string };
};

export default function HospitalProfile() {
  const navigate = useNavigate();
  const { token, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [assignedCampaigns, setAssignedCampaigns] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [milestonesConfirmed, setMilestonesConfirmed] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/auth/profile");
        if (cancelled) return;
        const u = res.data.user as ProfileUser;
        if (u.role !== "hospital") {
          navigate("/dashboard");
          return;
        }
        setProfile(u);

        try {
          const ar = await api.get("/analytics/me");
          if (cancelled) return;
          const s = ar.data?.stats;
          if (s) {
            setAssignedCampaigns(s.assignedCampaigns ?? 0);
            setActiveCampaigns(s.activeCampaigns ?? 0);
          }
        } catch {
          if (!cancelled) {
            setAssignedCampaigns(0);
            setActiveCampaigns(0);
          }
        }

        try {
          const mc = await api.get("/api/milestones/hospital/my-campaigns");
          if (cancelled) return;
          const list = mc.data?.campaigns as Array<{ milestones?: Array<{ status?: string }> }> | undefined;
          let n = 0;
          if (Array.isArray(list)) {
            for (const c of list) {
              for (const m of c.milestones || []) {
                if (m.status === "confirmed" || m.status === "released") n += 1;
              }
            }
          }
          setMilestonesConfirmed(n);
        } catch {
          if (!cancelled) setMilestonesConfirmed(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg =
            typeof e === "object" && e !== null && "response" in e
              ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined;
          setError(msg || "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, token, navigate]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-slate-950">
        {error ? (
          <p className="text-red-400 px-4 text-center">{error}</p>
        ) : (
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-500 z-10" />
        )}
      </div>
    );
  }

  const verified =
    profile.profile?.verified === true || profile.kyc?.status === "approved";
  const displayName = profile.hospitalName || profile.name || "Hospital facility";
  const location = profile.profile?.location?.trim() || "Not set";
  const license = profile.hospitalLicense?.trim() || "—";
  const wallet = profile.walletAddress?.trim();

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-pink-900/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-10 relative z-10">
        <div className="flex justify-between items-center mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
              Institution Profile
            </h1>
            <p className="text-slate-400 mt-2 font-medium">
              Live status from your account (verification, wallet, assignments)
            </p>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 border border-white/10 text-white bg-white/5 hover:bg-white/10 rounded-lg font-bold transition-all"
          >
            ← Dashboard
          </motion.button>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-slate-300 text-sm leading-relaxed">
          <p className="font-semibold text-slate-200 mb-1">How patients assign your hospital</p>
          <p>
            The hospital dropdown on <strong className="text-white">create / edit campaign</strong> is loaded while
            logged in as a <strong className="text-white">patient</strong> (or admin). It lists hospital accounts that
            are trusted on the server: either <strong className="text-white">admin-approved KYC</strong> or{" "}
            <strong className="text-white">license verification</strong> (<code className="text-pink-300">profile.verified</code>
            ). Log in as your patient account to choose your institution here once this page shows verified.
          </p>
        </div>

        {!verified && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm"
          >
            <FiAlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-bold text-amber-50">Not verified in the system yet</p>
              <p className="mt-1 text-amber-100/90">
                Until license verification completes, you will <strong>not</strong> appear in patient hospital
                dropdowns. Use KYC / license steps from your dashboard.
              </p>
              <Link
                to="/kyc-submission"
                className="inline-block mt-2 text-amber-200 font-semibold underline underline-offset-2 hover:text-white"
              >
                Go to KYC / verification →
              </Link>
            </div>
          </motion.div>
        )}

        {verified && !wallet && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-cyan-100 text-sm"
          >
            <FiGlobe className="w-5 h-5 shrink-0 mt-0.5 text-cyan-400" />
            <div>
              <p className="font-bold text-cyan-50">Wallet not saved on this account</p>
              <p className="mt-1 text-cyan-100/90">
                Escrow deployment needs your hospital address on your user record. Connect and verify your wallet from
                the dashboard so it is stored in the database.
              </p>
              <Link
                to="/dashboard"
                className="inline-block mt-2 text-cyan-200 font-semibold underline underline-offset-2 hover:text-white"
              >
                Open dashboard →
              </Link>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 relative overflow-hidden group mb-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-pink-500/20 transition-all" />

          <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
            <div className="w-32 h-32 bg-slate-900 border border-white/10 shadow-2xl rounded-2xl flex items-center justify-center text-pink-400 text-5xl shrink-0">
              <FiBriefcase />
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 flex flex-wrap items-center gap-3">
                    {displayName}
                    {verified ? (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 uppercase tracking-wider">
                        <FiShield /> Verified
                      </span>
                    ) : (
                      <span className="bg-slate-600/40 text-slate-300 border border-slate-500/40 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 uppercase tracking-wider">
                        <FiShield /> Pending verification
                      </span>
                    )}
                  </h2>
                  <p className="text-pink-300 font-mono text-sm tracking-wide">License No: {license}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-slate-400 bg-black/20 p-3 rounded-xl border border-white/5">
                  <FiMail className="text-purple-400 shrink-0" />
                  <span className="text-sm break-all">{profile.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 bg-black/20 p-3 rounded-xl border border-white/5">
                  <FiMapPin className="text-purple-400 shrink-0" />
                  <span className="text-sm">{location}</span>
                </div>
                <div className="col-span-1 sm:col-span-2 flex items-center gap-3 text-slate-400 bg-black/20 p-3 rounded-xl border border-white/5">
                  <FiGlobe className="text-purple-400 shrink-0" />
                  <span className="text-sm font-mono break-all text-indigo-300">
                    {wallet || "No wallet on file — connect from Dashboard"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 rounded-2xl border border-white/5"
          >
            <div className="p-3 bg-blue-500/20 text-blue-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <FiActivity className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned campaigns</h3>
            <p className="text-4xl font-black text-white">{assignedCampaigns}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6 rounded-2xl border border-white/5"
          >
            <div className="p-3 bg-emerald-500/20 text-emerald-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <FiThumbsUp className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active (assigned)</h3>
            <p className="text-4xl font-black text-white">{activeCampaigns}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-6 rounded-2xl border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
          >
            <div className="p-3 bg-amber-500/20 text-amber-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <FiShield className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Milestones confirmed</h3>
            <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
              {milestonesConfirmed != null ? milestonesConfirmed : "—"}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
