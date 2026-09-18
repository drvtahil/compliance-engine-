import { accountFetch } from "./accountAuthApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/account/training`;

const handle = async (res, fallbackMsg) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || fallbackMsg);
  }
  return await res.json();
};

export const fetchMyCoursesApi = async () => {
  const res = await accountFetch(`${API_BASE}/courses`);
  return handle(res, "Failed to load your training courses.");
};

export const fetchMyCourseDetailApi = async (id) => {
  const res = await accountFetch(`${API_BASE}/courses/${id}`);
  return handle(res, "Failed to load course.");
};

export const markContentCompleteApi = async (contentId) => {
  const res = await accountFetch(`${API_BASE}/content/${contentId}/complete`, { method: "POST" });
  return handle(res, "Failed to update progress.");
};

// <video>/<iframe> src attributes can't carry an Authorization header, so an
// uploaded (self-hosted) file must be fetched with auth first and turned into
// a blob URL - a plain src pointing at the protected API endpoint always 401s.
export const fetchContentBlobUrl = async (contentId) => {
  const res = await accountFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/training/content/${contentId}/view`);
  if (!res.ok) throw new Error("Failed to load content file.");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};
