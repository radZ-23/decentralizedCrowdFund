import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import {
  FiFilePlus, FiActivity, FiShield,
  FiCheckCircle, FiUploadCloud, FiTrash2, FiPlusCircle,
  FiArrowRight, FiArrowLeft, FiHospital, FiLoader
} from "react-icons/fi";

interface FormData {
  title: string;
  description: string;
  targetAmount: string;
  hospitalId: string;
  medicalCondition: string;
  severityLevel: string;
  estimatedTreatmentDuration: string;
}

interface Hospital {
  _id: string;
  email: string;
  hospitalName?: string;
  profile?: {
    verified?: boolean;
  };
}

interface Milestone {
  description: string;
  targetAmount: number;
}

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    targetAmount: "",
    hospitalId: "",
    medicalCondition: "",
    severityLevel: "moderate",
    estimatedTreatmentDuration: "",
  });

  useEffect(() => {
    fetchHospitals();
  }, []);

  const fetchHospitals = async () => {
    try {
      setLoadingHospitals(true);
      const res = await api.get('/api/hospitals/verified');
      setHospitals(res.data.hospitals || []);
    } catch (err) {
      console.error('Failed to fetch hospitals:', err);
    } finally {
      setLoadingHospitals(false);
    }
  };

  const [milestones, setMilestones] = useState<Milestone[]>([
    { description: "Hospital Admission & Initial Tests", targetAmount: 0 },
    { description: "Primary Surgery / Procedure", targetAmount: 0 },
    { description: "Post-op Care & Medications", targetAmount: 0 },
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMilestoneChange = (index: number, field: keyof Milestone, value: string | number) => {
    const newMilestones = [...milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    setMilestones(newMilestones);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { description: "", targetAmount: 0 }]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const newFiles = [...files];
      const newTypes = [...documentTypes];

      // Automatically try to extract value from nearby select if we are using an invisible file input mapped to a card
      const selectEl = document.getElementById(`docType-${index}`) as HTMLSelectElement;
      if (selectEl) {
        newTypes[index] = selectEl.value;
      }

      newFiles[index] = selectedFile;
      setFiles(newFiles);
      setDocumentTypes(newTypes);
    }
  };

  const handleDocumentTypeChange = (index: number, type: string) => {
    const newTypes = [...documentTypes];
    newTypes[index] = type;
    setDocumentTypes(newTypes);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    const newTypes = [...documentTypes];
    delete newFiles[index]; // leaves undefined
    delete newTypes[index];
    setFiles(newFiles);
    setDocumentTypes(newTypes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const validFiles = files.filter(f => f !== undefined);
      if (validFiles.length === 0) {
        setError("Please upload at least one medical document for verification.");
        setStep(3); // Go to docs step
        setLoading(false);
        return;
      }

      const data = new FormData();
      data.append("title", formData.title);
      data.append("description", formData.description);
      data.append("targetAmount", formData.targetAmount);
      if (formData.hospitalId) data.append("hospitalId", formData.hospitalId);
      
      const cleanDocTypes = documentTypes.filter((_, i) => files[i] !== undefined);
      data.append("documentTypes", JSON.stringify(cleanDocTypes));

      files.forEach((file, index) => {
        if (file && documentTypes[index]) {
          data.append("documents", file);
        }
      });

      data.append("medicalDetails", JSON.stringify({
        condition: formData.medicalCondition,
        severityLevel: formData.severityLevel,
        estimatedTreatmentDuration: formData.estimatedTreatmentDuration,
      }));

      data.append("milestones", JSON.stringify(milestones.filter(m => m.description && m.targetAmount > 0)));

      // Send to backend
      await api.post("/api/campaigns", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);

    } catch (err: any) {
      console.error("Campaign creation error:", err);
      setError(err.response?.data?.error || "Failed to create campaign. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const documentTypeOptions = [
    { value: "identity", label: "Government ID (Aadhaar/Passport)" },
    { value: "diagnosis", label: "Medical Diagnosis Report" },
    { value: "admission_letter", label: "Hospital Admission Letter" },
    { value: "cost_estimate", label: "Treatment Cost Estimate" },
  ];

  const totalSteps = 4;

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  // Step renderers
  const renderStep1 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">Campaign Basics</h2>
        <p className="text-slate-400 mt-2">What are you raising funds for?</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">Campaign Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Urgent heart surgery for 12-year-old"
            className="w-full px-5 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white placeholder-slate-500 transition-all font-medium"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">Description & Medical Need *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={5}
            placeholder="Describe the medical condition, treatment needed, and why you're raising funds..."
            className="w-full px-5 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white placeholder-slate-500 transition-all font-medium resize-none"
            required
          ></textarea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">Target Amount (ETH) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Ξ</span>
              <input
                type="number"
                step="0.01"
                name="targetAmount"
                value={formData.targetAmount}
                onChange={handleChange}
                placeholder="2.5"
                className="w-full pl-10 pr-5 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white placeholder-slate-500 transition-all font-bold"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">Associate Hospital (Optional)</label>
            <div className="relative">
              <select
                name="hospitalId"
                value={formData.hospitalId}
                onChange={handleChange}
                disabled={loadingHospitals}
                className="w-full px-5 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white appearance-none transition-all font-medium disabled:opacity-50"
              >
                <option value="" className="bg-slate-900">Select a hospital...</option>
                {hospitals.map((h) => (
                  <option key={h._id} value={h._id} className="bg-slate-900">
                    {h.hospitalName || h.email} {h.profile?.verified ? '(Verified)' : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
              {loadingHospitals && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                  <FiLoader className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
              )}
            </div>
            {hospitals.length === 0 && !loadingHospitals && (
              <p className="text-xs text-slate-500 mt-2 ml-1">No verified hospitals available. Enter hospital ID manually if needed.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">Medical Context</h2>
        <p className="text-slate-400 mt-2">Help the AI properly categorize the medical risk</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">Medical Condition</label>
          <input
            type="text"
            name="medicalCondition"
            value={formData.medicalCondition}
            onChange={handleChange}
            placeholder="e.g., Congenital Heart Defect"
            className="w-full px-5 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white transition-all font-medium"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">Severity Level</label>
            <div className="relative">
              <select
                name="severityLevel"
                value={formData.severityLevel}
                onChange={handleChange}
                className="w-full px-5 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white transition-all font-medium appearance-none"
              >
                <option value="mild" className="bg-slate-900 text-white">Mild</option>
                <option value="moderate" className="bg-slate-900 text-white">Moderate</option>
                <option value="severe" className="bg-slate-900 text-white">Severe</option>
                <option value="critical" className="bg-slate-900 text-white">Critical</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">Estimated Duration</label>
            <input
              type="text"
              name="estimatedTreatmentDuration"
              value={formData.estimatedTreatmentDuration}
              onChange={handleChange}
              placeholder="e.g., 6 months"
              className="w-full px-5 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white transition-all"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">Document Verification</h2>
        <p className="text-slate-400 mt-2">Upload medical documents for our decentralized AI veracity check</p>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-4 mb-6">
        <FiShield className="text-emerald-400 w-8 h-8 flex-shrink-0" />
        <div>
          <p className="text-sm text-emerald-200">
            <strong>Secure & Private:</strong> All documents are encrypted locally and hashed onto the blockchain after verification. Our AI evaluates fraud risk within 30 seconds.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl relative group hover:border-purple-500/30 transition-colors">
            {files[index] ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl">
                    <FiCheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <select
                      id={`docType-${index}`}
                      value={documentTypes[index] || ""}
                      onChange={(e) => handleDocumentTypeChange(index, e.target.value)}
                      className="bg-transparent text-sm font-bold text-white focus:outline-none mb-1"
                    >
                      <option value="" className="bg-slate-900">Select Document Type...</option>
                      {documentTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">{files[index].name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="p-2 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-colors"
                >
                  <FiTrash2 className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1 w-full relative">
                  <select
                    id={`docType-${index}`}
                    value={documentTypes[index] || ""}
                    onChange={(e) => handleDocumentTypeChange(index, e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white text-sm appearance-none"
                  >
                    <option value="" className="text-slate-500 bg-slate-900">Select Document Type...</option>
                    {documentTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="relative w-full sm:w-auto">
                  <input
                    type="file"
                    onChange={(e) => handleFileChange(e, index)}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="px-6 py-3 bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-xl flex items-center justify-center gap-2 hover:bg-purple-500/30 transition-colors w-full whitespace-nowrap font-medium">
                    <FiUploadCloud className="w-5 h-5" /> Upload File
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderStep4 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">Smart Contract Milestones</h2>
        <p className="text-slate-400 mt-2">Funds are locked in escrow and released proportionally</p>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {milestones.map((milestone, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-5 bg-slate-900/50 border border-white/10 rounded-2xl relative group"
            >
              <div className="absolute top-4 right-4 opacity-50 font-mono text-xs text-slate-500">M-{index + 1}</div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1 uppercase tracking-wider">Milestone Description</label>
                  <input
                    type="text"
                    value={milestone.description}
                    onChange={(e) => handleMilestoneChange(index, "description", e.target.value)}
                    placeholder="e.g., Initial hospitalization"
                    className="w-full px-4 py-2.5 bg-white/5 border border-transparent hover:border-white/10 focus:border-purple-500/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-white text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1 uppercase tracking-wider">Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={milestone.targetAmount === 0 ? "" : milestone.targetAmount}
                    onChange={(e) => handleMilestoneChange(index, "targetAmount", parseFloat(e.target.value) || 0)}
                    placeholder="0.5"
                    className="w-full px-4 py-2.5 bg-white/5 border border-transparent hover:border-white/10 focus:border-purple-500/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-white text-sm transition-all font-mono"
                  />
                </div>
              </div>
              
              {milestones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMilestone(index)}
                  className="mt-4 text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <FiTrash2 /> Remove
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <button
          type="button"
          onClick={addMilestone}
          className="w-full py-4 border-2 border-dashed border-white/10 text-slate-400 hover:text-white hover:border-white/30 rounded-2xl flex items-center justify-center gap-2 transition-all font-medium"
        >
          <FiPlusCircle /> Add Another Milestone
        </button>
      </div>

      <div className="mt-8 p-5 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-2xl">
        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <FiActivity className="text-purple-400" /> Final Review
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed">
          By clicking finish, your campaign data along with encrypted documents will be sent to the decentralized nodes for AI Verify analysis. Once cleared, a Smart Contract will be automatically provisioned for donations.
        </p>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden pb-20 pt-10 flex items-center justify-center bg-slate-950">
      {/* Dynamic Backgrounds */}
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-900/30 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/30 rounded-full blur-[150px] pointer-events-none" />

      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-emerald-500/50 p-8 rounded-3xl flex flex-col items-center text-center shadow-[0_0_50px_rgba(16,185,129,0.3)]"
          >
            <FiCheckCircle className="w-20 h-20 text-emerald-400 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Campaign Created!</h2>
            <p className="text-emerald-200/70">AI Verification is in progress. Redirecting you to the dashboard...</p>
          </motion.div>
        </div>
      )}

      <div className="w-full max-w-3xl relative z-10 px-4">
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 px-1">
            <span>Step {step} of {totalSteps}</span>
            <span className="text-purple-400">{Math.round((step / totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: `${((step - 1) / totalSteps) * 100}%` }}
              animate={{ width: `${(step / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl relative overflow-hidden">
          
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex gap-3 items-center">
              <FiShield className="text-red-400 flex-shrink-0" />
              <p className="text-red-200 text-sm font-medium">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {step === 1 && <motion.div key="step1">{renderStep1()}</motion.div>}
              {step === 2 && <motion.div key="step2">{renderStep2()}</motion.div>}
              {step === 3 && <motion.div key="step3">{renderStep3()}</motion.div>}
              {step === 4 && <motion.div key="step4">{renderStep4()}</motion.div>}
            </AnimatePresence>

            <div className="mt-10 flex justify-between items-center pt-6 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  if (step === 1) navigate("/dashboard");
                  else prevStep();
                }}
                disabled={loading}
                className="px-6 py-3 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {step === 1 ? "Cancel" : <><FiArrowLeft /> Back</>}
              </button>

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-8 py-3 bg-white text-slate-900 hover:bg-slate-200 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"
                >
                  Continue <FiArrowRight />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                  ) : (
                    <><FiFilePlus /> Finalize & Submit</>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
