import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiShield, FiAlertTriangle, FiCheckCircle, FiXCircle,
  FiFileText, FiUser, FiDollarSign, FiEye, FiChevronRight
} from 'react-icons/fi';
import api from '../services/api';

interface PatientRef {
  _id?: string;
  name?: string;
  email?: string;
}

interface CampaignDoc {
  type?: string;
  documentType?: string;
  url?: string;
}

interface AiVerificationDetails {
  ocrConfidence?: number;
  metadataConsistency?: number;
  keywordMatch?: number;
  fileIntegrityScore?: number;
}

interface RiskData {
  riskScore?: number;
  finalRiskScore?: number;
  riskCategory?: string;
  recommendation?: string;
  tamperingScore?: number;
  aiGeneratedScore?: number;
  metadataMismatchScore?: number;
  aiVerificationDetails?: AiVerificationDetails;
}

interface Campaign {
  _id: string;
  title: string;
  description: string;
  targetAmount: number;
  status: string;
  patient?: PatientRef;
  patientId?: PatientRef;
  documents?: CampaignDoc[];
  riskAssessment?: RiskData;
  riskAssessmentId?: RiskData;
  createdAt: string;
}

function getPatient(c: Campaign): PatientRef | undefined {
  return c.patientId || c.patient;
}

function getRisk(c: Campaign): RiskData | null {
  const ra = c.riskAssessmentId || c.riskAssessment;
  if (!ra || typeof ra !== 'object') return null;
  return ra;
}

function primaryRiskScore(ra: RiskData): number {
  const n = ra.riskScore ?? ra.finalRiskScore;
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}

function docLabel(doc: CampaignDoc, idx: number): string {
  const t = doc.type || doc.documentType;
  if (t) return t.replace(/_/g, ' ');
  return `Document ${idx + 1}`;
}

export default function AdminCampaignReview() {
  const navigate = useNavigate();
  const [pendingCampaigns, setPendingCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    fetchPendingCampaigns();
  }, []);

  const fetchPendingCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/admin/campaigns/pending-review');
      setPendingCampaigns(res.data.campaigns || []);
    } catch (err: any) {
      console.error('Failed to fetch pending campaigns:', err);
      setError('Failed to load pending campaigns');
    } finally {
      setLoading(false);
    }
  };

  const openCampaignDocument = async (campaignId: string, docIndex: number) => {
    try {
      const res = await api.get(`/api/admin/campaigns/${campaignId}/documents/${docIndex}`, {
        responseType: 'blob',
      });
      const ctype = res.headers['content-type'] || '';
      if (ctype.includes('application/json')) {
        const text = await res.data.text();
        try {
          const j = JSON.parse(text);
          alert(j.error || j.message || 'Could not open document');
        } catch {
          alert('Could not open document');
        }
        return;
      }
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to load document');
    }
  };

  const handleDecision = async (campaignId: string, decision: 'approve' | 'reject') => {
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      await api.post(`/api/admin/campaigns/${campaignId}/decision`, {
        decision,
        comments: reviewNote || '',
        overrideRiskScore: true,
      });

      setSuccess(`Campaign ${decision}d successfully`);
      setReviewNote('');
      setSelectedCampaign(null);
      fetchPendingCampaigns();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${decision} campaign`);
    } finally {
      setActionLoading(false);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score < 40) {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold">
          <FiCheckCircle className="w-4 h-4" /> Low Risk
        </span>
      );
    } else if (score < 70) {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold">
          <FiAlertTriangle className="w-4 h-4" /> Medium Risk
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-full text-xs font-bold">
          <FiXCircle className="w-4 h-4" /> High Risk
        </span>
      );
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 40) return 'text-emerald-400';
    if (score < 70) return 'text-amber-400';
    return 'text-rose-400';
  };

  const renderRiskBreakdown = (ra: RiskData) => {
    const d = ra.aiVerificationDetails;
    if (d && (d.ocrConfidence != null || d.metadataConsistency != null)) {
      const rows: { label: string; value: number }[] = [];
      if (d.ocrConfidence != null) rows.push({ label: 'OCR confidence', value: d.ocrConfidence });
      if (d.metadataConsistency != null) rows.push({ label: 'Metadata consistency', value: d.metadataConsistency });
      if (d.keywordMatch != null) rows.push({ label: 'Keyword match', value: d.keywordMatch });
      if (d.fileIntegrityScore != null) rows.push({ label: 'File integrity', value: d.fileIntegrityScore });
      return (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{row.label}</span>
              <span className={`font-bold ${getRiskColor(row.value)}`}>{row.value.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      );
    }

    if (
      ra.tamperingScore != null ||
      ra.aiGeneratedScore != null ||
      ra.metadataMismatchScore != null
    ) {
      const scale = (v: number) => (v <= 1 ? v * 100 : v);
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Tampering score</span>
            <span className={`font-bold ${getRiskColor(scale(ra.tamperingScore || 0))}`}>
              {scale(ra.tamperingScore || 0).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">AI-generated score</span>
            <span className={`font-bold ${getRiskColor(scale(ra.aiGeneratedScore || 0))}`}>
              {scale(ra.aiGeneratedScore || 0).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Metadata mismatch</span>
            <span className={`font-bold ${getRiskColor(scale(ra.metadataMismatchScore || 0))}`}>
              {scale(ra.metadataMismatchScore || 0).toFixed(0)}%
            </span>
          </div>
        </div>
      );
    }

    return (
      <p className="text-sm text-slate-500">No detailed breakdown available for this assessment.</p>
    );
  };

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
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4"
        >
          <div>
            <div className="flex items-center gap-3">
              <FiShield className="w-8 h-8 text-purple-400" />
              <h1 className="text-3xl font-black text-white">Campaign Review</h1>
            </div>
            <p className="text-slate-400 font-medium mt-1">
              Review risk, open decrypted documents, then approve or reject
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
          >
            ← Back to Dashboard
          </button>
        </motion.div>

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
          >
            <p className="text-emerald-300 text-sm flex items-center gap-2">
              <FiCheckCircle className="w-5 h-5" /> {success}
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl"
          >
            <p className="text-rose-300 text-sm flex items-center gap-2">
              <FiAlertTriangle className="w-5 h-5" /> {error}
            </p>
          </motion.div>
        )}

        {pendingCampaigns.length === 0 ? (
          <div className="glass-panel p-16 text-center rounded-3xl border border-white/5">
            <FiCheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">All Caught Up!</h3>
            <p className="text-slate-400">No campaigns pending review at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white mb-4">
                Pending Campaigns ({pendingCampaigns.length})
              </h2>
              <AnimatePresence>
                {pendingCampaigns.map((campaign) => {
                  const risk = getRisk(campaign);
                  const score = risk ? primaryRiskScore(risk) : undefined;
                  const patient = getPatient(campaign);
                  return (
                    <motion.div
                      key={campaign._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCampaign(campaign)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCampaign(campaign);
                        }
                      }}
                      className={`glass-card p-5 rounded-2xl border cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 ${
                        selectedCampaign?._id === campaign._id
                          ? 'border-purple-500/50 shadow-lg shadow-purple-500/10'
                          : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-white text-lg line-clamp-1">
                            {campaign.title}
                          </h3>
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                            {campaign.description}
                          </p>
                        </div>
                        <FiChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <FiUser className="w-3 h-3" />
                            {patient?.name || patient?.email?.split('@')[0] || 'Patient'}
                          </span>
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <FiDollarSign className="w-3 h-3" />
                            {campaign.targetAmount} ETH
                          </span>
                        </div>
                        {score !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-black ${getRiskColor(score)}`}>
                              {score}
                            </span>
                            {getRiskBadge(score)}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              {selectedCampaign ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-panel p-6 rounded-3xl border border-white/10"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Review Campaign</h2>
                    <button
                      type="button"
                      onClick={() => setSelectedCampaign(null)}
                      className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                      aria-label="Close panel"
                    >
                      <FiXCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <h3 className="font-bold text-white text-lg mb-2">
                        {selectedCampaign.title}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {selectedCampaign.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-900/50 rounded-xl">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Target Amount</p>
                        <p className="text-white font-bold">{selectedCampaign.targetAmount} ETH</p>
                      </div>
                      <div className="p-3 bg-slate-900/50 rounded-xl">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Patient</p>
                        <p className="text-white font-medium">
                          {getPatient(selectedCampaign)?.name || getPatient(selectedCampaign)?.email || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {(() => {
                      const ra = getRisk(selectedCampaign);
                      if (!ra) return null;
                      const score = primaryRiskScore(ra);
                      return (
                        <div className="p-4 bg-slate-900/50 rounded-xl">
                          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h4 className="font-bold text-white">Risk Assessment</h4>
                            {getRiskBadge(score)}
                          </div>
                          {ra.riskCategory && (
                            <p className="text-xs text-slate-500 uppercase font-bold mb-3">
                              Category: <span className="text-slate-300">{ra.riskCategory}</span>
                            </p>
                          )}
                          {renderRiskBreakdown(ra)}
                          {ra.recommendation && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Recommendation</p>
                              <p className="text-sm text-white font-medium capitalize">
                                {ra.recommendation.replace(/_/g, ' ')}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {selectedCampaign.documents && selectedCampaign.documents.length > 0 && (
                      <div>
                        <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2">
                          <FiFileText className="w-4 h-4 text-purple-400" />
                          Campaign documents
                        </h4>
                        <p className="text-xs text-slate-500 mb-3">
                          Files are encrypted on disk; opens decrypted copy (admin only).
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCampaign.documents.map((doc, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => openCampaignDocument(selectedCampaign._id, idx)}
                              className="px-3 py-2 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 rounded-lg text-sm text-violet-200 flex items-center gap-2 transition-colors"
                            >
                              <FiEye className="w-4 h-4 shrink-0" />
                              {docLabel(doc, idx)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Review note (optional)
                    </label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={3}
                      placeholder="Add any notes about your decision..."
                      className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white text-sm resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleDecision(selectedCampaign._id, 'approve')}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <FiCheckCircle className="w-5 h-5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(selectedCampaign._id, 'reject')}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <FiXCircle className="w-5 h-5" />
                      Reject
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="glass-panel p-16 text-center rounded-3xl border border-white/5">
                  <FiEye className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Select a Campaign</h3>
                  <p className="text-slate-400">Click on a campaign from the list to review it.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
