import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/users`;

export const fetchUsersApi = async () => {
  const res = await accountFetch(`${API_BASE}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load users.");
  }
  return await res.json();
};

export const createUserApi = async (payload) => {
  const res = await accountFetch(`${API_BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create user.");
  }
  return await res.json();
};

export const updateUserApi = async (userId, payload) => {
  const res = await accountFetch(`${API_BASE}/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update user.");
  }
  return await res.json();
};

export const toggleUserActiveApi = async (userId) => {
  const res = await accountFetch(`${API_BASE}/${userId}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update user status.");
  }
  return await res.json();
};

export const resetUserPasswordApi = async (userId, newPassword) => {
  const res = await accountFetch(`${API_BASE}/${userId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to reset password.");
  }
  return await res.json();
};
