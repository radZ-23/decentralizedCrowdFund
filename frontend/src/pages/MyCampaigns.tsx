import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import {
  FiPlusCircle, FiLayout, FiAlertTriangle, FiCheckCircle,
  FiShield, FiCode, FiArrowRight, FiSearch, FiEdit2,
} from "react-icons/fi";

interface Campaign {
  _id: string;
  title: string;
  description: string;
  targetAmount: number;
  raisedAmount: number;
  status: string;
  riskScore?: number;
  riskCategory?: string;
  smartContractAddress?: string;
  milestones?: Array<{
    description: string;
    targetAmount: number;
    status: string;
    confirmedAt?: string;
  }>;
  createdAt: string;
}

export default function MyCampaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchMyCampaigns();
  }, []);

  const fetchMyCampaigns = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await api.get(`/api/campaigns?patientId=${user.id}`);
      setCampaigns(response.data.campaigns || []);
    } catch (err: any) {
      console.error("Failed to fetch campaigns:", err);
      setError(err.response?.data?.error || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "active":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "pending_verification":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "completed":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "rejected":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "paused":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const filteredCampaigns = campaigns.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 z-10"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      {/* Background Ambience */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/5 py-4 px-6 sm:px-10 flex flex-col sm:flex-row justify-between items-center sm:items-center gap-4 bg-transparent backdrop-blur-xl">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-bold text-white tracking-tight">My <span className="text-gradient">Campaigns</span></h1>
          <p className="text-sm text-slate-400">Manage and track your fundraising efforts</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="flex flex-wrap items-center gap-3 w-full sm:w-auto"
        >
          <div className="relative group flex-grow sm:flex-grow-0 sm:w-48">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-purple-400 transition-colors">
              <FiSearch className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white placeholder-slate-500 transition-all text-sm"
            />
          </div>
          
          <button
            onClick={() => navigate("/create-campaign")}
            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white border border-purple-400/30 rounded-xl hover:from-purple-400 hover:to-pink-400 transition-all font-medium text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
          >
            <FiPlusCircle className="w-4 h-4" /> <span>Create New</span>
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className="hidden sm:flex px-4 py-2 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all font-medium text-sm items-center gap-2"
          >
            <FiLayout className="w-4 h-4" /> Dashboard
          </button>
        </motion.div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-10 mt-8 relative z-10">
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-8 flex items-center gap-3">
            <FiAlertTriangle className="text-red-400 h-5 w-5" />
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {filteredCampaigns.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 glass-card rounded-3xl border border-white/5">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-purple-500/10 mb-6 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
              <FiLayout className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No campaigns available</h2>
            <p className="text-slate-400 max-w-sm mx-auto mb-8">
              {searchTerm ? "No campaigns match your search query." : "You haven't created any campaigns yet. Start your journey by creating one."}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate("/create-campaign")}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center gap-2 mx-auto"
              >
                <FiPlusCircle className="w-5 h-5" /> Start Fundraising
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants} 
            initial="hidden" 
            animate="show" 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredCampaigns.map((campaign) => {
              const progress = Math.min(((campaign.raisedAmount || 0) / campaign.targetAmount) * 100, 100);
              
              return (
                <motion.div
                  key={campaign._id}
                  variants={itemVariants as any}
                  whileHover={{ y: -5 }}
                  className="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col group relative"
                >
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      {campaign.riskScore !== undefined && (
                        <div className="px-2.5 py-1 bg-slate-900/50 rounded-md border border-white/5 text-slate-400 text-xs font-semibold flex items-center gap-1.5">
                          <FiShield className="w-3 h-3 text-emerald-400" />
                          Risk: {campaign.riskScore}/100
                        </div>
                      )}
                      
                      <div className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(campaign.status)}`}>
                        {campaign.status.replace("_", " ")}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                       {campaign.title}
                    </h3>
                    
                    <p className="text-slate-400 text-sm mb-6 line-clamp-2 flex-1">
                      {campaign.description}
                    </p>

                    <div className="mt-auto space-y-5">
                      {/* Progress Bar Container */}
                      <div>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-white font-semibold">{(campaign.raisedAmount || 0).toFixed(2)} ETH</span>
                          <span className="text-slate-400">of {campaign.targetAmount} ETH</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 relative"
                          >
                            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                          </motion.div>
                        </div>
                      </div>

                      {/* Milestones Preview */}
                      {campaign.milestones && campaign.milestones.length > 0 && (
                        <div className="pt-4 border-t border-white/5">
                          <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">Milestones</p>
                          <div className="flex gap-2 flex-wrap">
                            {campaign.milestones.slice(0, 3).map((m, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 text-[10px] font-medium rounded-full flex items-center gap-1 ${
                                  m.status === "confirmed" || m.status === "released"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-slate-800 text-slate-400 border border-white/5"
                                }`}
                              >
                                {m.status === "confirmed" || m.status === "released" ? <FiCheckCircle /> : null}
                                {m.description.length > 15 ? m.description.slice(0, 15) + "..." : m.description}
                              </span>
                            ))}
                            {campaign.milestones.length > 3 && (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-800 text-slate-400 border border-white/5">
                                +{campaign.milestones.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Web3 Contract Interaction */}
                      {campaign.smartContractAddress && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                            <FiCode className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-0.5">Contract Active</p>
                            <p className="text-[10px] font-mono text-emerald-200/70 truncate w-32 break-all">
                              {campaign.smartContractAddress}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="px-6 py-4 border-t border-white/5 bg-white-[0.02] grid grid-cols-2 gap-2 group-hover:bg-purple-500/5 transition-colors">
                    <button
                      type="button"
                      onClick={() => navigate(`/campaign/${campaign._id}/edit`)}
                      className="px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium border border-purple-500/25"
                    >
                      <FiEdit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/campaign/${campaign._id}`)}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium border border-white/5 w-full"
                    >
                      <FiArrowRight className="w-4 h-4" /> View
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
}
