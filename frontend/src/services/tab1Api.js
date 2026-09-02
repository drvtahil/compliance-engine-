import { authFetch } from "./authApi";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1/tab1`;

export const fetchTab1BootstrapApi = async () => {
  const res = await authFetch(`${API_BASE}/bootstrap`);
  if (!res.ok) throw new Error("Failed to load Tab 1 registries and accounts from database.");
  return await res.json();
};

export const createCustomRegistryApi = async (display_name, description = "") => {
  const res = await authFetch(`${API_BASE}/registries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name, description }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create new registry.");
  }
  return await res.json();
};

export const updateRegistryApi = async (reg_id, display_name, description = "") => {
  const res = await authFetch(`${API_BASE}/registries/${reg_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name, description }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update registry.");
  }
  return await res.json();
};

export const deleteRegistryApi = async (reg_id) => {
  const res = await authFetch(`${API_BASE}/registries/${reg_id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Cannot delete registry.");
  }
  return await res.json();
};

export const addRegistryItemApi = async (reg_id, item_name, item_code = "", description = "") => {
  const res = await authFetch(`${API_BASE}/registries/${reg_id}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_name, item_code, description }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to add item to registry.");
  }
  return await res.json();
};

export const updateRegistryItemApi = async (item_id, item_name, item_code = "", description = "") => {
  const res = await authFetch(`${API_BASE}/registry-items/${item_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_name, item_code, description }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update registry item.");
  }
  return await res.json();
};

export const deleteRegistryItemApi = async (item_id) => {
  const res = await authFetch(`${API_BASE}/registry-items/${item_id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to delete registry item.");
  }
  return await res.json();
};

export const createAccountApi = async (payload) => {
  const res = await authFetch(`${API_BASE}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to register account.");
  }
  return await res.json();
};

export const updateAccountApi = async (account_id, payload) => {
  const res = await authFetch(`${API_BASE}/accounts/${account_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update account.");
  }
  return await res.json();
};
