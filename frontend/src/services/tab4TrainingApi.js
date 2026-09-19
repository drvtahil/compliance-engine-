import { authFetch } from "./authApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/tab4/training`;
const CONTENT_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/training/content`;

const handle = async (res, fallbackMsg) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || fallbackMsg);
  }
  return await res.json();
};

export const fetchRolesApi = async () => {
  const res = await authFetch(`${API_BASE}/roles`);
  return handle(res, "Failed to load roles.");
};

export const fetchContentTypesApi = async () => {
  const res = await authFetch(`${API_BASE}/content-types`);
  return handle(res, "Failed to load content types.");
};

// --- Courses ---
export const fetchCoursesApi = async (actCode) => {
  const url = actCode ? `${API_BASE}/courses?act_code=${encodeURIComponent(actCode)}` : `${API_BASE}/courses`;
  const res = await authFetch(url);
  return handle(res, "Failed to load training courses.");
};

export const createCourseApi = async (payload) => {
  const res = await authFetch(`${API_BASE}/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res, "Failed to create course.");
};

export const getCourseApi = async (id) => {
  const res = await authFetch(`${API_BASE}/courses/${id}`);
  return handle(res, "Failed to load course.");
};

export const updateCourseApi = async (id, payload) => {
  const res = await authFetch(`${API_BASE}/courses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res, "Failed to update course.");
};

export const deleteCourseApi = async (id) => {
  const res = await authFetch(`${API_BASE}/courses/${id}`, { method: "DELETE" });
  return handle(res, "Failed to delete course.");
};

export const archiveCourseApi = async (id) => {
  const res = await authFetch(`${API_BASE}/courses/${id}/archive`, { method: "POST" });
  return handle(res, "Failed to archive course.");
};

export const publishCourseApi = async (id) => {
  const res = await authFetch(`${API_BASE}/courses/${id}/publish`, { method: "POST" });
  return handle(res, "Failed to publish course.");
};

export const unpublishCourseApi = async (id) => {
  const res = await authFetch(`${API_BASE}/courses/${id}/unpublish`, { method: "POST" });
  return handle(res, "Failed to unpublish course.");
};

export const previewCourseApi = async (id) => {
  const res = await authFetch(`${API_BASE}/courses/${id}/preview`);
  return handle(res, "Failed to load course preview.");
};

// --- Modules ---
export const createModuleApi = async (courseId, payload) => {
  const res = await authFetch(`${API_BASE}/courses/${courseId}/modules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res, "Failed to create module.");
};

export const updateModuleApi = async (id, payload) => {
  const res = await authFetch(`${API_BASE}/modules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res, "Failed to update module.");
};

export const deleteModuleApi = async (id) => {
  const res = await authFetch(`${API_BASE}/modules/${id}`, { method: "DELETE" });
  return handle(res, "Failed to delete module.");
};

export const duplicateModuleApi = async (id) => {
  const res = await authFetch(`${API_BASE}/modules/${id}/duplicate`, { method: "POST" });
  return handle(res, "Failed to duplicate module.");
};

export const reorderModulesApi = async (courseId, orderedIds) => {
  const res = await authFetch(`${API_BASE}/courses/${courseId}/modules/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  return handle(res, "Failed to reorder modules.");
};

// --- Content items ---
export const createContentItemApi = async (moduleId, formData) => {
  const res = await authFetch(`${API_BASE}/modules/${moduleId}/content`, { method: "POST", body: formData });
  return handle(res, "Failed to add content item.");
};

export const updateContentItemApi = async (id, formData) => {
  const res = await authFetch(`${API_BASE}/content/${id}`, { method: "PUT", body: formData });
  return handle(res, "Failed to update content item.");
};

export const deleteContentItemApi = async (id) => {
  const res = await authFetch(`${API_BASE}/content/${id}`, { method: "DELETE" });
  return handle(res, "Failed to delete content item.");
};

export const reorderContentItemsApi = async (moduleId, orderedIds) => {
  const res = await authFetch(`${API_BASE}/modules/${moduleId}/content/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  return handle(res, "Failed to reorder content items.");
};

export const viewContentFile = async (id) => {
  const res = await authFetch(`${CONTENT_BASE}/${id}/view`);
  if (!res.ok) throw new Error("Failed to open file.");
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), "_blank");
};

// --- Allocations ---
export const listAllocationsApi = async (courseId) => {
  const res = await authFetch(`${API_BASE}/courses/${courseId}/allocations`);
  return handle(res, "Failed to load allocations.");
};

export const createAllocationApi = async (courseId, payload) => {
  const res = await authFetch(`${API_BASE}/courses/${courseId}/allocations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res, "Failed to allocate course.");
};

export const deleteAllocationApi = async (id) => {
  const res = await authFetch(`${API_BASE}/allocations/${id}`, { method: "DELETE" });
  return handle(res, "Failed to remove allocation.");
};

export const bulkAllocateCsvApi = async (courseId, file) => {
  const formData = new FormData();
  formData.append("course_id", courseId);
  formData.append("file", file);
  const res = await authFetch(`${API_BASE}/allocations/bulk-csv`, { method: "POST", body: formData });
  return handle(res, "Failed to bulk-allocate from CSV.");
};

// --- Audit log ---
export const getAuditLogApi = async (entityType, entityId) => {
  const params = new URLSearchParams();
  if (entityType) params.set("entity_type", entityType);
  if (entityId) params.set("entity_id", entityId);
  const res = await authFetch(`${API_BASE}/audit-log?${params.toString()}`);
  return handle(res, "Failed to load audit log.");
};

// --- Assignments (module tests) ---
export const createAssignmentApi = async (moduleId, payload) => {
  const res = await authFetch(`${API_BASE}/modules/${moduleId}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res, "Failed to create assignment.");
};

export const updateAssignmentApi = async (id, payload) => {
  const res = await authFetch(`${API_BASE}/assignments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res, "Failed to update assignment.");
};

export const deleteAssignmentApi = async (id) => {
  const res = await authFetch(`${API_BASE}/assignments/${id}`, { method: "DELETE" });
  return handle(res, "Failed to delete assignment.");
};
