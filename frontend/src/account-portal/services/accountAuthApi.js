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

// Wraps fetch for every account-scoped endpoint: attaches the bearer token,
// and on a 401 (expired/invalid session) clears it and reloads so the user
// lands back on the login screen instead of staring at a raw error message.
export const accountFetch = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, ...accountAuthHeaders() },
  });
  if (res.status === 401) {
    clearAccountSession();
    window.location.reload();
    // Reload is async; throw so the caller's .then/.catch chain stops here
    // instead of trying to parse a 401 body as success.
    throw new Error("Session expired. Signing you out.");
  }
  return res;
};
