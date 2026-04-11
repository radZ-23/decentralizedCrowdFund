import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiTrendingUp, FiCheckCircle, FiDollarSign, FiPieChart, FiHeart } from "react-icons/fi";
import api from "../services/api";

export default function Analytics() {
  const navigate = useNavigate();
  const [role, setRole] = useState<string>("");
  const [stats, setStats] = useState<any>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    amountRaised: 0,
    targetAmount: 0,
    progress: 0,
  });
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get(`/api/analytics/me`);
      const next = response.data?.stats || {};
      setRole(response.data?.role || "");
      setCharts(response.data?.charts || null);
      setStats({
        totalCampaigns: next.totalCampaigns ?? next.assignedCampaigns ?? 0,
        activeCampaigns: next.activeCampaigns || 0,
        amountRaised: next.amountRaised || next.totalRaised || next.amountDonated || 0,
        targetAmount: next.targetAmount || 0,
        progress: typeof next.progress === "number" ? next.progress : 0,
        totalDonations: next.totalDonations,
        amountDonated: next.amountDonated,
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = (y: number, m: number) =>
    `${y}-${String(m).padStart(2, "0")}`;

  const maxBar = (rows: { amount?: number }[]) =>
    Math.max(0.0001, ...rows.map((r) => Number(r.amount) || 0));

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
              {role === "donor" ? (
                <>
                  <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="p-3 bg-pink-500/20 text-pink-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                      <FiHeart className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Donations made</h3>
                    <p className="text-3xl font-black text-white">{stats.totalDonations ?? 0}</p>
                  </motion.div>
                  <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group md:col-span-1 lg:col-span-3">
                    <div className="p-3 bg-amber-500/20 text-amber-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                      <FiDollarSign className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total ETH contributed</h3>
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
                      {(stats.amountDonated ?? stats.amountRaised ?? 0).toFixed(4)}
                    </p>
                  </motion.div>
                </>
              ) : role === "hospital" ? (
                <>
                  <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/5">
                    <div className="p-3 bg-blue-500/20 text-blue-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                      <FiPieChart className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned campaigns</h3>
                    <p className="text-3xl font-black text-white">{stats.totalCampaigns}</p>
                  </motion.div>
                  <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/5">
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                      <FiCheckCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Active</h3>
                    <p className="text-3xl font-black text-white">{stats.activeCampaigns}</p>
                  </motion.div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

            {role === "patient" && charts?.byCampaign?.length > 0 && (
              <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FiPieChart className="text-amber-400" /> Progress by campaign
                </h3>
                <div className="space-y-4">
                  {charts.byCampaign.map((c: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span className="truncate pr-2 font-medium text-slate-300">{c.title}</span>
                        <span>{c.progress?.toFixed?.(0) ?? 0}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all"
                          style={{ width: `${Math.min(c.progress || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {role === "patient" && charts?.monthlyInflow?.length > 0 && (
              <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FiTrendingUp className="text-cyan-400" /> Donations received (6 months)
                </h3>
                <div className="flex items-end gap-2 h-40">
                  {charts.monthlyInflow.map((row: any, i: number) => {
                    const h = (Number(row.amount) / maxBar(charts.monthlyInflow)) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-cyan-600 to-cyan-400 min-h-[4px] transition-all"
                          style={{ height: `${h}%` }}
                          title={`${row.amount} ETH`}
                        />
                        <span className="text-[9px] text-slate-500 rotate-0 text-center leading-tight">
                          {monthLabel(row.year, row.month)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {role === "donor" && charts?.monthlyGiving?.length > 0 && (
              <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FiHeart className="text-pink-400" /> Your giving (6 months)
                </h3>
                <div className="flex items-end gap-2 h-40">
                  {charts.monthlyGiving.map((row: any, i: number) => {
                    const h = (Number(row.amount) / maxBar(charts.monthlyGiving)) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-pink-600 to-purple-400 min-h-[4px]"
                          style={{ height: `${h}%` }}
                          title={`${row.amount} ETH`}
                        />
                        <span className="text-[9px] text-slate-500 text-center leading-tight">
                          {monthLabel(row.year, row.month)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {role === "donor" && charts?.topSupported?.length > 0 && (
              <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">Top supported campaigns</h3>
                <ul className="space-y-3">
                  {charts.topSupported.map((row: any, i: number) => (
                    <li
                      key={i}
                      className="flex justify-between items-center text-sm border border-white/5 rounded-xl px-4 py-3 bg-white/[0.02]"
                    >
                      <span className="text-slate-300 font-medium truncate pr-2">{row.title}</span>
                      <span className="text-amber-400 font-bold whitespace-nowrap">
                        {Number(row.totalAmount).toFixed(4)} ETH
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {role === "hospital" && charts?.assignedCampaigns?.length > 0 && (
              <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">Assigned campaigns</h3>
                <div className="space-y-3">
                  {charts.assignedCampaigns.map((c: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-sm border border-white/5 rounded-xl px-4 py-3"
                    >
                      <span className="text-slate-300 truncate pr-2">{c.title}</span>
                      <span className="text-emerald-400 text-xs font-bold uppercase">{c.status}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {!charts ||
              (role === "patient" && !charts?.byCampaign?.length && !charts?.monthlyInflow?.length) ||
              (role === "donor" && !charts?.monthlyGiving?.length && !charts?.topSupported?.length) ||
              (role === "hospital" && !charts?.assignedCampaigns?.length) ? (
              <motion.div variants={itemVariants} className="glass-panel p-8 rounded-3xl border border-white/10 text-center py-12">
                <div className="w-16 h-16 bg-slate-900/50 border border-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                  <FiTrendingUp className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">More data will appear here</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  As you create campaigns, receive donations, or verify milestones, timelines and breakdowns populate automatically.
                </p>
              </motion.div>
            ) : null}

          </motion.div>
        )}
      </div>
    </div>
  );
}
