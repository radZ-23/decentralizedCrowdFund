import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiUsers, FiSearch, FiShield, FiShieldOff, FiTrash2, FiUserCheck, FiFilter } from "react-icons/fi";
import api from "../services/api";

interface User {
  _id: string;
  name?: string;
  fullName?: string;
  email: string;
  role: string;
  isActive: boolean;
  kyc?: { status: string, verifiedAt?: Date };
  createdAt: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");

  useEffect(() => {
    fetchUsers();
  }, [selectedRole]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const url = selectedRole === "all" ? "/api/admin/users" : `/api/admin/users?role=${selectedRole}`;
      const response = await api.get(url);
      setUsers(response.data.users || []);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      setError(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const deactivateUser = async (userId: string) => {
    if(!confirm("Are you sure you want to deactivate this account?")) return;
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers(users.map(u => u._id === userId ? { ...u, isActive: false } : u));
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to deactivate user");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case 'hospital': return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case 'donor': return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      default: return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-10 relative z-10">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              User Governance
            </h1>
            <p className="text-slate-400 mt-2 font-medium">
              Manage accounts and roles. KYC approval is only from{" "}
              <button
                type="button"
                onClick={() => navigate("/admin/kyc-review")}
                className="text-fuchsia-400 hover:text-fuchsia-300 underline underline-offset-2 font-semibold"
              >
                KYC review
              </button>{" "}
              after documents are checked.
            </p>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/admin/dashboard")}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          >
            ← Admin Center
          </motion.button>
        </div>

        {error && (
          <div className="mb-8 glass-card border-red-500/30 p-4 rounded-xl">
            <p className="text-red-200 font-medium">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="text-slate-400 ml-2" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none appearance-none min-w-[150px]"
            >
              <option value="all">All Roles</option>
              <option value="patient">Patients</option>
              <option value="donor">Donors</option>
              <option value="hospital">Hospitals</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-black">User Details</th>
                  <th className="px-6 py-4 font-black">Role</th>
                  <th className="px-6 py-4 font-black">Status</th>
                  <th className="px-6 py-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                      <FiUsers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      No users found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {filteredUsers.map((u) => (
                      <motion.tr key={u._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-white font-bold">{u.name || u.fullName || "Unnamed User"}</p>
                          <p className="text-sm text-slate-400">{u.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getRoleBadge(u.role)}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {u.isActive ? (
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400"><FiUserCheck/> Active</span>
                              {(u.role === "hospital" || u.kyc) && (
                                <span className="text-[10px] font-black uppercase text-indigo-300">
                                  KYC:{" "}
                                  {u.kyc?.status === "approved"
                                    ? "Verified"
                                    : u.kyc?.status === "pending"
                                      ? "Pending review"
                                      : u.kyc?.status === "rejected"
                                        ? "Rejected"
                                        : "Not verified"}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400"><FiShieldOff/> Suspended</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          {u.isActive && u.kyc?.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => navigate("/admin/kyc-review")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-500/10 text-fuchsia-300 font-bold hover:bg-fuchsia-500/20 text-xs rounded-lg transition-all border border-fuchsia-500/25"
                              title="Approve or reject only after opening documents on the KYC review page"
                            >
                              <FiShield className="w-3.5 h-3.5" />
                              Review KYC
                            </button>
                          )}
                          {u.isActive &&
                            u.role === "hospital" &&
                            u.kyc?.status !== "approved" &&
                            u.kyc?.status !== "pending" && (
                              <button
                                type="button"
                                onClick={() => navigate("/admin/kyc-review")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-slate-300 font-bold hover:bg-white/10 text-xs rounded-lg transition-all border border-white/10"
                                title="If they submitted documents, process them under KYC review"
                              >
                                <FiShield className="w-3.5 h-3.5" />
                                KYC queue
                              </button>
                            )}
                          {u.isActive && u.role !== 'admin' && (
                            <button
                              onClick={() => deactivateUser(u._id)}
                              className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-all border border-rose-500/20"
                              title="Suspend Account"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
