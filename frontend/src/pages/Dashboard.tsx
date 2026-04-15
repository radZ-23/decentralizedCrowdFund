import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiLogOut, FiLayout, FiHeart, FiActivity, FiUser, 
  FiPlusCircle, FiList, FiTrendingUp, FiCheckCircle, 
  FiBriefcase, FiUsers, FiShield, FiLink, FiClipboard
} from 'react-icons/fi';
import WalletConnectButton from '../components/ui/WalletConnectButton';
import ThemeToggle from '../components/ui/ThemeToggle';
import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (!token || !savedUser) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
    } catch (err) {
      setError('Failed to load user data');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-transparent" />
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 z-10"></div>
      </div>
    );
  }

  if (!user) return null;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  // Helper for generating role-specific cards
  const renderCards = () => {
    let cards: any[] = [];

    if (user.role === 'donor') {
      cards = [
        { title: 'Browse Campaigns', desc: 'Discover and support medical campaigns', icon: <FiActivity />, link: '/campaigns', color: 'from-blue-500 to-cyan-400' },
        { title: 'My Donations', desc: 'Track your donations and impact', icon: <FiHeart />, link: '/my-donations', color: 'from-pink-500 to-rose-400' },
        { title: 'KYC verification', desc: 'Submit identity documents for admin review', icon: <FiShield />, link: '/kyc-submission', color: 'from-violet-500 to-fuchsia-400' },
        { title: 'My Profile', desc: 'Update your profile and wallet', icon: <FiUser />, link: '/profile', color: 'from-purple-500 to-indigo-400' },
        { title: 'Nearby Hospitals', desc: 'Find hospitals near you on the map', icon: <FiMapPin />, link: '/nearby-hospitals', color: 'from-red-500 to-rose-400' },
      ];
    } else if (user.role === 'patient') {
      cards = [
        { title: 'Create Campaign', desc: 'Start a fundraising campaign', icon: <FiPlusCircle />, link: '/create-campaign', color: 'from-emerald-500 to-teal-400' },
        { title: 'My Campaigns', desc: 'Manage your campaigns', icon: <FiList />, link: '/my-campaigns', color: 'from-purple-500 to-fuchsia-400' },
        { title: 'Analytics', desc: 'Track your fundraising progress', icon: <FiTrendingUp />, link: '/analytics', color: 'from-amber-500 to-orange-400' },
        { title: 'KYC verification', desc: 'Submit identity documents for admin review', icon: <FiShield />, link: '/kyc-submission', color: 'from-violet-500 to-fuchsia-400' },
        { title: 'Nearby Hospitals', desc: 'Find hospitals near you on the map', icon: <FiMapPin />, link: '/nearby-hospitals', color: 'from-red-500 to-rose-400' },
      ];
    } else if (user.role === 'hospital') {
      cards = [
        { title: 'KYC verification', desc: 'Submit hospital identity documents', icon: <FiShield />, link: '/kyc-submission', color: 'from-violet-500 to-fuchsia-400' },
        { title: 'Verify Milestones', desc: 'Confirm treatment milestones', icon: <FiCheckCircle />, link: '/milestones', color: 'from-green-500 to-emerald-400' },
        { title: 'Assigned Campaigns', desc: 'View campaigns assigned to you', icon: <FiList />, link: '/my-campaigns', color: 'from-indigo-500 to-blue-400' },
        { title: 'Hospital Info', desc: 'Manage hospital profile', icon: <FiBriefcase />, link: '/hospital-profile', color: 'from-purple-500 to-pink-400' },
        { title: 'Nearby Hospitals', desc: 'Find hospitals near you on the map', icon: <FiMapPin />, link: '/nearby-hospitals', color: 'from-red-500 to-rose-400' },
      ];
    } else if (user.role === 'admin') {
      cards = [
        { title: 'User Management', desc: 'Manage all platform users', icon: <FiUsers />, link: '/admin/users', color: 'from-blue-500 to-cyan-400' },
        { title: 'System Dashboard', desc: 'View platform statistics', icon: <FiLayout />, link: '/admin/dashboard', color: 'from-purple-500 to-indigo-400' },
        { title: 'KYC review', desc: 'Review documents & approve submissions', icon: <FiShield />, link: '/admin/kyc-review', color: 'from-fuchsia-500 to-pink-400' },
        { title: 'Audit Logs', desc: 'Review system audit trail', icon: <FiClipboard />, link: '/admin/audit-logs', color: 'from-amber-500 to-orange-400' },
        { title: 'Nearby Hospitals', desc: 'Find hospitals near you on the map', icon: <FiMapPin />, link: '/nearby-hospitals', color: 'from-red-500 to-rose-400' },
      ];
    }

    return (
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 mt-8">
        {cards.map((card, idx) => (
          <motion.div 
            key={idx}
            variants={itemVariants}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            onClick={() => navigate(card.link)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(card.link);
              }
            }}
            className="glass-card rounded-2xl p-6 cursor-pointer relative overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/80"
          >
            {/* Ambient Background Glow */}
            <div className={`absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br ${card.color} rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity duration-500`} />
            
            <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${card.color} text-white mb-4 shadow-lg`}>
              <span className="text-xl">{card.icon}</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{card.title}</h3>
            <p className="text-slate-400 text-sm mb-6">{card.desc}</p>
            
            <div className="flex items-center text-sm font-semibold text-white/70 group-hover:text-white transition-colors">
              <span>View Details</span>
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </motion.div>
        ))}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Dynamic Backgrounds */}
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-900/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Modern Sidebar layout wrapper (Sidebar hidden on mobile for simplicity, but flex row established) */}
      <div className="flex w-full relative z-10">
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
          {/* Header */}
          <header className="sticky top-0 z-30 glass-panel border-b-0 border-white/5 py-4 px-6 sm:px-10 flex justify-between items-center bg-transparent backdrop-blur-xl">
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl font-bold text-gradient tracking-tight"
            >
              MedTrustFund
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4 sm:gap-6"
            >
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-slate-200">{user.fullName || user.name}</p>
                <div className="flex justify-end items-center mt-0.5">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      user.role === 'admin'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                        : user.role === 'hospital'
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                          : user.role === 'donor'
                            ? 'bg-pink-500/15 text-pink-300 border-pink-500/35'
                            : user.role === 'patient'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              </div>
              <ThemeToggle />
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center p-2.5 sm:px-4 sm:py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-xl transition-all font-semibold"
                  title="Logout"
                >
                  <FiLogOut className="w-5 h-5 sm:mr-2" />
                  <span className="hidden sm:block">Logout</span>
                </button>
              </motion.div>
            </motion.div>
          </header>

          <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-10 py-10 pb-20">
            {/* Welcome Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-10"
            >
              <h2 className="text-4xl font-extrabold text-white mb-3">
                Welcome back, {user.fullName?.split(' ')[0] || user.name?.split(' ')[0]}! 👋
              </h2>
              <p className="text-slate-400 text-lg">
                Here is what's happening with your account today.
              </p>
            </motion.div>

            {error && (
              <div className="mb-8 bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex gap-3 items-center">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                <p className="text-red-300 font-medium">{error}</p>
              </div>
            )}

            {/* Render Contextual Dashboard Cards */}
            {renderCards()}

            {/* Wallet Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8"
            >
              {user.walletAddress ? (
                <div className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden">
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Connected wallet</h3>
                      <p className="text-slate-400 text-sm">Network matches your MetaMask / wallet extension (e.g. local Hardhat or testnet).</p>
                    </div>
                  </div>
                  <div className="bg-black/30 border border-white/5 p-4 rounded-xl font-mono text-sm sm:text-base text-indigo-300 break-all">
                    {user.walletAddress}
                  </div>
                </div>
              ) : (
                <div className="glass-card bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <FiLink className="text-purple-400" /> Connect Wallet
                    </h3>
                    <p className="text-slate-400 max-w-xl">
                      Connect your Web3 wallet to participate in secure, blockchain-based decentralized crowdfunding transactions.
                    </p>
                  </div>
                  <div className="w-full sm:w-auto mt-4 sm:mt-0">
                    <WalletConnectButton 
                      onConnect={async (address) => {
                        const updatedUser = { ...user, walletAddress: address };
                        setUser(updatedUser);
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        try {
                          await api.put('/auth/profile', { walletAddress: address });
                        } catch (err) {
                          console.error("Failed to sync wallet address", err);
                        }
                      }} 
                    />
                  </div>
                </div>
              )}
            </motion.div>

          </div>
        </main>
      </div>
    </div>
  );
}
