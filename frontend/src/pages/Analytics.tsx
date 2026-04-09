import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiTrendingUp, FiCheckCircle, FiDollarSign, FiPieChart } from "react-icons/fi";
import api from "../services/api";

export default function Analytics() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    amountRaised: 0,
    targetAmount: 0,
    progress: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get(`/api/analytics/me`);
      const next = response.data?.stats || {};
      setStats({
        totalCampaigns: next.totalCampaigns || 0,
        activeCampaigns: next.activeCampaigns || 0,
        amountRaised: next.amountRaised || next.totalRaised || 0,
        targetAmount: next.targetAmount || 0,
        progress: typeof next.progress === "number" ? next.progress : 0,
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-amber-900/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-orange-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-10 relative z-10">
        <div className="flex justify-between items-center mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
              Fundraising Analytics
            </h1>
            <p className="text-slate-400 mt-2 font-medium">Insights and metrics across your campaigns</p>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 border border-white/10 text-white bg-white/5 hover:bg-white/10 rounded-lg font-bold transition-all"
          >
            ← Dashboard
          </motion.button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all" />
                <div className="p-3 bg-blue-500/20 text-blue-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(59,130,246,0.2)]"><FiPieChart className="w-6 h-6"/></div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Campaigns</h3>
                <p className="text-3xl font-black text-white">{stats.totalCampaigns}</p>
              </motion.div>

              <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
                <div className="p-3 bg-emerald-500/20 text-emerald-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(16,185,129,0.2)]"><FiCheckCircle className="w-6 h-6"/></div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Active Now</h3>
                <p className="text-3xl font-black text-white">{stats.activeCampaigns}</p>
              </motion.div>

              <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group md:col-span-2 lg:col-span-2">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                <div className="p-3 bg-amber-500/20 text-amber-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)]"><FiDollarSign className="w-6 h-6"/></div>
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total ETH Raised</h3>
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
                      {stats.amountRaised.toFixed(3)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-bold uppercase">vs Target</p>
                    <p className="text-lg font-bold text-slate-300">{stats.targetAmount.toFixed(3)} ETH</p>
                  </div>
                </div>
                
                {/* Embedded Progress Bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-[10px] font-black uppercase text-amber-500 mb-2 tracking-widest">
                    <span>{stats.progress.toFixed(1)}% Completed</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(stats.progress, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div variants={itemVariants} className="glass-panel p-8 rounded-3xl border border-white/10 text-center py-16">
              <div className="w-20 h-20 bg-slate-900/50 border border-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-600">
                <FiTrendingUp className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">More charts coming soon!</h3>
              <p className="text-slate-400">We are integrating detailed timelines and donation velocities in the next update.</p>
            </motion.div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
