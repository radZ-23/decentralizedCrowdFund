import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiCheck, FiTrash2, FiClock, FiAlertCircle,
  FiCheckCircle, FiXCircle, FiDollarSign, FiFileText, FiShield
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import {
  initSocket, joinRoom, onSocketEvent, offSocketEvent,
  subscribeToEvents, unsubscribeFromEvents
} from '../utils/socket';

export interface Notification {
  id: string;
  type: 'campaign' | 'donation' | 'milestone' | 'kyc' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'campaign' | 'donation' | 'milestone' | 'kyc'>('all');

  useEffect(() => {
    // Initialize socket on mount
    const socket = initSocket();

    if (user?.id) {
      // Join user-specific room
      joinRoom(`user:${user.id}`);
    }

    // Define event handlers
    const handlers = {
      'campaign:created': (data: any) => {
        addNotification({
          type: 'campaign',
          title: 'New Campaign Created',
          message: `Campaign "${data.title}" has been created and is under review.`,
          data,
        });
      },
      'campaign:reviewed': (data: any) => {
        addNotification({
          type: 'campaign',
          title: 'Campaign Review Complete',
          message: `Your campaign has been ${data.status === 'approved' ? 'approved' : 'rejected'}.`,
          data,
        });
      },
      'campaign:statusChanged': (data: any) => {
        addNotification({
          type: 'campaign',
          title: 'Campaign Status Updated',
          message: `Campaign status changed to ${data.status}.`,
          data,
        });
      },
      'donation:received': (data: any) => {
        addNotification({
          type: 'donation',
          title: 'Donation Received',
          message: `You received a donation of ${data.amount} ETH.`,
          data,
        });
      },
      'donation:refunded': (data: any) => {
        addNotification({
          type: 'donation',
          title: 'Donation Refunded',
          message: `Your donation of ${data.amount} ETH has been refunded.`,
          data,
        });
      },
      'milestone:confirmed': (data: any) => {
        addNotification({
          type: 'milestone',
          title: 'Milestone Confirmed',
          message: `Milestone "${data.description}" has been confirmed by the hospital.`,
          data,
        });
      },
      'milestone:released': (data: any) => {
        addNotification({
          type: 'milestone',
          title: 'Funds Released',
          message: `Funds have been released for milestone "${data.description}".`,
          data,
        });
      },
      'kyc:statusChanged': (data: any) => {
        addNotification({
          type: 'kyc',
          title: 'KYC Status Updated',
          message: `Your KYC verification has been ${data.status}.`,
          data,
        });
      },
    };

    subscribeToEvents(handlers);

    // Load existing notifications from localStorage
    const stored = localStorage.getItem(`notifications_${user?.id}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setNotifications(parsed.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      })));
    }

    return () => {
      unsubscribeFromEvents(handlers);
    };
  }, [user?.id]);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    if (user?.id && notifications.length > 0) {
      localStorage.setItem(`notifications_${user?.id}`, JSON.stringify(notifications));
    }
  }, [notifications, user?.id]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'campaign':
        return <FiFileText className="w-5 h-5" />;
      case 'donation':
        return <FiDollarSign className="w-5 h-5" />;
      case 'milestone':
        return <FiCheckCircle className="w-5 h-5" />;
      case 'kyc':
        return <FiShield className="w-5 h-5" />;
      default:
        return <FiBell className="w-5 h-5" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'campaign':
        return 'from-purple-500 to-indigo-500';
      case 'donation':
        return 'from-emerald-500 to-teal-500';
      case 'milestone':
        return 'from-blue-500 to-cyan-500';
      case 'kyc':
        return 'from-orange-500 to-amber-500';
      default:
        return 'from-slate-500 to-gray-500';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 pb-20 pt-8 sm:pt-12">
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-900/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4"
        >
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-white">Notifications</h1>
              {unreadCount > 0 && (
                <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-slate-400 font-medium mt-1">Stay updated with your campaign activity</p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all flex items-center gap-2 font-bold text-sm"
              >
                <FiCheck /> Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all flex items-center gap-2 font-bold text-sm"
              >
                <FiTrash2 /> Clear all
              </button>
            )}
          </div>
        </motion.div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'unread', 'campaign', 'donation', 'milestone', 'kyc'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all capitalize ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-lg shadow-white/10'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredNotifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel p-16 text-center rounded-3xl border border-white/5"
              >
                <FiBell className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </h3>
                <p className="text-slate-400">
                  {filter === 'unread'
                    ? "You're all caught up!"
                    : "When you receive notifications, they'll appear here."}
                </p>
              </motion.div>
            ) : (
              filteredNotifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  className={`glass-card p-5 rounded-2xl border transition-all relative overflow-hidden group ${
                    notification.read
                      ? 'border-white/5 opacity-70'
                      : 'border-white/10 shadow-lg'
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${getNotificationColor(notification.type)}`} />

                  <div className="flex items-start gap-4 pl-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${getNotificationColor(notification.type)} text-white flex-shrink-0`}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white text-base">{notification.title}</h3>
                          <p className="text-slate-400 text-sm mt-1">{notification.message}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            {formatTime(notification.timestamp)}
                          </span>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Action buttons based on notification type */}
                      {notification.data?.campaignId && (
                        <button
                          onClick={() => navigate(`/campaign/${notification.data.campaignId}`)}
                          className="mt-3 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2"
                        >
                          View Campaign <FiCheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
