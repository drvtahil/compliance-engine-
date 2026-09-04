import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/readiness`;

export const fetchMyReadinessApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load your Readiness questions.");
  }
  return await res.json();
};

export const fetchAllReadinessApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}/all?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load Readiness questions.");
  }
  return await res.json();
};

export const fetchReadinessStatusApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}/status?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load Readiness status.");
  }
  return await res.json();
};

export const setReadinessResponseApi = async (assessmentId, response) => {
  const res = await accountFetch(`${API_BASE}/${assessmentId}/response`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to save response.");
  }
  return await res.json();
};

export const submitReadinessApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ act_code: actCode }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to submit Readiness.");
  }
  return await res.json();
};

export const unsubmitReadinessApi = async (actCode) => {
  const res = await accountFetch(`${API_BASE}/unsubmit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ act_code: actCode }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to reopen Readiness.");
  }
  return await res.json();
};
