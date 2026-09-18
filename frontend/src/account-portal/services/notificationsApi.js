import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/notifications`;

const handle = async (res, fallbackMsg) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || fallbackMsg);
  }
  return await res.json();
};

export const fetchNotificationsApi = async (limit) => {
  const url = limit ? `${API_BASE}?limit=${limit}` : `${API_BASE}`;
  const res = await accountFetch(url);
  return handle(res, "Failed to load notifications.");
};

export const fetchUnreadCountApi = async () => {
  const res = await accountFetch(`${API_BASE}/unread-count`);
  return handle(res, "Failed to load unread count.");
};

export const markNotificationReadApi = async (id) => {
  const res = await accountFetch(`${API_BASE}/${id}/read`, { method: "PUT" });
  return handle(res, "Failed to mark notification as read.");
};

export const markAllNotificationsReadApi = async () => {
  const res = await accountFetch(`${API_BASE}/read-all`, { method: "PUT" });
  return handle(res, "Failed to mark all as read.");
};

export const deleteNotificationApi = async (id) => {
  const res = await accountFetch(`${API_BASE}/${id}`, { method: "DELETE" });
  return handle(res, "Failed to delete notification.");
};

export const clearReadNotificationsApi = async () => {
  const res = await accountFetch(`${API_BASE}/clear-read`, { method: "DELETE" });
  return handle(res, "Failed to clear read notifications.");
};
