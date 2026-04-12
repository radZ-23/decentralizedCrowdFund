import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiShield,
  FiFile,
  FiEye,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiUser,
  FiMail,
} from "react-icons/fi";
import api from "../services/api";

interface KycUser {
  _id: string;
  email: string;
  name?: string;
  role: string;
}

interface KycDocFile {
  originalName?: string;
  mimetype?: string;
  size?: number;
}

interface PendingKYC {
  _id: string;
  user: KycUser | string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  dateOfBirth: string;
  documents: KycDocFile[];
  status: string;
  submittedAt: string;
}

export default function AdminKYCReview() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingKYC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/kyc/pending");
      setItems(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load pending KYC submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDocument = async (kycId: string, docIndex: number) => {
    try {
      const res = await api.get(`/kyc/${kycId}/documents/${docIndex}`, {
        responseType: "blob",
      });
      const type = res.headers["content-type"] || "";
      if (type.includes("application/json")) {
        const text = await res.data.text();
        try {
          const j = JSON.parse(text);
          alert(j.message || "Could not open document");
        } catch {
          alert("Could not open document");
        }
        return;
      }
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to load document");
    }
  };

  const approve = async (id: string) => {
    if (!confirm("Approve this KYC submission? The user will be marked verified.")) return;
    try {
      setBusyId(id);
      await api.post(`/kyc/${id}/approve`, {});
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Rejection reason (required):");
    if (!reason?.trim()) {
      alert("A reason is required.");
      return;
    }
    try {
      setBusyId(id);
      await api.post(`/kyc/${id}/reject`, { reason: reason.trim() });
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const userLabel = (u: PendingKYC["user"]) =>
    typeof u === "object" && u !== null ? u.email : "—";

  const userName = (u: PendingKYC["user"]) =>
    typeof u === "object" && u !== null ? u.name || u.email : "—";

  const userRole = (u: PendingKYC["user"]) =>
    typeof u === "object" && u !== null ? u.role : "—";

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-10 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 flex items-center gap-3">
              <FiShield className="text-violet-400 shrink-0" />
              KYC review
            </h1>
            <p className="text-slate-400 mt-2 font-medium">
              Open uploaded documents (decrypted server-side), then approve or reject.
            </p>
          </motion.div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="px-5 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/dashboard")}
              className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
            >
              ← Admin center
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 glass-card border-red-500/30 p-4 rounded-xl">
            <p className="text-red-200 font-medium">{error}</p>
          </div>
        )}

        <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-black">Applicant</th>
                  <th className="px-6 py-4 font-black">Document</th>
                  <th className="px-6 py-4 font-black">Submitted</th>
                  <th className="px-6 py-4 font-black text-right">Files & actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-500">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-violet-500 mx-auto" />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-500 font-medium">
                      No pending KYC submissions. Users submit from Profile → KYC submission.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row._id} className="hover:bg-white/5 transition-colors align-top">
                      <td className="px-6 py-4">
                        <p className="text-white font-bold flex items-center gap-2">
                          <FiUser className="text-slate-500 shrink-0" />
                          {userName(row.user)}
                        </p>
                        <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                          <FiMail className="text-slate-600 shrink-0" />
                          {userLabel(row.user)}
                        </p>
                        <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-wider text-violet-300 bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 rounded-md">
                          {userRole(row.user)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white font-medium">{row.fullName}</p>
                        <p className="text-sm text-slate-400 capitalize">
                          {String(row.documentType).replace(/_/g, " ")} · {row.documentNumber}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          DOB: {row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">
                        {row.submittedAt
                          ? new Date(row.submittedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            {(row.documents || []).map((d, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => openDocument(row._id, i)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:bg-violet-500/20 hover:border-violet-500/40 transition-all"
                              >
                                <FiEye className="w-3.5 h-3.5" />
                                {d.originalName || `File ${i + 1}`}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap justify-end gap-2 mt-2">
                            <button
                              type="button"
                              disabled={busyId === row._id}
                              onClick={() => approve(row._id)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              <FiCheck /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row._id}
                              onClick={() => reject(row._id)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50"
                            >
                              <FiX /> Reject
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-500 flex items-start gap-2">
          <FiFile className="shrink-0 mt-0.5" />
          Documents are stored encrypted on disk; this page loads them via{" "}
          <code className="text-slate-400 bg-white/5 px-1 rounded">GET /api/kyc/:id/documents/:docIndex</code>{" "}
          (admin only).
        </p>
      </div>
    </div>
  );
}
