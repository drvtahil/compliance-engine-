const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/auth`;
const STORAGE_KEY = "mood9_session";

export const loginApi = async (email, password) => {
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

export const saveSession = (session) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const authHeaders = () => {
  const session = loadSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
};

// Wraps fetch for every Super Admin endpoint: attaches the bearer token, and
// on a 401 (expired/invalid session) clears it and reloads so the user lands
// back on the login screen instead of a raw "Could not validate credentials"
// error on whatever action they were trying to take.
export const authFetch = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, ...authHeaders() },
  });
  if (res.status === 401) {
    clearSession();
    window.location.reload();
    throw new Error("Session expired. Signing you out.");
  }
  return res;
};
