const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/auth`;
const STORAGE_KEY = "mood9_account_session";

export const accountLoginApi = async (email, password, loginAs) => {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, login_as: loginAs }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login failed.");
  }
  return await res.json();
};

// localStorage is shared by every tab, so a login in another tab would silently
// swap the identity used by this tab's requests (a User tab would start acting
// as the Account Admin). Each tab therefore pins the session it loaded or
// logged in with, and only that session's token is ever sent from this tab.
let activeSession;

export const saveAccountSession = (session) => {
  activeSession = session;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const loadAccountSession = () => {
  if (activeSession !== undefined) return activeSession;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    activeSession = raw ? JSON.parse(raw) : null;
  } catch {
    activeSession = null;
  }
  return activeSession;
};

export const clearAccountSession = () => {
  // Don't log out a different user who signed in from another tab.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (!stored || !activeSession || stored.access_token === activeSession.access_token) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  activeSession = null;
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

export const changePasswordApi = async (currentPassword, newPassword) => {
  const res = await accountFetch(`${API_BASE}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to change password.");
  }
  return await res.json();
};
