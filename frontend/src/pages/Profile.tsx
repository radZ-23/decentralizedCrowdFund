import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiUser, FiActivity, FiLogOut, FiEdit3, FiAward, FiShield, FiMail, FiBell, FiCheck } from "react-icons/fi";
import WalletConnectButton from "../components/ui/WalletConnectButton";
import { useAuth } from "../contexts/AuthContext";
import { signMessage } from "../utils/web3";
import api from "../services/api";

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, verifyWallet, refreshUser } = useAuth();
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({
    campaignUpdates: true,
    donationNotifications: true,
    milestoneAlerts: true,
    kycStatus: true,
    marketingEmails: false,
  });

  useEffect(() => {
    if (!user) navigate("/login");
    // Load email preferences from localStorage or user data
    const stored = localStorage.getItem(`email_prefs_${user?.id}`);
    if (stored) {
      setEmailPrefs(JSON.parse(stored));
    }
  }, [navigate, user?.id]);

  if (!user) return null;

  const handlePrefChange = async (key: keyof typeof emailPrefs) => {
    const newPrefs = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(newPrefs);
    setSavingPrefs(true);
    try {
      // Save to localStorage immediately for responsiveness
      localStorage.setItem(`email_prefs_${user.id}`, JSON.stringify(newPrefs));
      // Optionally sync to backend
      await api.put('/api/user/preferences', { emailPreferences: newPrefs }).catch(() => {});
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleLinkWallet = async (address: string) => {
    try {
      setLinking(true);
      setLinkError("");
      const message = `MedTrustFund wallet verification for user ${user.id}`;
      const signature = await signMessage(message);
      await verifyWallet(address, signature);
      await refreshUser();
    } catch (e: any) {
      setLinkError(e?.message || "Failed to link wallet");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-900/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-white">My Profile</h1>
            <p className="text-slate-400 font-medium">Manage your settings and account details</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="px-4 py-2 border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500 hover:text-white rounded-lg transition-all flex items-center gap-2 font-bold"
          >
            <FiLogOut /> Logout
          </button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-500/20 to-purple-500/20" />
          
          <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center -mt-2">
            <div className="w-28 h-28 bg-slate-900 rounded-full border-4 border-slate-800 shadow-2xl flex items-center justify-center text-indigo-400 text-4xl relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-blue-500/10" />
              <FiUser />
              <div className="absolute bottom-0 w-full h-8 bg-black/60 flex items-center justify-center cursor-pointer hover:bg-indigo-500/80 transition-colors">
                <FiEdit3 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
                    {user.name || user.fullName}
                    {user.role === 'donor' && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 uppercase tracking-wider"><FiAward/> Sustainer</span>}
                  </h2>
                  <p className="text-slate-400">{user.email}</p>
                </div>
                <span className="capitalize px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold rounded-lg text-sm self-start shadow-inner shadow-indigo-500/10">
                  {user.role} Account
                </span>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/5 space-y-6">
            <div className="p-5 bg-slate-900/50 rounded-2xl border border-white/5 relative overflow-hidden group-hover:border-indigo-500/20 transition-all">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><FiShield/> Connected Wallet</h3>
              <p className="font-mono text-sm text-indigo-300 break-all p-3 bg-black/30 rounded-lg border border-white/5">
                {user.walletAddress || "No wallet connected yet"}
              </p>
              {!user.walletAddress && (
                <div className="mt-3 space-y-3">
                  <div className={linking ? "opacity-60 pointer-events-none" : ""}>
                    <WalletConnectButton
                      compact
                      onConnect={(address) => {
                        // Only attempt verification for real MetaMask addresses.
                        if (address?.startsWith("0x") && address.length === 42 && window.ethereum) {
                          handleLinkWallet(address);
                        }
                      }}
                    />
                  </div>
                  {linking && (
                    <p className="text-xs text-slate-400">
                      Waiting for signature approval in MetaMask…
                    </p>
                  )}
                  {linkError && (
                    <p className="text-xs text-red-300">{linkError}</p>
                  )}
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Connect + sign to verify ownership
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-5 bg-slate-900/50 rounded-2xl border border-white/5 relative overflow-hidden group-hover:border-purple-500/20 transition-all">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><FiActivity/> Platform Activity</h3>
              <div className="flex gap-4">
                <div className="flex-1 bg-black/30 rounded-lg p-3 border border-white/5 text-center cursor-pointer hover:bg-indigo-500/10 transition-colors" onClick={() => navigate('/campaigns')}>
                  <p className="text-2xl font-black text-white">12</p>
                  <p className="text-[10px] uppercase text-slate-500 font-bold mt-1">Campaigns Viewed</p>
                </div>
                <div className="flex-1 bg-black/30 rounded-lg p-3 border border-white/5 text-center cursor-pointer hover:bg-pink-500/10 transition-colors" onClick={() => navigate('/my-donations')}>
                  <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-400">Activity</p>
                  <p className="text-[10px] uppercase text-slate-500 font-bold mt-1">View Donations</p>
                </div>
              </div>
            </div>

            {/* Email Preferences Section */}
            <div className="p-5 bg-slate-900/50 rounded-2xl border border-white/5 relative overflow-hidden group-hover:border-emerald-500/20 transition-all">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                <FiMail /> Email Notifications
              </h3>
              <div className="space-y-3">
                {[
                  { key: 'campaignUpdates', label: 'Campaign Updates', desc: 'Status changes and reviews' },
                  { key: 'donationNotifications', label: 'Donation Alerts', desc: 'When you receive donations' },
                  { key: 'milestoneAlerts', label: 'Milestone Notifications', desc: 'Milestone confirmations and releases' },
                  { key: 'kycStatus', label: 'KYC Status', desc: 'Verification status updates' },
                  { key: 'marketingEmails', label: 'Platform Updates', desc: 'New features and announcements' },
                ].map((pref) => (
                  <div
                    key={pref.key}
                    className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 hover:border-emerald-500/20 transition-all"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{pref.label}</p>
                      <p className="text-xs text-slate-500">{pref.desc}</p>
                    </div>
                    <button
                      onClick={() => handlePrefChange(pref.key as keyof typeof emailPrefs)}
                      disabled={savingPrefs}
                      className={`relative w-12 h-6 rounded-full transition-all ${
                        emailPrefs[pref.key as keyof typeof emailPrefs]
                          ? 'bg-emerald-500'
                          : 'bg-slate-600'
                      } ${savingPrefs ? 'opacity-50' : ''}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                          emailPrefs[pref.key as keyof typeof emailPrefs] ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              {savingPrefs && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                  <FiCheck className="w-3 h-3" /> Saving...
                </p>
              )}
            </div>

            {/* Quick Links */}
            <div className="p-5 bg-slate-900/50 rounded-2xl border border-white/5 relative overflow-hidden group-hover:border-purple-500/20 transition-all">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                <FiBell /> Quick Links
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate('/kyc-submission')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white font-medium transition-all"
                >
                  KYC Submission
                </button>
                <button
                  onClick={() => navigate('/transactions')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white font-medium transition-all"
                >
                  Transaction History
                </button>
                <button
                  onClick={() => navigate('/notifications')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white font-medium transition-all"
                >
                  Notifications
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
