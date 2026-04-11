import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUpload, FiFile, FiCheckCircle, FiXCircle, FiClock,
  FiAlertCircle, FiTrash2, FiPlus, FiShield, FiUser
} from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface KYCStatus {
  status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  documentType?: string;
  documentNumber?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

interface DocumentFile {
  id: string;
  file: File;
  preview?: string;
}

export default function KYCSubmission() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    documentType: 'aadhaar',
    documentNumber: '',
    fullName: '',
    dateOfBirth: '',
  });
  const [documents, setDocuments] = useState<DocumentFile[]>([]);

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/kyc/status');
      setKycStatus(res.data.data);
    } catch (err: any) {
      console.error('Failed to fetch KYC status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newDocs: DocumentFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setDocuments((prev) => [...prev, ...newDocs]);
    setError('');
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (documents.length === 0) {
      setError('Please upload at least one document');
      return;
    }

    if (!formData.documentNumber || !formData.fullName || !formData.dateOfBirth) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('documentType', formData.documentType);
      data.append('documentNumber', formData.documentNumber);
      data.append('fullName', formData.fullName);
      data.append('dateOfBirth', formData.dateOfBirth);

      documents.forEach((doc) => {
        data.append('documents', doc.file);
      });

      await api.post('/api/kyc/submit', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess('KYC documents submitted successfully! Please wait for admin review.');
      await refreshUser();
      fetchKYCStatus();
      setDocuments([]);
      setFormData({
        documentType: 'aadhaar',
        documentNumber: '',
        fullName: '',
        dateOfBirth: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit KYC documents');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full font-bold text-sm">
            <FiCheckCircle className="w-5 h-5" /> Verified
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-full font-bold text-sm">
            <FiXCircle className="w-5 h-5" /> Rejected
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-full font-bold text-sm">
            <FiClock className="w-5 h-5" /> Under Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-500/20 border border-slate-500/30 text-slate-400 rounded-full font-bold text-sm">
            <FiAlertCircle className="w-5 h-5" /> Not Submitted
          </span>
        );
    }
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

      <div className="max-w-3xl mx-auto px-4 sm:px-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <FiShield className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-black text-white">KYC Verification</h1>
          </div>
          <p className="text-slate-400 font-medium">
            Submit your identity documents for verification
          </p>
        </motion.div>

        {/* Status Card */}
        {kycStatus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-6 rounded-3xl border border-white/10 mb-8"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-slate-400 font-medium mb-2">Current Status</p>
                {getStatusBadge(kycStatus.status)}
              </div>

              {kycStatus.status !== 'not_submitted' && (
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">
                    {kycStatus.status === 'pending' ? 'Submitted' : kycStatus.status === 'approved' ? 'Approved' : 'Rejected'}
                  </p>
                  <p className="text-sm text-white font-medium">
                    {kycStatus.submittedAt ? new Date(kycStatus.submittedAt).toLocaleDateString() : 'N/A'}
                  </p>
                  {kycStatus.documentType && (
                    <p className="text-xs text-slate-400 mt-1 capitalize">
                      {kycStatus.documentType.replace('_', ' ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {kycStatus.status === 'rejected' && kycStatus.rejectionReason && (
              <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <p className="text-sm text-rose-300">
                  <strong>Reason for rejection:</strong> {kycStatus.rejectionReason}
                </p>
              </div>
            )}

            {kycStatus.status === 'approved' && (
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-sm text-emerald-300 flex items-center gap-2">
                  <FiCheckCircle className="w-4 h-4" />
                  Your identity has been verified. You now have full access to all platform features.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Submission Form */}
        {kycStatus?.status === 'not_submitted' || kycStatus?.status === 'rejected' ? (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="glass-card p-8 rounded-3xl border border-white/10 space-y-6"
          >
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
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
                className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl"
              >
                <p className="text-rose-300 text-sm flex items-center gap-2">
                  <FiAlertCircle className="w-5 h-5" /> {error}
                </p>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Document Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Document Type *
                </label>
                <select
                  name="documentType"
                  value={formData.documentType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white font-medium"
                >
                  <option value="aadhaar" className="bg-slate-900">Aadhaar Card</option>
                  <option value="pan" className="bg-slate-900">PAN Card</option>
                  <option value="passport" className="bg-slate-900">Passport</option>
                  <option value="driving_license" className="bg-slate-900">Driving License</option>
                  <option value="voter_id" className="bg-slate-900">Voter ID</option>
                </select>
              </div>

              {/* Document Number */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Document Number *
                </label>
                <input
                  type="text"
                  name="documentNumber"
                  value={formData.documentNumber}
                  onChange={handleInputChange}
                  placeholder="Enter document number"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white font-medium"
                  required
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Full Name (as per document) *
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white font-medium"
                  required
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white font-medium"
                  required
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Upload Documents *
              </label>
              <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:border-purple-500/30 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FiUpload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-white font-medium mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-slate-400">
                    PNG, JPG, or PDF (max 5MB each, up to 5 files)
                  </p>
                </label>
              </div>

              {/* Uploaded files preview */}
              {documents.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {documents.map((doc) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative group"
                      >
                        {doc.preview ? (
                          <img
                            src={doc.preview}
                            alt={doc.file.name}
                            className="w-full h-24 object-cover rounded-lg border border-white/10"
                          />
                        ) : (
                          <div className="w-full h-24 bg-slate-800 rounded-lg border border-white/10 flex items-center justify-center">
                            <FiFile className="w-8 h-8 text-slate-500" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeDocument(doc.id)}
                          className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FiTrash2 className="w-3 h-3" />
                        </button>
                        <p className="text-xs text-slate-400 mt-1 truncate text-center">
                          {doc.file.name}
                        </p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <p className="text-sm text-purple-200 flex items-start gap-3">
                <FiShield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Secure & Private:</strong> Your documents are encrypted and only accessible to authorized admins for verification purposes.
                </span>
              </p>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || documents.length === 0}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <FiUpload className="w-5 h-5" />
                  Submit KYC Documents
                </>
              )}
            </button>
          </motion.form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-8 rounded-3xl border border-white/10 text-center"
          >
            <FiUser className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              {kycStatus.status === 'approved'
                ? 'KYC Verified'
                : kycStatus.status === 'pending'
                ? 'Under Review'
                : 'Application Rejected'}
            </h3>
            <p className="text-slate-400 mb-6">
              {kycStatus.status === 'approved'
                ? 'Your identity has been successfully verified.'
                : kycStatus.status === 'pending'
                ? 'Your documents are being reviewed. This usually takes 24-48 hours.'
                : 'Your KYC application was rejected. You may submit a new application.'}
            </p>
            {kycStatus.status === 'rejected' && (
              <button
                onClick={() => setKycStatus({ status: 'not_submitted' })}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-all"
              >
                Submit New Application
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
