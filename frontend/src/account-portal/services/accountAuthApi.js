const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/auth`;
const STORAGE_KEY = "mood9_account_session";

export const accountLoginApi = async (email, password) => {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login failed.");
  }
  return await res.json();
};

export const saveAccountSession = (session) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const loadAccountSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearAccountSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const accountAuthHeaders = () => {
  const session = loadAccountSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
};
