import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import {
  fetchNotificationsApi, fetchUnreadCountApi, markNotificationReadApi, markAllNotificationsReadApi
} from "../services/notificationsApi";

export default function NotificationBell({ onNavigateToTraining, onViewAll }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { unread_count } = await fetchUnreadCountApi();
      setUnreadCount(unread_count);
    } catch {
      // silent - unread badge just stays at its last known value
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const togglePanel = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        setNotifications(await fetchNotificationsApi(5));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClickNotification = async (n) => {
    if (!n.is_read) {
      try {
        await markNotificationReadApi(n.id);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    if (n.entity_type === "training_course" && onNavigateToTraining) {
      onNavigateToTraining();
      setOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={togglePanel}
        title="Notifications"
        className="relative p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-blue-600 hover:text-blue-800">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-center text-xs text-slate-400 py-6">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-6">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 ${!n.is_read ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start gap-1.5">
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-bold text-slate-700">{n.title}</div>
                      <div className="text-[11px] text-slate-500">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => { setOpen(false); onViewAll && onViewAll(); }}
            className="w-full text-center text-[11px] font-bold text-blue-600 hover:text-blue-800 py-2 border-t border-slate-100"
          >
            View All
          </button>
        </div>
      )}
    </div>
  );
}
