import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/resources`;
const FILES_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/resources`;

export const fetchAccountResourcesApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load documents.");
  }
  return await res.json();
};

export const viewResourceFile = async (id) => {
  const res = await accountFetch(`${FILES_BASE}/${id}/view`);
  if (!res.ok) throw new Error("Failed to open file.");
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), "_blank");
};

export const downloadResourceFile = async (id, fileName) => {
  const res = await accountFetch(`${FILES_BASE}/${id}/download`);
  if (!res.ok) throw new Error("Failed to download file.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
