import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/rules`;

export const fetchEnrolledActsApi = async () => {
  const res = await accountFetch(`${API_BASE}/acts`);
  if (!res.ok) throw new Error("Failed to load enrolled acts.");
  return await res.json();
};

export const fetchChaptersForActApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}/chapters?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load chapters.");
  }
  return await res.json();
};
