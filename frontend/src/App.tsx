import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { initSocket } from './utils/socket';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CreateCampaign from './pages/CreateCampaign';
import EditCampaign from './pages/EditCampaign';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import MyCampaigns from './pages/MyCampaigns';
import MyDonations from './pages/MyDonations';
import Milestones from './pages/Milestones';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import HospitalProfile from './pages/HospitalProfile';
import AdminUsers from './pages/AdminUsers';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminContracts from './pages/AdminContracts';
import Notifications from './pages/Notifications';
import KYCSubmission from './pages/KYCSubmission';
import AdminCampaignReview from './pages/AdminCampaignReview';
import AdminKYCReview from './pages/AdminKYCReview';
import TransactionHistory from './pages/TransactionHistory';
import './App.css';
import NearbyHospitals from './pages/NearbyHospitals';
import { ScrollToTop, BackToTopButton, ToastProvider, RouteProgressBar } from './components/UXEnhancements';
import { EthConverter, AIVerificationExplainer } from './pages/PublicTools';
// Initialize socket connection on app load
initSocket();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <RouteProgressBar />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/eth-converter" element={<EthConverter />} />
          <Route path="/ai-verification" element={<AIVerificationExplainer />} />
          <Route
            path="/campaign/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['patient', 'admin']}>
                <EditCampaign />
              </ProtectedRoute>
            }
          />
          <Route path="/campaign/:id" element={<CampaignDetail />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-campaign"
            element={
              <ProtectedRoute>
                <CreateCampaign />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-campaigns"
            element={
              <ProtectedRoute>
                <MyCampaigns />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-donations"
            element={
              <ProtectedRoute>
                <MyDonations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/milestones"
            element={
              <ProtectedRoute>
                <Milestones />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/hospital-profile" element={<ProtectedRoute><HospitalProfile /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminAuditLogs /></ProtectedRoute>} />
          <Route path="/admin/contracts" element={<ProtectedRoute allowedRoles={['admin']}><AdminContracts /></ProtectedRoute>} />
          <Route path="/admin/campaign-review" element={<ProtectedRoute allowedRoles={['admin']}><AdminCampaignReview /></ProtectedRoute>} />
          <Route path="/admin/kyc-review" element={<ProtectedRoute allowedRoles={['admin']}><AdminKYCReview /></ProtectedRoute>} />

          {/* User Routes */}
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/kyc-submission" element={<ProtectedRoute><KYCSubmission /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
          <Route path="/nearby-hospitals" element={<ProtectedRoute><NearbyHospitals /></ProtectedRoute>} />
          {/* Root mapped to Home */}
          <Route path="/" element={<Home />} />

          {/* 404 mapped to Home */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <BackToTopButton />
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
