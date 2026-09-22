import React, { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, Trash2, Eraser, Loader2 } from "lucide-react";
import {
  fetchNotificationsApi, markNotificationReadApi, markAllNotificationsReadApi,
  deleteNotificationApi, clearReadNotificationsApi
} from "../services/notificationsApi";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await fetchNotificationsApi());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id) => {
    setBusyId(id);
    try {
      await markNotificationReadApi(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await deleteNotificationApi(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setBulkBusy(true);
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      setError(e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleClearRead = async () => {
    if (!window.confirm("Delete all read notifications? This cannot be undone.")) return;
    setBulkBusy(true);
    try {
      await clearReadNotificationsApi();
      setNotifications((prev) => prev.filter((n) => !n.is_read));
    } catch (e) {
      setError(e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const readCount = notifications.length - unreadCount;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#ff5a36]" />
          <h2 className="text-lg font-bold text-slate-800">Notifications</h2>
          {unreadCount > 0 && (
            <span className="bg-[#ffe4da] text-[#c8431f] text-[11px] font-bold px-2 py-0.5 rounded-full">{unreadCount} unread</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            disabled={bulkBusy || unreadCount === 0}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
          <button
            onClick={handleClearRead}
            disabled={bulkBusy || readCount === 0}
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eraser className="w-3.5 h-3.5" /> Clear read
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded">{error}</div>}

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#ff5a36]" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-16 border border-dashed border-slate-200 rounded-xl">
          No notifications yet.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {notifications.map((n) => (
            <div key={n.id} className={`p-4 flex items-start gap-3 ${!n.is_read ? "bg-[#fff1ec]/40" : ""}`}>
              {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a36] mt-1.5 flex-shrink-0" />}
              <div className={`flex-1 min-w-0 ${n.is_read ? "ml-[18px]" : ""}`}>
                <div className="text-sm font-bold text-slate-800">{n.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{n.message}</div>
                <div className="text-[10.5px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!n.is_read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    disabled={busyId === n.id}
                    title="Mark as read"
                    className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(n.id)}
                  disabled={busyId === n.id}
                  title="Delete"
                  className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
