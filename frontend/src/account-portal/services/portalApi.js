import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/portal`;

export const fetchMyPortalTabsApi = async () => {
  const res = await accountFetch(`${API_BASE}/tabs`);
  if (!res.ok) throw new Error("Failed to load your tabs.");
  return await res.json();
};
