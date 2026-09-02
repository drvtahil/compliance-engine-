import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/resources`;
const FILES_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/resources`;

export const fetchAccountResourcesApi = async () => {
  const res = await accountFetch(`${API_BASE}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load documents.");
  }
  return await res.json();
};

export const getResourceViewUrl = (id) => `${FILES_BASE}/${id}/view`;
export const getResourceDownloadUrl = (id) => `${FILES_BASE}/${id}/download`;
