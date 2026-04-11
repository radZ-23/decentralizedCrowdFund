import { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import api from '../services/api';
import { connectWallet, signMessage } from '../utils/web3';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'donor' | 'hospital' | 'admin';
  walletAddress?: string;
  verified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: string, walletAddress?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  verifyWallet: (walletAddress: string, signature: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithWallet: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = response.data;

    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const signup = async (email: string, password: string, name: string, role: string, walletAddress?: string) => {
    const response = await api.post('/auth/signup', {
      email,
      password,
      name,
      role,
      walletAddress,
    });

    const { token: newToken, user: newUser } = response.data;

    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateProfile = async (data: Partial<User>) => {
    const response = await api.put('/auth/profile', data);
    const updatedUser = response.data.user;
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const verifyWallet = async (walletAddress: string, signature: string) => {
    const response = await api.post('/auth/verify-wallet', { walletAddress, signature });
    const updatedUser = response.data.user;
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const refreshUser = async () => {
    const response = await api.get('/auth/profile');
    const updatedUser = response.data.user;
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const loginWithWallet = async () => {
    const walletAddress = await connectWallet();
    const challenge = await api.post('/auth/wallet-challenge', { walletAddress });
    const message = challenge.data?.message;
    if (!message) {
      throw new Error('Invalid challenge from server');
    }
    const signature = await signMessage(message, walletAddress);
    const response = await api.post('/auth/wallet-login', { walletAddress, signature });
    const { token: newToken, user: newUser } = response.data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const value = {
    user,
    token,
    loading,
    login,
    signup,
    logout,
    updateProfile,
    verifyWallet,
    refreshUser,
    loginWithWallet,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
