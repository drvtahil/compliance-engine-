import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/rules`;

export const fetchRegistryLabelsApi = async () => {
  const res = await accountFetch(`${API_BASE}/registry-labels`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load field labels.");
  }
  return await res.json();
};
