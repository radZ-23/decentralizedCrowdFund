import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiActivity, FiArrowUpRight, FiArrowDownLeft, FiClock,
  FiCheckCircle, FiXCircle, FiSearch, FiFilter, FiDownload,
  FiExternalLink, FiCalendar, FiDollarSign
} from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Transaction {
  _id: string;
  type: 'donation' | 'milestone_release' | 'refund' | 'withdrawal';
  amount: string;
  currency: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  campaignId?: {
    _id: string;
    title: string;
  };
  createdAt: string;
  confirmedAt?: string;
  blockNumber?: number;
  gasUsed?: string;
  description?: string;
}

export default function TransactionHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'donation' | 'milestone_release' | 'refund'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // Try to fetch from backend transactions endpoint
      // Fallback to donations if transactions endpoint doesn't exist
      try {
        const res = await api.get('/api/transactions');
        setTransactions(res.data.transactions || []);
      } catch {
        // Fallback: fetch donations and map to transaction format
        const donationsRes = await api.get('/api/donations');
        const mapped = (donationsRes.data.donations || []).map((d: any) => ({
          _id: d._id,
          type: 'donation' as const,
          amount: d.amount,
          currency: 'ETH',
          status: d.status === 'confirmed' ? 'confirmed' : 'pending',
          txHash: d.transactionHash,
          campaignId: d.campaignId,
          createdAt: d.createdAt,
          confirmedAt: d.confirmedAt,
          description: `Donation to ${d.campaignId?.title || 'campaign'}`,
        }));
        setTransactions(mapped);
      }
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesType = filter === 'all' || tx.type === filter;
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    const matchesSearch = searchQuery === '' ||
      tx.txHash?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.campaignId?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Status', 'TX Hash', 'Description'];
    const rows = filteredTransactions.map((tx) => [
      new Date(tx.createdAt).toLocaleDateString(),
      tx.type.replace('_', ' '),
      `${tx.amount} ${tx.currency}`,
      tx.status,
      tx.txHash || 'N/A',
      tx.description || tx.campaignId?.title || 'N/A',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold">
            <FiCheckCircle className="w-4 h-4" /> Confirmed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold">
            <FiClock className="w-4 h-4" /> Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-full text-xs font-bold">
            <FiXCircle className="w-4 h-4" /> Failed
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'donation':
        return <FiArrowDownLeft className="w-5 h-5" />;
      case 'milestone_release':
        return <FiArrowUpRight className="w-5 h-5" />;
      case 'refund':
        return <FiArrowDownLeft className="w-5 h-5" />;
      default:
        return <FiActivity className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'donation':
        return 'from-emerald-500 to-teal-500';
      case 'milestone_release':
        return 'from-blue-500 to-cyan-500';
      case 'refund':
        return 'from-purple-500 to-pink-500';
      default:
        return 'from-slate-500 to-gray-500';
    }
  };

  const truncateHash = (hash?: string) => {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const openExplorer = (txHash?: string) => {
    if (!txHash) return;
    // Default to ethscan - can be enhanced to detect network
    window.open(`https://etherscan.io/tx/${txHash}`, '_blank', 'noopener,noreferrer');
  };

  const totalDonations = transactions
    .filter((tx) => tx.type === 'donation' && tx.status === 'confirmed')
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-900/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <FiActivity className="w-8 h-8 text-purple-400" />
                <h1 className="text-3xl font-black text-white">Transaction History</h1>
              </div>
              <p className="text-slate-400 font-medium mt-1">
                Track all your blockchain transactions
              </p>
            </div>

            <button
              onClick={exportToCSV}
              disabled={transactions.length === 0}
              className="px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-lg transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50"
            >
              <FiDownload className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel p-5 rounded-2xl border border-white/5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total Transactions</p>
                <p className="text-2xl font-black text-white mt-1">{transactions.length}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <FiActivity className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel p-5 rounded-2xl border border-white/5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total Donations</p>
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mt-1">
                  Ξ {totalDonations.toFixed(4)}
                </p>
              </div>
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <FiDollarSign className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel p-5 rounded-2xl border border-white/5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Confirmed</p>
                <p className="text-2xl font-black text-white mt-1">
                  {transactions.filter((tx) => tx.status === 'confirmed').length}
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <FiCheckCircle className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by hash, campaign name..."
              className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white text-sm"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white text-sm font-medium appearance-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="donation">Donations</option>
              <option value="milestone_release">Milestone Releases</option>
              <option value="refund">Refunds</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white text-sm font-medium appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="glass-panel p-16 text-center rounded-3xl border border-white/5">
              <FiActivity className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Transactions Found</h3>
              <p className="text-slate-400">
                {searchQuery || filter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Your transaction history will appear here'}
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <motion.div
                key={tx._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${getTypeColor(tx.type)} text-white flex-shrink-0`}>
                    {getTypeIcon(tx.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="font-bold text-white text-base">
                          {tx.description || tx.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </h3>
                        {tx.campaignId && (
                          <button
                            onClick={() => navigate(`/campaign/${tx.campaignId._id}`)}
                            className="text-sm text-purple-400 hover:text-purple-300 transition-colors mt-1"
                          >
                            {tx.campaignId.title}
                          </button>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <FiCalendar className="w-3 h-3" />
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </span>
                          {tx.txHash && (
                            <button
                              onClick={() => openExplorer(tx.txHash)}
                              className="text-xs text-slate-500 hover:text-purple-400 font-medium flex items-center gap-1 transition-colors"
                            >
                              <FiExternalLink className="w-3 h-3" />
                              {truncateHash(tx.txHash)}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-white">
                          {tx.type === 'refund' ? '-' : '+'}Ξ {parseFloat(tx.amount).toFixed(4)}
                        </p>
                        <div className="mt-2">{getStatusBadge(tx.status)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {tx.blockNumber && (
                  <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500 font-bold uppercase mb-1">Block</p>
                      <p className="text-white font-medium">{tx.blockNumber}</p>
                    </div>
                    {tx.gasUsed && (
                      <div>
                        <p className="text-slate-500 font-bold uppercase mb-1">Gas Used</p>
                        <p className="text-white font-medium">{tx.gasUsed}</p>
                      </div>
                    )}
                    {tx.confirmedAt && (
                      <div>
                        <p className="text-slate-500 font-bold uppercase mb-1">Confirmed At</p>
                        <p className="text-white font-medium">{new Date(tx.confirmedAt).toLocaleString()}</p>
                      </div>
                    )}
                    {tx.fromAddress && (
                      <div>
                        <p className="text-slate-500 font-bold uppercase mb-1">From</p>
                        <p className="text-white font-mono text-xs truncate">{truncateHash(tx.fromAddress)}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
