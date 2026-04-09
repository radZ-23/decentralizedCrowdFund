import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import { 
  FiUsers, FiLayout, FiShield, FiCheckCircle, 
  FiXCircle, FiEye, FiActivity, FiDollarSign, FiClock, FiUser
} from "react-icons/fi";

interface DashboardStats {
  totalUsers: number;
  totalCampaigns: number;
  totalDonations: number;
  pendingReviewCampaigns: number;
  activeCampaigns: number;
  totalRaised: number;
}

interface Campaign {
  _id: string;
  title: string;
  status: string;
  riskScore?: number;
  riskCategory?: string;
  smartContractAddress?: string;
  patientId?: {
    name: string;
    email: string;
  };
  createdAt: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingCampaigns, setPendingCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignsList, setActiveCampaignsList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewingCampaign, setReviewingCampaign] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, pendingRes, activeRes] = await Promise.all([
        api.get("/api/admin/dashboard"),
        api.get("/api/admin/campaigns/pending-review"),
        api.get("/api/campaigns?status=active"),
      ]);

      setStats(statsRes.data.statistics);
      setPendingCampaigns(pendingRes.data.campaigns || []);
      setActiveCampaignsList(activeRes.data.campaigns || []);
    } catch (err: any) {
      console.error("Dashboard error:", err);
      setError(err.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const reviewCampaign = async (campaignId: string, decision: "approve" | "reject") => {
    const comments = prompt(
      decision === "approve"
        ? "Add comments (optional):"
        : "Add rejection reason (required):"
    );

    if (decision === "reject" && !comments) {
      alert("Rejection reason is required");
      return;
    }

    try {
      setReviewingCampaign(campaignId);
      setError("");

      await api.post(`/api/admin/campaigns/${campaignId}/decision`, {
        decision,
        comments: comments || "",
        overrideRiskScore: true,
      });

      fetchDashboardData();
    } catch (err: any) {
      console.error("Review error:", err);
      setError(err.response?.data?.error || "Failed to review campaign");
    } finally {
      setReviewingCampaign(null);
    }
  };

  const getRiskBadgeColor = (category?: string) => {
    switch (category) {
      case "low":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]";
      case "medium":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]";
      case "high":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30 shadow-[0_0_10px_rgba(225,29,72,0.2)]";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-slate-950 to-slate-950" />
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 z-10"></div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      {/* Dynamic Backgrounds */}
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-900/30 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-900/30 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/5 py-4 px-6 sm:px-10 flex flex-col sm:flex-row justify-between items-center sm:items-center gap-4 bg-transparent backdrop-blur-xl">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold text-white tracking-tight"
          >
            Admin <span className="text-gradient">Control Center</span>
          </motion.h1>
        </div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={() => navigate("/admin/audit-logs")}
            className="px-4 py-2 bg-white/5 text-slate-300 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all font-medium flex items-center gap-2 shadow-lg shadow-black/20"
          >
            <FiShield className="w-4 h-4" />
            <span className="hidden sm:inline">Audit Logs</span>
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white border border-purple-400/30 rounded-lg hover:from-purple-400 hover:to-indigo-400 transition-all font-medium shadow-[0_0_15px_rgba(168,85,247,0.4)]"
          >
            ← Back
          </button>
        </motion.div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-10 mt-8 relative z-10">
        
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 glass-card border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)] rounded-xl p-4 flex gap-3 items-center">
            <FiXCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <p className="text-red-200 font-medium">{error}</p>
          </motion.div>
        )}

        {/* Stats Grid */}
        {stats && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
            <motion.div 
              onClick={() => navigate("/admin/users")}
              variants={itemVariants} 
              className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center relative group cursor-pointer hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg mb-3 shadow-[0_0_10px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform"><FiUsers className="w-5 h-5"/></div>
              <p className="text-3xl font-black text-white">{stats.totalUsers}</p>
              <p className="text-xs font-semibold text-slate-400 mt-1 tracking-wider uppercase">Users</p>
            </motion.div>

            <motion.div 
              onClick={() => navigate("/admin/contracts")}
              variants={itemVariants} 
              className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center relative group cursor-pointer hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg mb-3 shadow-[0_0_10px_rgba(168,85,247,0.3)] group-hover:scale-110 transition-transform"><FiLayout className="w-5 h-5"/></div>
              <p className="text-3xl font-black text-white">{stats.totalCampaigns}</p>
              <p className="text-xs font-semibold text-slate-400 mt-1 tracking-wider uppercase">Campaigns</p>
            </motion.div>

            <motion.div 
              onClick={() => navigate("/admin/contracts")}
              variants={itemVariants} 
              className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center relative group cursor-pointer hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg mb-3 shadow-[0_0_10px_rgba(225,29,72,0.3)] group-hover:scale-110 transition-transform"><FiActivity className="w-5 h-5"/></div>
              <p className="text-3xl font-black text-white">{stats.totalDonations}</p>
              <p className="text-xs font-semibold text-slate-400 mt-1 tracking-wider uppercase">Donations</p>
            </motion.div>

            <motion.div 
              onClick={() => document.getElementById('pending-reviews')?.scrollIntoView({ behavior: 'smooth' })}
              variants={itemVariants} 
              className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center relative border border-amber-500/30 group cursor-pointer hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </div>
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg mb-3 shadow-[0_0_10px_rgba(245,158,11,0.3)] group-hover:scale-110 transition-transform"><FiClock className="w-5 h-5"/></div>
              <p className="text-3xl font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">{stats.pendingReviewCampaigns}</p>
              <p className="text-xs font-semibold text-amber-200/70 mt-1 tracking-wider uppercase">Pending</p>
            </motion.div>

            <motion.div 
              onClick={() => navigate("/admin/contracts")}
              variants={itemVariants} 
              className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center relative group cursor-pointer hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg mb-3 shadow-[0_0_10px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform"><FiCheckCircle className="w-5 h-5"/></div>
              <p className="text-3xl font-black text-white">{stats.activeCampaigns}</p>
              <p className="text-xs font-semibold text-slate-400 mt-1 tracking-wider uppercase">Active</p>
            </motion.div>

            <motion.div 
              onClick={() => document.getElementById('active-campaigns')?.scrollIntoView({ behavior: 'smooth' })}
              variants={itemVariants} 
              className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center relative group overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg mb-3 shadow-[0_0_10px_rgba(99,102,241,0.3)] group-hover:scale-110 transition-transform"><FiDollarSign className="w-5 h-5"/></div>
              <p className="text-3xl font-black text-indigo-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]">{stats.totalRaised.toFixed(1)}</p>
              <p className="text-xs font-semibold text-indigo-200/70 mt-1 tracking-wider uppercase">ETH Raised</p>
            </motion.div>
          </motion.div>
        )}

        {/* Pending Reviews Section */}
        <motion.div 
          id="pending-reviews"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl overflow-hidden mb-10 border border-white/5"
        >
          <div className="px-6 py-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FiClock className="text-amber-400"/> Campaigns Pending Review
              <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                {pendingCampaigns.length}
              </span>
            </h2>
          </div>

          <div className="p-6">
            {pendingCampaigns.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center opacity-60">
                <FiCheckCircle className="w-16 h-16 text-emerald-400 mb-4 opacity-50" />
                <p className="text-xl font-semibold text-slate-300">All caught up!</p>
                <p className="text-slate-500 mt-1">No campaigns are waiting for review right now.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {pendingCampaigns.map((campaign) => (
                    <motion.div
                      key={campaign._id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="p-5 border border-white/10 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 hover:border-white/20 transition-all shadow-lg group relative overflow-hidden"
                    >
                      {/* Subdued risk gradient based on risk score */}
                      {campaign.riskScore !== undefined && campaign.riskScore >= 70 && (
                        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-[60px] pointer-events-none" />
                      )}

                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                          <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                            {campaign.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                            <FiUser className="w-4 h-4" />
                            <span>{campaign.patientId?.name || "Unknown Patient"}</span>
                            <span className="opacity-50">•</span>
                            <span>{new Date(campaign.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Risk Badges */}
                          {campaign.riskScore !== undefined && (
                            <span className={`px-3 py-1 text-xs font-bold rounded-lg border shadow-sm flex items-center gap-1.5 ${
                                campaign.riskScore >= 70
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  : campaign.riskScore >= 40
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              }`}
                            >
                              Risk Score: <span className="text-sm">{campaign.riskScore}/100</span>
                            </span>
                          )}
                          {campaign.riskCategory && (
                            <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border ${getRiskBadgeColor(campaign.riskCategory)}`}>
                              {campaign.riskCategory}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3 mt-6 pt-4 border-t border-white/5 relative z-10 w-full">
                        <button
                          onClick={() => navigate(`/campaign/${campaign._id}`)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-all border border-white/10 flex items-center gap-2 text-sm mr-auto"
                        >
                          <FiEye className="w-4 h-4" /> View Details
                        </button>

                        <button
                          onClick={() => reviewCampaign(campaign._id, "reject")}
                          disabled={reviewingCampaign === campaign._id}
                          className="px-5 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 hover:border-rose-500 font-semibold rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                          <FiXCircle className="w-4 h-4" /> Reject
                        </button>
                        
                        <button
                          onClick={() => reviewCampaign(campaign._id, "approve")}
                          disabled={reviewingCampaign === campaign._id}
                          className="px-5 py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/40 hover:border-emerald-500 font-semibold rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                          {reviewingCampaign === campaign._id ? (
                            <div className="w-4 h-4 border-2 border-emerald-200 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiCheckCircle className="w-4 h-4" /> 
                          )}
                          Approve
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

        {/* Active Campaigns Section */}
        {activeCampaignsList.length > 0 && (
          <motion.div 
            id="active-campaigns"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card rounded-2xl overflow-hidden mb-10 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          >
            <div className="px-6 py-5 border-b border-white/10 bg-emerald-500/5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FiCheckCircle className="text-emerald-400"/> Active Campaigns
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  {activeCampaignsList.length}
                </span>
              </h2>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <AnimatePresence>
                  {activeCampaignsList.map((campaign) => (
                    <motion.div
                      key={campaign._id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="p-5 border border-white/10 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 hover:border-emerald-500/30 transition-all shadow-lg group relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="flex flex-col relative z-10 w-full md:w-auto">
                        <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                          {campaign.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-400">
                          <FiUser className="w-4 h-4" />
                          <span>{campaign.patientId?.name || "Unknown Patient"}</span>
                          <span className="opacity-50">•</span>
                          <span>{new Date(campaign.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 mt-4 md:mt-0 relative z-10 w-full md:w-auto border-t border-white/5 pt-4 md:border-0 md:pt-0">
                        {campaign.smartContractAddress ? (
                          <span className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border bg-indigo-500/10 text-indigo-300 border-indigo-500/30 flex items-center gap-1.5 whitespace-nowrap">
                            <FiCheckCircle className="w-3.5 h-3.5" /> Contract Launched
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border bg-emerald-500/10 text-emerald-300 border-emerald-500/30 animate-pulse whitespace-nowrap">
                            Ready for Deployment
                          </span>
                        )}
                        <button
                          onClick={() => navigate(`/campaign/${campaign._id}`)}
                          className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-lg transition-all border border-emerald-500/20 flex items-center gap-2 text-sm whitespace-nowrap"
                        >
                          <FiEye className="w-4 h-4" /> View Details
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Actions Links */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div
            className="glass-card rounded-2xl p-6 cursor-pointer group hover:-translate-y-1 transition-all duration-300"
            onClick={() => navigate("/admin/users")}
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg group-hover:scale-110 transition-transform"><FiUsers className="w-6 h-6"/></div>
              <h3 className="font-bold text-lg text-white">User Management</h3>
            </div>
            <p className="text-sm text-slate-400">View, edit, block, or delete platform users</p>
          </div>

          <div
            className="glass-card rounded-2xl p-6 cursor-pointer group hover:-translate-y-1 transition-all duration-300"
            onClick={() => navigate("/admin/contracts")}
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-lg group-hover:scale-110 transition-transform"><FiLayout className="w-6 h-6"/></div>
              <h3 className="font-bold text-lg text-white">Smart Contracts</h3>
            </div>
            <p className="text-sm text-slate-400">Check blockchain deployed contract status</p>
          </div>

          <div
            className="glass-card rounded-2xl p-6 cursor-pointer group hover:-translate-y-1 transition-all duration-300"
            onClick={() => navigate("/admin/audit-logs")}
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-lg group-hover:scale-110 transition-transform"><FiShield className="w-6 h-6"/></div>
              <h3 className="font-bold text-lg text-white">Platform Audit Trails</h3>
            </div>
            <p className="text-sm text-slate-400">Review security logs and administrative action history</p>
          </div>
        </motion.div>

      </main>
    </div>
  );
}
