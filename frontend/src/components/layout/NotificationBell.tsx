import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { initSocket, joinRoom, subscribeToEvents, unsubscribeFromEvents } from '../../utils/socket';
import { useAuth } from '../../contexts/AuthContext';

export default function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const socket = initSocket();
    joinRoom(`user:${user.id}`);

    // Count notifications from localStorage
    const stored = localStorage.getItem(`notifications_${user.id}`);
    if (stored) {
      const notifications = JSON.parse(stored);
      setUnreadCount(notifications.filter((n: any) => !n.read).length);
    }

    // Listen for new notifications
    const handleNewNotification = () => {
      setUnreadCount((prev) => prev + 1);
    };

    const events = [
      'campaign:created',
      'campaign:reviewed',
      'campaign:statusChanged',
      'donation:received',
      'donation:refunded',
      'milestone:confirmed',
      'milestone:released',
      'kyc:statusChanged',
    ];

    events.forEach((event) => {
      socket.on(event, handleNewNotification);
    });

    return () => {
      events.forEach((event) => {
        socket.off(event, handleNewNotification);
      });
    };
  }, [user?.id]);

  // Update unread count when opening/closing
  useEffect(() => {
    if (isOpen && user?.id) {
      const stored = localStorage.getItem(`notifications_${user.id}`);
      if (stored) {
        const notifications = JSON.parse(stored);
        setUnreadCount(notifications.filter((n: any) => !n.read).length);
      }
    }
  }, [isOpen, user?.id]);

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            navigate('/notifications');
          }
        }}
        className="relative p-2 hover:bg-white/10 rounded-lg transition-all group"
        aria-label="Notifications"
      >
        <FiBell className="w-5 h-5 text-white group-hover:text-purple-300 transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown preview (optional - can be expanded) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-4 top-16 w-80 glass-panel rounded-2xl border border-white/10 shadow-2xl z-50 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Notifications</h3>
              <button
                onClick={() => navigate('/notifications')}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium"
              >
                View all
              </button>
            </div>
            <div className="text-center py-8 text-slate-400 text-sm">
              <FiBell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Open in full page</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
