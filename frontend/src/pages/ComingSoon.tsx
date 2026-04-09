import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiTool, FiArrowLeft, FiClock } from "react-icons/fi";

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-900/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="glass-panel p-10 md:p-14 rounded-3xl border border-indigo-500/20 relative z-10 max-w-lg w-full text-center shadow-[0_0_50px_rgba(79,70,229,0.1)]"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-24 h-24 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner shadow-indigo-500/20">
          <FiTool className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl font-black text-white mb-4">Under Construction</h1>
        
        <p className="text-slate-400 text-lg mb-8">
          We are actively working on bringing this feature to you. Check back soon!
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <FiArrowLeft /> Go Back
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all flex items-center justify-center gap-2"
          >
            <FiClock /> Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
