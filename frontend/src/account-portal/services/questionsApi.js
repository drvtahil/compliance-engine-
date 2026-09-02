import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/questions`;

export const fetchQuestionsApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load questions.");
  }
  return await res.json();
};

export const fetchAssignableUsersApi = async () => {
  const res = await accountFetch(`${API_BASE}/assignable-users`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load users.");
  }
  return await res.json();
};

export const assignQuestionApi = async (assessmentId, userId) => {
  const res = await accountFetch(`${API_BASE}/${assessmentId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to assign question.");
  }
  return await res.json();
};

export const unassignQuestionApi = async (assessmentId) => {
  const res = await accountFetch(`${API_BASE}/${assessmentId}/assign`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to remove assignment.");
  }
  return await res.json();
};
