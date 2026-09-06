import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/sops`;

const handle = async (res, fallback) => {
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || fallback);
  }
  return await res.json();
};

export const fetchSopsApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}?act_code=${encodeURIComponent(actCode)}`);
  return handle(res, "Failed to load SOPs.");
};

export const fetchUploadRegistriesApi = async () => {
  const res = await accountFetch(`${API_BASE}/registries`);
  return handle(res, "Failed to load master lists.");
};

export const fetchAssignableOwnersApi = async () => {
  const res = await accountFetch(`${API_BASE}/assignable-owners`);
  return handle(res, "Failed to load account members.");
};

export const setSopStatusApi = async (assessmentId, statusValue) => {
  const res = await accountFetch(`${API_BASE}/${assessmentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: statusValue }),
  });
  return handle(res, "Failed to update status.");
};

export const createActivityApi = async (assessmentId, payload) => {
  const res = await accountFetch(`${API_BASE}/${assessmentId}/activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res, "Failed to create activity.");
};

export const fetchActivitiesApi = async () => {
  const res = await accountFetch(`${API_BASE}/activities`);
  return handle(res, "Failed to load activities.");
};

export const setActivityStatusApi = async (activityId, statusValue) => {
  const res = await accountFetch(`${API_BASE}/activities/${activityId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: statusValue }),
  });
  return handle(res, "Failed to update activity status.");
};

export const uploadSopFileApi = async (assessmentId, formData) => {
  const res = await accountFetch(`${API_BASE}/${assessmentId}/files`, {
    method: "POST",
    body: formData,
  });
  return handle(res, "Failed to upload file.");
};

export const fetchDocumentsApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}/documents?act_code=${encodeURIComponent(actCode)}`);
  return handle(res, "Failed to load documents.");
};

export const fetchEvidenceApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}/evidence?act_code=${encodeURIComponent(actCode)}`);
  return handle(res, "Failed to load evidence.");
};

// These two endpoints require an account session, so a plain <a href> can't
// carry the auth token - fetch as a blob instead and hand the browser that.
export const viewSopFile = async (id) => {
  const res = await accountFetch(`${API_BASE}/files/${id}/view`);
  if (!res.ok) throw new Error("Failed to open file.");
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), "_blank");
};

export const downloadSopFile = async (id, fileName) => {
  const res = await accountFetch(`${API_BASE}/files/${id}/download`);
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
