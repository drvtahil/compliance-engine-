import { authFetch } from "./authApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/tab2`;

export const fetchChaptersByActApi = async (actCode) => {
  const res = await authFetch(`${API_BASE}/chapters?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) throw new Error("Failed to load legal chapters for the selected act.");
  return await res.json();
};

export const saveChapterTreeApi = async (payload) => {
  const res = await authFetch(`${API_BASE}/chapters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to save chapter and rule hierarchy.");
  }
  return await res.json();
};

export const updateSingleRuleApi = async (ruleId, chapterId, rulePayload) => {
  const res = await authFetch(`${API_BASE}/rules/${ruleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapter_id: chapterId, rule: rulePayload }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update single rule.");
  }
  return await res.json();
};

export const addRuleToChapterApi = async (chapterId, rulePayload) => {
  const res = await authFetch(`${API_BASE}/chapters/${chapterId}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapter_id: chapterId, rule: rulePayload }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to add rule to chapter.");
  }
  return await res.json();
};

export const toggleRuleHideApi = async (ruleId) => {
  const res = await authFetch(`${API_BASE}/rules/${ruleId}/toggle-hide`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to toggle rule visibility.");
  }
  return await res.json();
};

const deleteNode = async (path, fallback) => {
  const res = await authFetch(`${API_BASE}/${path}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || fallback);
  }
  return await res.json();
};

export const deleteSectionApi = (id) => deleteNode(`sections/${id}`, "Failed to delete section.");
export const deleteRuleApi = (id) => deleteNode(`rules/${id}`, "Failed to delete rule.");
export const deleteChapterApi = (id) => deleteNode(`chapters/${id}`, "Failed to delete chapter.");

// --- Bulk Excel upload ---
const UPLOAD_BASE = `${API_BASE}/upload`;

const saveBlob = async (res, fallbackName) => {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const uploadForm = (actCode, file) => {
  const fd = new FormData();
  fd.append("act_code", actCode);
  fd.append("file", file);
  return fd;
};

export const downloadUploadTemplateApi = async () => {
  const res = await authFetch(`${UPLOAD_BASE}/template`);
  if (!res.ok) throw new Error("Failed to download the template.");
  await saveBlob(res, "Mood9_Rules_Upload_Template.xlsx");
};

export const checkUploadApi = async (actCode, file) => {
  const res = await authFetch(`${UPLOAD_BASE}/check`, { method: "POST", body: uploadForm(actCode, file) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Failed to check the file.");
  return data;
};

export const downloadUploadErrorReportApi = async (actCode, file) => {
  const res = await authFetch(`${UPLOAD_BASE}/error-report`, { method: "POST", body: uploadForm(actCode, file) });
  if (!res.ok) throw new Error("Failed to build the error report.");
  await saveBlob(res, "Upload_Errors.xlsx");
};

export const saveUploadApi = async (actCode, file) => {
  const res = await authFetch(`${UPLOAD_BASE}/save`, { method: "POST", body: uploadForm(actCode, file) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Failed to save the upload.");
  return data;
};
