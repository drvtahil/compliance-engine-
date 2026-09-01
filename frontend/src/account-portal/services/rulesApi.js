import { accountAuthHeaders } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/rules`;

export const fetchEnrolledActsApi = async () => {
  const res = await fetch(`${API_BASE}/acts`, { headers: accountAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load enrolled acts.");
  return await res.json();
};

export const fetchChaptersForActApi = async (actCode) => {
  const res = await fetch(`${API_BASE}/chapters?act_code=${encodeURIComponent(actCode)}`, {
    headers: accountAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load chapters.");
  }
  return await res.json();
};
