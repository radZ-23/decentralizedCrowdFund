import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import { FiSearch, FiArrowRight, FiShield, FiAlertTriangle, FiCheckCircle, FiEdit2 } from "react-icons/fi";
import ThemeToggle from "../components/ui/ThemeToggle";
import { useAuth } from "../contexts/AuthContext";

interface Campaign {
  _id: string;
  title: string;
  description: string;
  targetAmount: number;
  raisedAmount: number;
  status: string;
  riskScore?: number;
  riskCategory?: string;
  patientId: string | { _id?: string; name?: string };
}

function campaignPatientId(c: Campaign): string {
  if (!c.patientId) return "";
  if (typeof c.patientId === "string") return c.patientId;
  return String(c.patientId._id || "");
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const canEditCampaign = (c: Campaign) => {
    if (!token || !user) return false;
    if (user.role === "admin") return true;
    if (user.role === "patient" && campaignPatientId(c) === user.id) return true;
    return false;
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get("/api/campaigns");
      // Only show active campaigns in the public view
      const activeCampaigns = response.data.campaigns.filter(
        (c: Campaign) => c.status === "active"
      );
      setCampaigns(activeCampaigns);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (category?: string) => {
    switch (category) {
      case "low":
        return {
          bg: "bg-emerald-500/20",
          text: "text-emerald-400",
          border: "border-emerald-500/30",
          icon: <FiCheckCircle className="w-3 h-3" />
        };
      case "medium":
        return {
          bg: "bg-amber-500/20",
          text: "text-amber-400",
          border: "border-amber-500/30",
          icon: <FiAlertTriangle className="w-3 h-3" />
        };
      case "high":
        return {
          bg: "bg-rose-500/20",
          text: "text-rose-400",
          border: "border-rose-500/30",
          icon: <FiShield className="w-3 h-3" />
        };
      default:
        return {
          bg: "bg-slate-500/20",
          text: "text-slate-400",
          border: "border-slate-500/30",
          icon: null
        };
    }
  };

  const filteredCampaigns = campaigns.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (typeof c.patientId === "object" ? c.patientId?.name || "" : "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 z-10"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      {/* Background Orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed top-[40%] left-[-10%] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/5 py-4 px-6 sm:px-10 flex flex-col sm:flex-row justify-between items-center bg-transparent backdrop-blur-xl">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active <span className="text-gradient">Campaigns</span></h1>
          <p className="text-sm text-slate-400">Discover and support verified medical needs</p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mt-4 sm:mt-0 flex items-center gap-3 w-full sm:w-auto">
          <div className="relative group w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-slate-400 group-focus-within:text-purple-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white placeholder-slate-500 transition-all text-sm"
            />
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="hidden sm:flex px-4 py-2 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all font-medium text-sm"
          >
            Dashboard
          </button>
          <ThemeToggle />
        </motion.div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-10 mt-8 relative z-10">
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-8">
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {filteredCampaigns.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-6">
              <FiSearch className="w-8 h-8 text-slate-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No campaigns found</h2>
            <p className="text-slate-400">We couldn't locate any active campaigns matching your criteria.</p>
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
              const riskStyles = getRiskBadge(campaign.riskCategory);
              
              return (
                <motion.div
                  key={campaign._id}
                  variants={itemVariants as any}
                  whileHover={{ y: -5 }}
                  className="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col group cursor-pointer"
                  onClick={() => navigate(`/campaign/${campaign._id}`)}
                >
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4 gap-2">
                      {campaign.riskCategory ? (
                        <div className={`px-2.5 py-1 rounded-md border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${riskStyles.bg} ${riskStyles.text} ${riskStyles.border}`}>
                          {riskStyles.icon}
                          {campaign.riskCategory} Risk
                        </div>
                      ) : (
                        <div className="px-2.5 py-1 bg-slate-800 rounded-md text-slate-400 text-xs font-semibold">
                          Unverified
                        </div>
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        {canEditCampaign(campaign) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/campaign/${campaign._id}/edit`);
                            }}
                            className="p-2 rounded-lg bg-white/10 hover:bg-purple-500/30 text-slate-300 hover:text-white border border-white/10 transition-colors"
                            title="Edit campaign"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                        )}
                        <div className="text-xs font-medium text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/5">
                          {campaign.status}
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-purple-300 transition-colors">
                      {campaign.title}
                    </h3>
                    
                    <p className="text-slate-400 text-sm mb-6 line-clamp-3 flex-1">
                      {campaign.description}
                    </p>

                    <div className="mt-auto space-y-4">
                      {/* Sub-info */}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">
                          By{" "}
                          {typeof campaign.patientId === "object"
                            ? campaign.patientId?.name || "Patient"
                            : "Patient"}
                        </span>
                      </div>

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
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 relative"
                          >
                            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-6 py-4 border-t border-white/5 bg-white-[0.02] flex justify-between items-center group-hover:bg-purple-500/10 transition-colors">
                    <span className="text-sm font-semibold text-purple-400">Read the full story</span>
                    <FiArrowRight className="text-purple-400 transform group-hover:translate-x-1 transition-transform" />
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
