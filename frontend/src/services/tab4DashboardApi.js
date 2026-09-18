import { authFetch } from "./authApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/tab4/training/dashboard`;

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

export const fetchDashboardSummaryApi = async () => {
  const res = await authFetch(`${API_BASE}/summary`);
  return handle(res, "Failed to load dashboard summary.");
};

export const fetchDashboardAccountsApi = async () => {
  const res = await authFetch(`${API_BASE}/accounts`);
  return handle(res, "Failed to load accounts rollup.");
};

export const fetchDashboardCoursesApi = async () => {
  const res = await authFetch(`${API_BASE}/courses`);
  return handle(res, "Failed to load courses rollup.");
};

export const fetchDashboardCourseModulesApi = async (courseId) => {
  const res = await authFetch(`${API_BASE}/courses/${courseId}/modules`);
  return handle(res, "Failed to load module rollup.");
};

export const fetchDashboardRecordsApi = async (filters) => {
  const res = await authFetch(`${API_BASE}/records${qs(filters)}`);
  return handle(res, "Failed to load training records.");
};
