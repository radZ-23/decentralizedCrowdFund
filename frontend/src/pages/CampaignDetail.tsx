import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import { 
  FiArrowLeft, FiShield, FiHeart, FiCheckCircle, 
  FiFileText, FiUser, FiActivity, FiDollarSign, FiClock, FiAlertTriangle, FiEdit2
} from "react-icons/fi";
import { ethers } from "ethers";
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
  smartContractAddress?: string;
  patientId?: string | {
    _id?: string;
    name: string;
    walletAddress?: string;
  };
  hospitalId?: {
    hospitalName: string;
    verified: boolean;
  };
  milestones?: Array<{
    description: string;
    targetAmount: number;
    status: string;
  }>;
  documents?: Array<{
    type: string;
    url: string;
    hash: string;
  }>;
}

interface Donation {
  _id: string;
  amount: number;
  donorName?: string;
  createdAt: string;
  donorMessage?: string;
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [donationAmount, setDonationAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const { user } = useAuth();
  const [deployingContract, setDeployingContract] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCampaign();
      fetchDonations();
    }
  }, [id]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/campaigns/${id}`);
      setCampaign(response.data.campaign);
    } catch (err: any) {
      console.error("Failed to fetch campaign:", err);
      setError(err.response?.data?.error || "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  const fetchDonations = async () => {
    try {
      const response = await api.get(`/api/donations/campaign/${id}`);
      setDonations(response.data.donations || []);
    } catch (err: any) {
      console.error("Failed to fetch donations:", err);
    }
  };

  const deployContract = async () => {
    try {
      setDeployingContract(true);
      setError("");
      const response = await api.post(`/api/campaigns/${id}/deploy-contract`);
      alert(`Contract deployed successfully to ${response.data.contractAddress}`);
      fetchCampaign();
    } catch (err: any) {
      console.error("Failed to deploy contract:", err);
      setError(err.response?.data?.error || "Failed to deploy contract");
    } finally {
      setDeployingContract(false);
    }
  };

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      alert("MetaMask not installed. Please install MetaMask to donate.");
      return;
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      setWalletConnected(true);
      setWalletAddress(accounts[0]);
      localStorage.setItem("walletAddress", accounts[0]);
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      setError("Failed to connect wallet");
    }
  };

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      setError("Please enter a valid donation amount");
      return;
    }

    if (!campaign?.smartContractAddress) {
      setError("Smart contract not deployed yet. Please wait for admin deployment.");
      return;
    }

    try {
      setDonating(true);
      setError("");

      if (!(window as any).ethereum) {
        setError("MetaMask not installed. Please install MetaMask to donate.");
        return;
      }

      // Donor signs the donation on-chain (non-custodial).
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        campaign.smartContractAddress,
        ["function donate() external payable"],
        signer,
      );

      const valueWei = ethers.parseEther(donationAmount.toString());
      const tx = await contract.donate({ value: valueWei });
      await tx.wait();

      // Backend verifies tx + records donation.
      await api.post(`/api/donations`, {
        campaignId: id,
        amount: parseFloat(donationAmount),
        transactionHash: tx.hash,
      });

      alert(`Donation successful!\nTransaction: ${tx.hash.slice(0, 20)}...`);
      setDonationAmount("");
      fetchCampaign();
      fetchDonations();
    } catch (err: any) {
      console.error("Donation error:", err);
      setError(err.response?.data?.error || "Failed to process donation");
    } finally {
      setDonating(false);
    }
  };

  const handleConfirmMilestone = async (milestoneIndex: number) => {
    if (!walletConnected) {
      await connectWallet();
      if (!walletConnected) return;
    }

    try {
      setDonating(true);
      setError("");

      let txHash = undefined;

      if (campaign?.smartContractAddress && (window as any).ethereum) {
        const methodId = "0x29315ea7"; // confirmMilestone(uint256)
        const paddedIndex = milestoneIndex.toString(16).padStart(64, '0');
        const data = methodId + paddedIndex;
        
        const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
        txHash = await (window as any).ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            to: campaign.smartContractAddress,
            from: accounts[0],
            data: data
          }]
        });
      }

      await api.post(`/api/milestones/${id}/confirm`, {
        milestoneIndex,
        transactionHash: txHash
      });

      alert(`Milestone confirmed successfully!\n${txHash ? 'Transaction: ' + txHash.slice(0, 20) + '...' : ''}`);
      fetchCampaign();
    } catch (err: any) {
      console.error("Confirmation error:", err);
      setError(err.response?.data?.error || err.message || "Failed to confirm milestone");
    } finally {
      setDonating(false);
    }
  };

  const getRiskBadgeColor = (category?: string) => {
    switch (category) {
      case "low":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "medium":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "high":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  const getProgressPercentage = (raised: number, target: number) => {
    return Math.min(100, Math.round((raised / target) * 100));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950" />
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 z-10"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
        <div className="text-center z-10 glass-card p-10 rounded-3xl max-w-lg border border-red-500/20">
          <FiActivity className="w-16 h-16 text-red-500 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-bold text-white mb-4">Wait a second...</h2>
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
        <div className="text-center z-10 glass-card p-10 rounded-3xl">
          <FiActivity className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-bold text-white mb-4">Campaign not found</h2>
          <button
            onClick={() => navigate("/campaigns")}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all"
          >
            Browse Campaigns
          </button>
        </div>
      </div>
    );
  }

  const progress = getProgressPercentage(campaign.raisedAmount, campaign.targetAmount);

  const ownerPatientId =
    campaign.patientId == null
      ? ""
      : typeof campaign.patientId === "string"
        ? campaign.patientId
        : String(campaign.patientId._id || "");
  const canEditCampaign =
    Boolean(user && (user.role === "admin" || (user.role === "patient" && ownerPatientId === user.id)));

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      {/* Background Ambience */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Modern Top Header Nav */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/5 py-4 px-6 flex justify-between items-center bg-transparent backdrop-blur-xl">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/campaigns")}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <FiArrowLeft className="w-5 h-5" />
          <span className="font-medium hidden sm:inline">Back to Campaigns</span>
        </motion.button>
        <div className="flex items-center gap-3">
          {canEditCampaign && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              type="button"
              onClick={() => navigate(`/campaign/${id}/edit`)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-sm font-semibold border border-purple-500/30"
            >
              <FiEdit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </motion.button>
          )}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-lg font-bold text-white tracking-tight">MedTrustFund</h2>
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-10 mt-8 relative z-10">
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-300 font-medium text-sm text-center">{error}</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Main Content & Details */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Context Panel */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-3xl p-8 border border-white/10 relative overflow-hidden"
            >
              {/* Decorative gradient corner */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-[50px] pointer-events-none" />

              <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4 relative z-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                  {campaign.title}
                </h1>
                
                {campaign.riskCategory && (
                  <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 shrink-0 ${getRiskBadgeColor(campaign.riskCategory)}`}>
                    {campaign.riskCategory === "low" ? <FiCheckCircle className="w-4 h-4" /> : <FiShield className="w-4 h-4" />}
                    <span className="text-sm font-bold uppercase tracking-wider">{campaign.riskCategory} Risk</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-white/5 py-1.5 px-3 rounded-full border border-white/5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="font-semibold uppercase tracking-wider">{campaign.status.replace("_", " ")}</span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed text-lg whitespace-pre-line relative z-10 mb-8">
                {campaign.description}
              </p>

              {/* Patient & Hospital Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl">
                    <FiUser className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Beneficiary</p>
                    <p className="text-white font-medium">
                      {typeof campaign.patientId === "object" && campaign.patientId?.name
                        ? campaign.patientId.name
                        : "Anonymous Patient"}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <FiActivity className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Treatment Facility</p>
                    <p className="text-white font-medium flex items-center gap-2">
                      {campaign.hospitalId?.hospitalName || "Not assigned"}
                      {campaign.hospitalId?.verified && (
                        <FiCheckCircle className="text-emerald-400 w-4 h-4" />
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Milestones Panel */}
            {campaign.milestones && campaign.milestones.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card rounded-3xl p-8 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg"><FiClock className="w-5 h-5"/></div>
                  <h3 className="text-xl font-bold text-white">Treatment Milestones</h3>
                </div>
                
                <div className="space-y-4">
                  {campaign.milestones.map((m, idx) => {
                    const isCompleted = m.status === "confirmed" || m.status === "released";
                    return (
                      <div
                        key={idx}
                        className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                          isCompleted
                            ? "bg-emerald-500/10 border-emerald-500/20"
                            : "bg-slate-900/50 border-white/5"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border ${
                            isCompleted ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-500'
                          }`}>
                            {isCompleted ? <FiCheckCircle className="w-4 h-4" /> : <span className="text-xs">{idx + 1}</span>}
                          </div>
                          <div>
                            <span className={`font-semibold block mb-1 ${isCompleted ? 'text-emerald-300' : 'text-slate-300'}`}>
                              {m.description}
                            </span>
                            <span
                              className={`inline-flex text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold ${
                                isCompleted
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-10 sm:ml-0">
                          <span className="text-lg font-bold text-white block">
                            {m.targetAmount.toFixed(2)} ETH
                          </span>
                          {!isCompleted && campaign.status === "active" && (
                            <button
                               onClick={() => handleConfirmMilestone(idx)}
                               disabled={donating}
                               className="mt-2 text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-md hover:bg-emerald-500/40 disabled:opacity-50 transition-colors"
                            >
                               {donating ? "Processing..." : "Confirm (Hospital)"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Documents Panel */}
            {campaign.documents && campaign.documents.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card rounded-3xl p-8 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><FiFileText className="w-5 h-5"/></div>
                  <h3 className="text-xl font-bold text-white">Verified Documents</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {campaign.documents.map((doc, idx) => (
                    <div key={idx} className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-slate-800/80 transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm font-bold text-white capitalize mb-1 group-hover:text-purple-300 transition-colors">
                          {doc.type.replace("_", " ")}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono tracking-wider">
                          {doc.hash?.slice(0, 16)}...
                        </p>
                      </div>
                      <div className="text-slate-500 group-hover:text-purple-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Donations History Panel */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card rounded-3xl p-8 border border-white/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-pink-500/20 text-pink-400 rounded-lg"><FiHeart className="w-5 h-5"/></div>
                <h3 className="text-xl font-bold text-white">Recent Supporters</h3>
              </div>
              
              {donations.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/30 rounded-2xl border border-white/5 border-dashed">
                  <FiHeart className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No donations yet. Be the first to make an impact!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {donations.slice(0, 5).map((d) => (
                    <div
                      key={d._id}
                      className="flex justify-between items-center p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-pink-500/20 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10">
                          <FiUser className="w-5 h-5 text-purple-300" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-200">
                            {d.donorName || "Anonymous Guardian"}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                            {new Date(d.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                          {d.amount.toFixed(4)} ETH
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* RIGHT: Floating Action Card */}
          <div className="lg:col-span-1">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 sticky top-24 shadow-2xl"
            >
              {/* Progress Section */}
              <div className="mb-8">
                <div className="text-center mb-6">
                  <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    {campaign.raisedAmount.toFixed(2)} ETH
                  </p>
                  <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">Raised of {campaign.targetAmount.toFixed(2)} Target</p>
                </div>
                
                <div className="w-full bg-slate-900/80 rounded-full h-4 mb-3 border border-white/5 overflow-hidden p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full relative"
                  >
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                  </motion.div>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>0%</span>
                  <span className="text-purple-400">{progress}% Funded</span>
                </div>
              </div>

              {/* Web3 Contract Status */}
              {campaign.smartContractAddress ? (
                <div className="mb-8 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[30px] pointer-events-none" />
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm mb-1 relative z-10">
                    <FiCheckCircle className="w-4 h-4" /> Smart Contract Active
                  </div>
                  <p className="text-[10px] text-emerald-200/70 font-mono mt-1 px-4 py-1.5 bg-emerald-900/30 rounded-lg inline-block border border-emerald-500/10 relative z-10 truncate w-full">
                    {campaign.smartContractAddress}
                  </p>
                </div>
              ) : (
                <div className="mb-8 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center">
                  <p className="text-sm text-amber-400 font-bold flex items-center justify-center gap-2">
                    <FiClock className="w-4 h-4" /> Awaiting Deployment
                  </p>
                </div>
              )}

              {/* Donation Form */}
              {campaign.status === "active" && campaign.smartContractAddress ? (
                <form onSubmit={handleDonate} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
                      Join the Cause
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FiDollarSign className="text-purple-400/50 w-5 h-5" />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={donationAmount}
                        onChange={(e) => setDonationAmount(e.target.value)}
                        placeholder="Amount in ETH..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-900/60 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white placeholder-slate-600 transition-all text-center text-lg font-bold"
                        required
                      />
                    </div>
                  </div>

                  {!walletConnected ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={connectWallet}
                      className="w-full px-4 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M21.9 11.2l-9.8-9.8a1.5 1.5 0 0 0-2.1 0l-9.8 9.8a1.5 1.5 0 0 0 0 2.1l9.8 9.8c.6.6 1.5.6 2.1 0l9.8-9.8c.6-.5.6-1.5 0-2.1zm-8.8 3.3a5 5 0 1 1 0-9.9 5 5 0 0 1 0 9.9z" opacity=".8"/><path d="M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
                      Connect Wallet
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={donating}
                      className="w-full px-4 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg uppercase tracking-wider"
                    >
                      {donating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FiHeart className="w-5 h-5" /> Donate {donationAmount && `${donationAmount} ETH`}
                        </>
                      )}
                    </motion.button>
                  )}

                  {walletConnected && (
                    <div className="text-center py-2 px-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Connected Address</p>
                      <p className="text-xs text-purple-300 font-mono">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </p>
                    </div>
                  )}
                </form>
              ) : (
                <div className="text-center py-6 px-4 bg-slate-900/50 rounded-2xl border border-white/5 border-dashed">
                  <FiAlertTriangle className="w-8 h-8 text-amber-500/50 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-300">
                    {campaign.status !== "active"
                      ? "Campaign not active"
                      : "Awaiting contract deployment"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Donations are currently disabled.</p>
                  
                  {campaign.status === "active" && user?.role === "admin" && (
                    <>
                  {(!campaign.milestones || campaign.milestones.length === 0) && (
                    <p className="text-xs text-rose-300/90 text-left mb-3 leading-relaxed">
                      No milestones on this campaign (common if it was created before milestone fixes). Deploy is blocked until milestones exist — create a new campaign from the patient flow or update this record in the database.
                    </p>
                  )}
                  {campaign.milestones && campaign.milestones.length > 0 && !campaign.hospitalId && (
                    <p className="text-xs text-amber-200/90 text-left mb-3 leading-relaxed">
                      Assign a verified hospital (with a wallet on their profile) before deploying escrow — the contract needs a hospital address.
                    </p>
                  )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={deployContract}
                      disabled={
                        deployingContract ||
                        !campaign.milestones?.length ||
                        !campaign.hospitalId
                      }
                      className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500 hover:to-teal-500 text-emerald-300 hover:text-white border border-emerald-500/30 font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deployingContract ? (
                        <>
                          <div className="w-4 h-4 border-2 border-emerald-200/30 border-t-emerald-200 rounded-full animate-spin" />
                          Deploying Smart Contract...
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                          Launch Smart Contract
                        </>
                      )}
                    </motion.button>
                    </>
                  )}
                </div>
              )}

              {/* Risk Score AI Assurance footer */}
              {campaign.riskScore !== undefined && (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <FiShield className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      AI Veracity Check
                    </h4>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-400">Confidence Score</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black ${campaign.riskScore < 40 ? 'text-emerald-400' : campaign.riskScore < 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {100 - campaign.riskScore}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="w-full bg-slate-900 rounded-full h-1.5 mb-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${campaign.riskScore < 40 ? 'bg-emerald-500' : campaign.riskScore < 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${100 - campaign.riskScore}%` }}
                    />
                  </div>
                  
                  <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-wider">
                    {campaign.riskScore < 40
                      ? "✓ High confidence in document authenticity automatically verified by AI."
                      : campaign.riskScore < 70
                      ? "⚠ Moderate anomaly levels detected. Proceed with standard caution."
                      : "✕ High risk profile manually flagged for further review."}
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
