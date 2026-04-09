import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiLink, FiLayers, FiShield, FiExternalLink } from "react-icons/fi";
import api from "../services/api";

export default function AdminContracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/contracts");
      setContracts(res.data.contracts || []);
    } catch (err) {
      console.error("Failed to load contracts", err);
    } finally {
      setLoading(false);
    }
  };

  const getExplorerBase = (network?: string) => {
    switch ((network || "").toLowerCase()) {
      case "polygon":
      case "amoy":
        return "https://amoy.polygonscan.com";
      case "mumbai":
        return "https://mumbai.polygonscan.com";
      case "sepolia":
        return "https://sepolia.etherscan.io";
      case "ethereum":
        return "https://etherscan.io";
      default:
        return null; // hardhat / unknown
    }
  };

  const openExplorer = (contract: any) => {
    const base = getExplorerBase(contract?.network);
    if (!base || !contract?.contractAddress) return;
    window.open(`${base}/address/${contract.contractAddress}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-10 relative z-10">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">
              Smart Contracts
            </h1>
            <p className="text-slate-400 mt-2 font-medium">Monitor active Escrow deployments and on-chain addresses</p>
          </motion.div>
          
          <motion.button
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/admin/dashboard")}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          >
             ← Admin Center
          </motion.button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : contracts.length === 0 ? (
          <div className="glass-panel p-16 text-center rounded-3xl border border-white/5">
            <FiLayers className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Contracts Deployed</h3>
            <p className="text-slate-400">Blockchain escrow contracts will populate here once campaigns are successfully authorized.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {contracts.map((c) => (
                <motion.div key={c._id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 rounded-3xl border border-emerald-500/20 relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-lg hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                      <FiShield className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">ACTIVE ESCROW</span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 truncate">{c.campaignId?.title || "Campaign"}</h3>
                  <p className="text-xs text-slate-400 uppercase font-black tracking-widest mb-4">Target: {c.campaignId?.targetAmount || "N/A"} ETH</p>

                  <div className="space-y-3">
                    <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Contract Address</p>
                      <div className="flex items-center gap-2 text-indigo-300 font-mono text-sm">
                        <FiLink /> <span className="truncate">{c.contractAddress}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-4">
                      <div>
                        <p className="text-xs text-slate-400">Deployed At</p>
                      <p className="text-sm font-medium text-white">
                        {c.deployedAt ? new Date(c.deployedAt).toLocaleDateString() : "—"}
                      </p>
                      </div>
                    <button
                      onClick={() => openExplorer(c)}
                      disabled={!getExplorerBase(c?.network)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={getExplorerBase(c?.network) ? "View on explorer" : "Explorer not available for this network"}
                    >
                        <FiExternalLink className="w-5 h-5"/>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  );
}
