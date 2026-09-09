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
