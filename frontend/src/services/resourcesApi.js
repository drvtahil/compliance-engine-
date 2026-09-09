import { authFetch } from "./authApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/resources`;

export const fetchSectionsApi = async (actCode) => {
  const res = await authFetch(`${API_BASE}/sections?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) throw new Error("Failed to load document sections.");
  return await res.json();
};

export const createSectionApi = async (actCode, name) => {
  const res = await authFetch(`${API_BASE}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ act_code: actCode, name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create section.");
  }
  return await res.json();
};

export const updateSectionApi = async (id, newName) => {
  const res = await authFetch(`${API_BASE}/sections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_name: newName }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to rename section.");
  }
  return await res.json();
};

export const deleteSectionApi = async (id) => {
  const res = await authFetch(`${API_BASE}/sections/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to delete section.");
  }
  return await res.json();
};

export const fetchResourcesApi = async (actCode) => {
  const res = await authFetch(`${API_BASE}?act_code=${encodeURIComponent(actCode)}`);
  if (!res.ok) throw new Error("Failed to load documents.");
  return await res.json();
};

export const createResourceWithFileApi = async (formData) => {
  const res = await authFetch(`${API_BASE}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create document.");
  }
  return await res.json();
};

export const updateResourceWithFileApi = async (id, formData) => {
  const res = await authFetch(`${API_BASE}/${id}`, {
    method: "PUT",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update document.");
  }
  return await res.json();
};

export const deleteResourceApi = async (id) => {
  const res = await authFetch(`${API_BASE}/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to delete document.");
  }
  return await res.json();
};

export const viewResourceFile = async (id) => {
  const res = await authFetch(`${API_BASE}/${id}/view`);
  if (!res.ok) throw new Error("Failed to open file.");
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), "_blank");
};

export const downloadResourceFile = async (id, fileName) => {
  const res = await authFetch(`${API_BASE}/${id}/download`);
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
