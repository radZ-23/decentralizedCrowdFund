import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiDatabase, FiDownload, FiInfo, FiSearch, FiCalendar } from "react-icons/fi";
import api from "../services/api";

interface AuditLog {
  _id: string;
  userId: any;
  action: string;
  entityType: string;
  entityId: string;
  status: string;
  createdAt: string;
}

export default function AdminAuditLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/audit-logs", {
        params: { page, limit: 200 },
      });
      setLogs(res.data.auditLogs || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/api/admin/audit-logs/export");
      const json = JSON.stringify(res.data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medtrustfund_audit_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to export compliance logs.");
    }
  };

  const filteredLogs = logs.filter(l => 
    l.action.toLowerCase().includes(search.toLowerCase()) || 
    l.entityType.toLowerCase().includes(search.toLowerCase()) ||
    l.userId?.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-10 relative z-10">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">
              Audit & Compliance
            </h1>
            <p className="text-slate-400 mt-2 font-medium">5-Year Immutable Retention Records</p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-4">
            <button
              onClick={handleExport}
              className="px-6 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center gap-2"
            >
              <FiDownload/> Export JSON
            </button>
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
            >
               ← Admin Center
            </button>
          </motion.div>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-white/10 mb-8 max-w-lg">
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by action, email, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider relative border-b border-white/5">
                  <th className="px-6 py-4 font-black w-1/4"><FiDatabase className="inline h-4 w-4 mr-2"/> Action</th>
                  <th className="px-6 py-4 font-black">User Email</th>
                  <th className="px-6 py-4 font-black">Entity</th>
                  <th className="px-6 py-4 font-black">Status</th>
                  <th className="px-6 py-4 font-black text-right"><FiCalendar className="inline h-4 w-4 mr-2"/> Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500 mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                      <FiInfo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      No audit trails matched.
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {filteredLogs.map((log) => (
                      <motion.tr key={log._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-amber-300 bg-amber-500/5 my-2 rounded-lg border border-transparent hover:border-amber-500/20">{log.action.toUpperCase()}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{log.userId?.email || log.userId}</td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-slate-400 uppercase font-black">{log.entityType}</p>
                          <p className="text-xs text-slate-500 font-mono mt-1 overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">{log.entityId}</p>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-emerald-400">{log.status}</td>
                        <td className="px-6 py-4 text-right text-xs text-slate-400 font-mono">{new Date(log.createdAt).toLocaleString()}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <div className="text-xs text-slate-400 font-mono">
            Page {page} / {totalPages}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>

      </div>
    </div>
  );
}
