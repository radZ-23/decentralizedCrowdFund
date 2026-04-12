import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  FiArrowLeft,
  FiSave,
  FiLoader,
  FiPlusCircle,
  FiTrash2,
  FiShield,
} from "react-icons/fi";

interface Milestone {
  description: string;
  targetAmount: number;
}

interface Hospital {
  _id: string;
  email: string;
  hospitalName?: string;
  profile?: { verified?: boolean };
}

function patientIdFromCampaign(c: { patientId?: string | { _id?: string } }): string {
  if (!c.patientId) return "";
  if (typeof c.patientId === "string") return c.patientId;
  return String(c.patientId._id || "");
}

export default function EditCampaign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [medicalCondition, setMedicalCondition] = useState("");
  const [severityLevel, setSeverityLevel] = useState("moderate");
  const [estimatedTreatmentDuration, setEstimatedTreatmentDuration] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [hasContract, setHasContract] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      navigate("/login");
      return;
    }
    if (!id) return;

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [campRes, hospRes] = await Promise.all([
          api.get(`/api/campaigns/${id}`),
          api.get("/api/hospitals/verified"),
        ]);
        if (cancelled) return;
        const c = campRes.data.campaign;
        if (!c) {
          setError("Campaign not found");
          return;
        }

        const ownerId = patientIdFromCampaign(c);
        const isAdmin = user?.role === "admin";
        const isOwner = user?.role === "patient" && user.id === ownerId;
        if (!isAdmin && !isOwner) {
          navigate(`/campaign/${id}`);
          return;
        }

        setTitle(c.title || "");
        setDescription(c.description || "");
        setTargetAmount(String(c.targetAmount ?? ""));
        setHospitalId(
          c.hospitalId && typeof c.hospitalId === "object" && "_id" in c.hospitalId
            ? String((c.hospitalId as { _id: string })._id)
            : typeof c.hospitalId === "string"
              ? c.hospitalId
              : "",
        );
        const md = c.medicalDetails || {};
        setMedicalCondition(md.condition || "");
        setSeverityLevel(md.severityLevel || "moderate");
        setEstimatedTreatmentDuration(md.estimatedTreatmentDuration || "");
        setHasContract(Boolean(c.smartContractAddress));

        const ms = (c.milestones || []) as Milestone[];
        if (ms.length > 0) {
          setMilestones(
            ms.map((m) => ({
              description: m.description || "",
              targetAmount: Number(m.targetAmount) || 0,
            })),
          );
        } else {
          setMilestones([
            { description: "Hospital admission & initial tests", targetAmount: 0 },
            { description: "Primary procedure", targetAmount: 0 },
            { description: "Post-op care", targetAmount: 0 },
          ]);
        }

        setHospitals(hospRes.data.hospitals || []);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.error || "Failed to load campaign");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, token, authLoading, user, navigate]);

  const handleMilestoneChange = (index: number, field: keyof Milestone, value: string | number) => {
    const next = [...milestones];
    next[index] = { ...next[index], [field]: value };
    setMilestones(next);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { description: "", targetAmount: 0 }]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const normalizeMilestonesForSave = (target: number): Milestone[] | null => {
    const withDesc = milestones
      .map((m) => ({
        description: m.description.trim(),
        targetAmount: Number(m.targetAmount) || 0,
      }))
      .filter((m) => m.description.length > 0);
    if (withDesc.length === 0) return null;
    const allZero = withDesc.every((m) => m.targetAmount <= 0);
    if (allZero) {
      const n = withDesc.length;
      const base = target / n;
      let sum = 0;
      return withDesc.map((m, i) => {
        if (i < n - 1) {
          const amt = Math.round(base * 1e6) / 1e6;
          sum += amt;
          return { description: m.description, targetAmount: amt };
        }
        return { description: m.description, targetAmount: Math.round((target - sum) * 1e6) / 1e6 };
      });
    }
    const withAmt = withDesc.filter((m) => m.targetAmount > 0);
    return withAmt.length > 0 ? withAmt : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const t = title.trim();
    const d = description.trim();
    const ta = parseFloat(targetAmount);
    if (!t || !d) {
      setError("Title and description are required.");
      return;
    }
    if (Number.isNaN(ta) || ta <= 0) {
      setError("Enter a valid target amount (ETH) greater than 0.");
      return;
    }

    if (!hasContract) {
      const norm = normalizeMilestonesForSave(ta);
      if (!norm) {
        setError(
          "Add at least one milestone with a description. Leave ETH blank on all rows to split the target evenly.",
        );
        return;
      }
    }

    try {
      setSaving(true);
      const body: Record<string, string> = {
        title: t,
        description: d,
        targetAmount: String(ta),
        medicalDetails: JSON.stringify({
          condition: medicalCondition,
          severityLevel,
          estimatedTreatmentDuration,
        }),
        hospitalId: hospitalId || "",
      };
      if (!hasContract) {
        const norm = normalizeMilestonesForSave(ta);
        if (norm) body.milestones = JSON.stringify(norm);
      }

      await api.put(`/api/campaigns/${id}`, body);
      navigate(`/campaign/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <FiLoader className="w-10 h-10 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-24 pt-8 bg-slate-950">
      <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="max-w-3xl mx-auto px-4 relative z-10">
        <button
          type="button"
          onClick={() => navigate(`/campaign/${id}`)}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6"
        >
          <FiArrowLeft /> Back to campaign
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl border border-white/10 p-6 sm:p-10"
        >
          <h1 className="text-2xl font-black text-white mb-2">Edit campaign</h1>
          <p className="text-sm text-slate-400 mb-8">
            {user?.role === "admin"
              ? "Admin: you can update this campaign including milestones if no contract is deployed yet."
              : "Update your story, target, hospital, and milestones (until a smart contract is deployed)."}
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex gap-2">
              <FiShield className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {hasContract && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
              A smart contract is already deployed. You can still edit title, description, and medical
              context. Target and milestones are locked on-chain.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white resize-none"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Target (ETH) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  disabled={hasContract}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white disabled:opacity-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Hospital</label>
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white"
                >
                  <option value="">Not assigned</option>
                  {hospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.hospitalName || h.email}
                    </option>
                  ))}
                </select>
                {hospitals.length === 0 && (
                  <p className="text-xs text-amber-400/90 mt-2">
                    No eligible hospital accounts yet. A hospital user needs either admin-approved identity KYC or license
                    verification on their account. You can also ask an admin to assign a hospital.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Medical condition</label>
                <input
                  value={medicalCondition}
                  onChange={(e) => setMedicalCondition(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Severity</label>
                <select
                  value={severityLevel}
                  onChange={(e) => setSeverityLevel(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Estimated duration</label>
              <input
                value={estimatedTreatmentDuration}
                onChange={(e) => setEstimatedTreatmentDuration(e.target.value)}
                placeholder="e.g. 6 months"
                className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white"
              />
            </div>

            {!hasContract && (
              <div className="pt-4 border-t border-white/10">
                <h3 className="text-lg font-bold text-white mb-2">Milestones (escrow)</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Descriptions required; leave amounts empty to split your target evenly.
                </p>
                <div className="space-y-4">
                  {milestones.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-900/40 border border-white/10 rounded-xl grid grid-cols-1 sm:grid-cols-5 gap-3"
                    >
                      <div className="sm:col-span-3">
                        <label className="text-xs text-slate-500 uppercase">Description</label>
                        <input
                          value={m.description}
                          onChange={(e) => handleMilestoneChange(idx, "description", e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-slate-500 uppercase">ETH (optional)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={m.targetAmount === 0 ? "" : m.targetAmount}
                          onChange={(e) =>
                            handleMilestoneChange(
                              idx,
                              "targetAmount",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                        />
                      </div>
                      {milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestone(idx)}
                          className="sm:col-span-5 text-left text-xs text-rose-400 flex items-center gap-1"
                        >
                          <FiTrash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMilestone}
                    className="w-full py-3 border border-dashed border-white/20 rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-2 text-sm"
                  >
                    <FiPlusCircle /> Add milestone
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
                Save changes
              </button>
              <button
                type="button"
                onClick={() => navigate(`/campaign/${id}`)}
                className="px-6 py-3 bg-white/10 text-white rounded-xl"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
