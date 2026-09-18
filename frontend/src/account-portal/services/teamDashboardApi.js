import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/training/dashboard`;

const handle = async (res, fallbackMsg) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || fallbackMsg);
  }
  return await res.json();
};

const qs = (params) => {
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
};

export const fetchTeamFilterOptionsApi = async () => {
  const res = await accountFetch(`${API_BASE}/filters`);
  return handle(res, "Failed to load filter options.");
};

export const fetchTeamSummaryApi = async () => {
  const res = await accountFetch(`${API_BASE}/summary`);
  return handle(res, "Failed to load team dashboard summary.");
};

export const fetchTeamCoursesApi = async () => {
  const res = await accountFetch(`${API_BASE}/courses`);
  return handle(res, "Failed to load team courses rollup.");
};

export const fetchTeamCourseModulesApi = async (courseId) => {
  const res = await accountFetch(`${API_BASE}/courses/${courseId}/modules`);
  return handle(res, "Failed to load team module rollup.");
};

export const fetchTeamRecordsApi = async (filters) => {
  const res = await accountFetch(`${API_BASE}/records${qs(filters)}`);
  return handle(res, "Failed to load team training records.");
};
