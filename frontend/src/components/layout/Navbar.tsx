import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiUser, FiBell } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import WalletConnectButton from '../ui/WalletConnectButton';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAuthenticated = Boolean(token ?? localStorage.getItem('token'));

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMenuOpen(false);
  };

  const navLinks = isAuthenticated
    ? (
        [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/campaigns', label: 'Campaigns' },
          user?.role === 'donor' && { to: '/my-donations', label: 'My donations' },
          user?.role === 'donor' && { to: '/transactions', label: 'Activity' },
          user?.role === 'patient' && { to: '/create-campaign', label: 'Create campaign' },
          user?.role === 'patient' && { to: '/my-campaigns', label: 'My campaigns' },
          user?.role === 'patient' && { to: '/analytics', label: 'Analytics' },
          user?.role === 'hospital' && { to: '/milestones', label: 'Milestones' },
          user?.role === 'hospital' && { to: '/hospital-profile', label: 'Hospital profile' },
          user?.role !== 'admin' && { to: '/kyc-submission', label: 'KYC' },
          user?.role === 'admin' && { to: '/admin/dashboard', label: 'Admin' },
          user?.role === 'admin' && { to: '/admin/kyc-review', label: 'KYC review' },
          user?.role === 'admin' && { to: '/admin/campaign-review', label: 'Review' },
        ].filter(Boolean) as { to: string; label: string }[]
      )
    : [];

  return (
    <nav className="bg-slate-900/80 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <RouterLink to="/" className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 hover:opacity-80 transition">
            MedTrustFund
          </RouterLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <RouterLink
                key={link.to}
                to={link.to}
                className="text-slate-300 hover:text-white font-medium transition-colors rounded-md px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
              >
                {link.label}
              </RouterLink>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <RouterLink
                  to="/notifications"
                  className="relative p-2 hover:bg-white/10 rounded-lg transition-all group"
                >
                  <FiBell className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
                </RouterLink>
                <ThemeToggle />
                <RouterLink
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                >
                  <FiUser className="w-4 h-4" />
                  <span className="text-sm font-medium text-white">{user?.name || user?.email?.split('@')[0]}</span>
                </RouterLink>
                <WalletConnectButton compact />
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all font-medium text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <ThemeToggle />
                <RouterLink
                  to="/login"
                  className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-colors"
                >
                  Login
                </RouterLink>
                <RouterLink
                  to="/signup"
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-400 hover:to-pink-400 transition-all shadow-lg shadow-purple-500/25"
                >
                  Sign Up
                </RouterLink>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
          >
            {isMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-lg">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <RouterLink
                key={link.to}
                to={link.to}
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
              >
                {link.label}
              </RouterLink>
            ))}
            {isAuthenticated ? (
              <>
                <RouterLink
                  to="/notifications"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Notifications
                </RouterLink>
                <RouterLink
                  to="/profile"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Profile
                </RouterLink>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-rose-400 hover:bg-rose-500/10 rounded-lg font-medium transition-colors text-left"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <RouterLink
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Login
                </RouterLink>
                <RouterLink
                  to="/signup"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg text-center"
                >
                  Sign Up
                </RouterLink>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
