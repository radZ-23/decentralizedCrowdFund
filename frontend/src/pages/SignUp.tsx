import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiUser, FiLink, FiHeart, FiShield, FiActivity, FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ui/ThemeToggle';

/* ─── Floating Particles (matches Home page energy) ─── */
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: 20 }).map((_, i) => {
        const left = (i * 37 + 13) % 100;
        const top = (i * 53 + 7) % 100;
        const dur = 5 + (i % 5) * 1.5;
        const delay = (i * 0.7) % 4;
        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{ left: `${left}%`, top: `${top}%` }}
            animate={{
              y: [0, -180 - (i % 4) * 60],
              x: [0, ((i % 2 === 0 ? 1 : -1) * ((i * 17) % 50))],
              opacity: [0, 0.5, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: dur,
              repeat: Infinity,
              delay: delay,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}

export default function SignUp() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    walletAddress: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Cursor glow tracking
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const walletAddress =
        formData.role === 'donor' || formData.role === 'hospital'
          ? formData.walletAddress || undefined
          : undefined;

      await signup(
        formData.email,
        formData.password,
        formData.name,
        formData.role,
        walletAddress,
      );

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'patient', title: 'Patient', icon: <FiUser className="w-5 h-5" />, desc: 'Raise funds', color: 'from-cyan-500 to-blue-500', glow: 'rgba(6,182,212,0.35)' },
    { id: 'donor', title: 'Donor', icon: <FiHeart className="w-5 h-5" />, desc: 'Support causes', color: 'from-pink-500 to-rose-500', glow: 'rgba(236,72,153,0.35)' },
    { id: 'hospital', title: 'Hospital', icon: <FiActivity className="w-5 h-5" />, desc: 'Verify treatment', color: 'from-emerald-500 to-teal-500', glow: 'rgba(16,185,129,0.35)' },
    { id: 'admin', title: 'Admin', icon: <FiShield className="w-5 h-5" />, desc: 'Platform Mngmt', color: 'from-fuchsia-500 to-purple-500', glow: 'rgba(192,38,211,0.35)' },
  ];

  const selectedRole = roles.find((r) => r.id === formData.role);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden py-12 bg-[#070514] selection:bg-fuchsia-500/40">

      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* ── Particles ── */}
      <ParticleField />

      {/* ── Cursor glow ── */}
      <div
        className="fixed w-[500px] h-[500px] rounded-full pointer-events-none z-[1] opacity-20 mix-blend-screen"
        style={{
          background: `radial-gradient(circle, ${selectedRole?.glow || 'rgba(168,85,247,0.15)'} 0%, transparent 70%)`,
          left: mousePosition.x - 250,
          top: mousePosition.y - 250,
          transition: "left 0.3s ease-out, top 0.3s ease-out, background 0.5s ease",
        }}
      />

      {/* ── Noise texture overlay ── */}
      <div className="fixed inset-0 bg-[url('https://api.typedream.com/v0/document/public/80f7bc74-6869-45d2-a7d5-dacedaab59f7_Noise_Background_png.png')] opacity-[0.12] pointer-events-none mix-blend-overlay z-0" />

      {/* ── Animated gradient orbs ── */}
      <motion.div
        animate={{ y: [0, 40, 0], x: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="fixed top-[-15%] right-[-10%] w-[700px] h-[700px] bg-fuchsia-600/20 rounded-full blur-[180px] pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, -30, 0], x: [0, 25, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="fixed bottom-[-15%] left-[-10%] w-[600px] h-[600px] bg-cyan-600/15 rounded-full blur-[160px] pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.22, 0.12] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="fixed top-[30%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[150px] pointer-events-none"
      />

      {/* ── Back to Home ── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="fixed top-6 left-6 z-50"
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md hover:bg-white/10 transition-all group"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center font-black text-xs text-white shadow-[0_0_12px_rgba(192,38,211,0.4)]">
            M
          </div>
          <span className="text-sm font-semibold text-slate-400 group-hover:text-white transition-colors hidden sm:inline">
            MedTrustFund
          </span>
        </button>
      </motion.div>

      {/* ── Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, type: "spring", stiffness: 200, damping: 22 }}
        className="w-full max-w-xl relative z-10"
      >
        <div className="relative rounded-3xl p-8 sm:p-10 border border-white/10 shadow-[0_8px_60px_rgba(0,0,0,0.6)] bg-gradient-to-b from-white/[0.07] to-black/40 backdrop-blur-2xl overflow-hidden">

          {/* Card ambient glow — shifts color based on selected role */}
          <motion.div
            layout
            className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-40"
            style={{ background: `linear-gradient(135deg, ${selectedRole?.glow || 'rgba(168,85,247,0.3)'}, transparent)` }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            layout
            className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full blur-[80px] pointer-events-none opacity-25"
            style={{ background: `radial-gradient(circle, ${selectedRole?.glow || 'rgba(168,85,247,0.2)'}, transparent)` }}
            transition={{ duration: 0.6 }}
          />

          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 mb-4 shadow-[0_0_25px_rgba(192,38,211,0.4)]"
            >
              <FiUser className="w-7 h-7 text-white" />
            </motion.div>
            <h1 className="text-3xl font-black text-white tracking-tight">Join MedTrustFund</h1>
            <p className="text-slate-400 mt-2 text-sm">Create your account to get started</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 mb-6 flex items-center gap-3"
            >
              <div className="text-red-400 shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              </div>
              <p className="text-red-200 text-sm font-medium">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">

            {/* ── Role Selection ── */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-300 ml-1">I want to join as a:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {roles.map((role) => {
                  const isSelected = formData.role === role.id;
                  return (
                    <motion.div
                      key={role.id}
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleChange({ target: { name: 'role', value: role.id } })}
                      className={`cursor-pointer rounded-2xl p-3.5 sm:p-4 border transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center relative overflow-hidden ${
                        isSelected
                          ? 'border-white/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                          : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                      }`}
                      style={isSelected ? { background: 'linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5))' } : {}}
                    >
                      {/* Active role glow */}
                      {isSelected && (
                        <motion.div
                          layoutId="roleGlow"
                          className={`absolute inset-0 bg-gradient-to-br ${role.color} opacity-[0.12] pointer-events-none`}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}

                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        isSelected
                          ? `bg-gradient-to-br ${role.color} text-white shadow-lg`
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}>
                        {role.icon}
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm transition-colors ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {role.title}
                        </h3>
                        <p className={`text-[10px] hidden sm:block mt-0.5 transition-colors ${isSelected ? 'text-slate-400' : 'text-slate-600'}`}>
                          {role.desc}
                        </p>
                      </div>

                      {/* Active check dot */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-br from-white to-white/60"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ── Name & Email ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300 ml-1">Full Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                    <FiUser className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/30 text-white placeholder-slate-600 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300 ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                    <FiMail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/30 text-white placeholder-slate-600 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ── Password ── */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-300 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                  <FiLock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/30 text-white placeholder-slate-600 transition-all text-sm"
                />
              </div>
            </div>

            {/* ── Wallet (conditional) ── */}
            <AnimatePresence>
              {(formData.role === 'donor' || formData.role === 'hospital') && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="text-sm font-semibold text-slate-300 ml-1">
                    Wallet Address <span className="text-slate-600">(Optional for now)</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                      <FiLink className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      name="walletAddress"
                      value={formData.walletAddress}
                      onChange={handleChange}
                      placeholder="0x..."
                      className="w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/30 text-white placeholder-slate-600 transition-all font-mono text-sm"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Submit ── */}
            <motion.button
              whileHover={{ scale: 1.015, y: -1 }}
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3.5 px-4 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:from-fuchsia-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_0_25px_rgba(168,85,247,0.35)] hover:shadow-[0_0_35px_rgba(168,85,247,0.5)] transition-all disabled:opacity-70 disabled:cursor-not-allowed border border-white/10 relative overflow-hidden group"
            >
              {/* Shimmer sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {loading ? (
                <div className="flex items-center justify-center gap-2 relative z-10">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2 relative z-10">
                  Create Account <FiArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              )}
            </motion.button>
          </form>

          {/* ── Bottom divider + Sign In link ── */}
          <div className="mt-8 relative z-10">
            <div className="relative flex items-center justify-center mb-4">
              <div className="absolute inset-x-0 h-px bg-white/5" />
            </div>
            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-purple-400 font-semibold hover:text-purple-300 transition-colors">
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}