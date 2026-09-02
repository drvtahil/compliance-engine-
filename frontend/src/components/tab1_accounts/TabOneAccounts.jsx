import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  PlusCircle,
  Database,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  Loader2,
  Search,
  Calendar,
  Phone,
  Mail,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FolderEdit
} from "lucide-react";
import {
  fetchTab1BootstrapApi,
  createCustomRegistryApi,
  updateRegistryApi,
  deleteRegistryApi,
  addRegistryItemApi,
  updateRegistryItemApi,
  deleteRegistryItemApi,
  createAccountApi,
  updateAccountApi
} from "../../services/tab1Api";

export default function TabOneAccounts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  // Sub-Tab State: Default is "accounts" (Account Registry)
  const [activeSubTab, setActiveSubTab] = useState("accounts"); // 'accounts' | 'masters'

  // Filters, Search & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, Active, Inactive
  const [sortConfig, setSortConfig] = useState({ field: "account_code", direction: "desc" });

  // Pagination State (150 rows per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(150);

  // Modals
  const [showAccountModal, setShowAccountModal] = useState({ open: false, isEdit: false, isViewOnly: false, accountId: null });
  const [showNewListModal, setShowNewListModal] = useState({ open: false, isEdit: false, regId: null });
  const [showItemModal, setShowItemModal] = useState({ open: false, regId: null, regName: "", isEdit: false, itemId: null });

  // Account Form State
  const initialAccountForm = {
    account_name: "",
    location: "",
    org_type: "",
    project_start_date: "",
    project_end_date: "",
    tracking_start_date: "",
    tracking_end_date: "",
    ceo_name: "",
    ceo_phone: "",
    contact_person_name: "",
    contact_person_phone: "",
    enrolled_acts: [],
    admins: [
      { name: "", phone: "", email: "", password: "", admin_code: "" }
    ]
  };
  const [accountForm, setAccountForm] = useState(initialAccountForm);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [removedAdminIds, setRemovedAdminIds] = useState([]);

  // Master List Form State (Create & Edit)
  const [listForm, setListForm] = useState({ display_name: "", description: "" });
  const [itemFormName, setItemFormName] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchTab1BootstrapApi();
      setData(res);
    } catch (err) {
      console.error(err);
      alert("Error loading master registries: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const actsList = data?.registries?.find(r => r.registry_key === "acts")?.items || [];
  const orgTypeList = data?.registries?.find(r => r.registry_key === "organization_types")?.items || [];

  // --- Sorting Handler ---
  const handleSort = (field) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: "asc" };
    });
  };

  // --- Filtered & Sorted Accounts ---
  const filteredAndSortedAccounts = useMemo(() => {
    if (!data?.accounts) return [];

    let filtered = data.accounts.filter(acc => {
      if (statusFilter !== "ALL" && acc.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchesName = acc.account_name.toLowerCase().includes(q);
      const matchesCode = acc.account_code.toLowerCase().includes(q);
      const matchesAct = acc.enrolled_acts.some(a => a.toLowerCase().includes(q));
      const matchesAdmin = acc.admins.some(adm => adm.name.toLowerCase().includes(q) || adm.email.toLowerCase().includes(q));

      return matchesName || matchesCode || matchesAct || matchesAdmin;
    });

    filtered.sort((a, b) => {
      let aVal = a[sortConfig.field];
      let bVal = b[sortConfig.field];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data?.accounts, statusFilter, searchQuery, sortConfig]);

  // --- Pagination Slicing ---
  const totalItems = filteredAndSortedAccounts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedAccounts.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedAccounts, currentPage, pageSize]);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  // --- Account Actions ---
  const handleOpenCreateAccount = () => {
    setAccountForm({
      ...initialAccountForm,
      org_type: orgTypeList[0]?.item_name || "Data Fiduciary",
      enrolled_acts: actsList.length > 0 ? [actsList[0].item_name] : []
    });
    setVisiblePasswords({});
    setRemovedAdminIds([]);
    setShowAccountModal({ open: true, isEdit: false, isViewOnly: false, accountId: null });
  };

  const handleOpenEditAccount = (acc, isViewOnly = false) => {
    setAccountForm({
      account_name: acc.account_name,
      location: acc.location,
      org_type: acc.org_type,
      project_start_date: acc.project_start_date,
      project_end_date: acc.project_end_date,
      tracking_start_date: acc.tracking_start_date,
      tracking_end_date: acc.tracking_end_date,
      ceo_name: acc.ceo_name,
      ceo_phone: acc.ceo_phone,
      contact_person_name: acc.contact_person_name,
      contact_person_phone: acc.contact_person_phone,
      enrolled_acts: acc.enrolled_acts || [],
      admins: acc.admins?.length > 0 ? acc.admins.map(a => ({
        id: a.id,
        admin_code: a.admin_code,
        name: a.name,
        phone: a.phone,
        email: a.email,
        password: ""
      })) : [{ name: "", phone: "", email: "", password: "", admin_code: "" }]
    });
    setVisiblePasswords({});
    setRemovedAdminIds([]);
    setShowAccountModal({ open: true, isEdit: !isViewOnly, isViewOnly, accountId: acc.id });
  };

  const handleToggleActSelection = (actName) => {
    if (showAccountModal.isViewOnly) return;
    setAccountForm(prev => {
      const exists = prev.enrolled_acts.includes(actName);
      if (exists) {
        return { ...prev, enrolled_acts: prev.enrolled_acts.filter(a => a !== actName) };
      } else {
        return { ...prev, enrolled_acts: [...prev.enrolled_acts, actName] };
      }
    });
  };

  const handleAddAdminField = () => {
    setAccountForm(prev => ({
      ...prev,
      admins: [...prev.admins, { name: "", phone: "", email: "", password: "", admin_code: "" }]
    }));
  };

  const handleRemoveAdminField = (idx) => {
    if (accountForm.admins.length === 1) {
      alert("At least one Account Admin is required.");
      return;
    }
    const removed = accountForm.admins[idx];
    if (removed?.id) {
      setRemovedAdminIds(prev => [...prev, removed.id]);
    }
    setAccountForm(prev => ({
      ...prev,
      admins: prev.admins.filter((_, i) => i !== idx)
    }));
  };

  const handleAdminFieldChange = (idx, field, value) => {
    setAccountForm(prev => {
      const updated = [...prev.admins];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, admins: updated };
    });
  };

  const togglePasswordVisibility = (idx) => {
    setVisiblePasswords(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (accountForm.enrolled_acts.length === 0) {
      alert("Please select at least one Enrolled Act.");
      return;
    }
    try {
      setSaving(true);
      if (showAccountModal.isEdit) {
        await updateAccountApi(showAccountModal.accountId, { ...accountForm, removed_admin_ids: removedAdminIds });
        showToast("Account updated successfully.");
      } else {
        await createAccountApi(accountForm);
        showToast("Account registered successfully.");
      }
      setShowAccountModal({ open: false, isEdit: false, isViewOnly: false, accountId: null });
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Dynamic Master List Handlers (Add & Edit List) ---
  const handleOpenCreateList = () => {
    setListForm({ display_name: "", description: "" });
    setShowNewListModal({ open: true, isEdit: false, regId: null });
  };

  const handleOpenEditList = (reg) => {
    setListForm({ display_name: reg.display_name, description: reg.description || "" });
    setShowNewListModal({ open: true, isEdit: true, regId: reg.id });
  };

  const handleSaveList = async (e) => {
    e.preventDefault();
    if (!listForm.display_name.trim()) return;
    try {
      setSaving(true);
      if (showNewListModal.isEdit) {
        await updateRegistryApi(showNewListModal.regId, listForm.display_name.trim(), listForm.description.trim());
      } else {
        await createCustomRegistryApi(listForm.display_name.trim(), listForm.description.trim());
      }
      setShowNewListModal({ open: false, isEdit: false, regId: null });
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRegistry = async (regId, regName) => {
    if (!window.confirm(`Are you sure you want to delete custom list "${regName}" and all its items?`)) return;
    try {
      setSaving(true);
      await deleteRegistryApi(regId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddItem = (reg) => {
    setItemFormName("");
    setShowItemModal({ open: true, regId: reg.id, regName: reg.display_name, isEdit: false, itemId: null });
  };

  const handleOpenEditItem = (reg, item) => {
    setItemFormName(item.item_name);
    setShowItemModal({ open: true, regId: reg.id, regName: reg.display_name, isEdit: true, itemId: item.id });
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemFormName.trim()) return;
    try {
      setSaving(true);
      if (showItemModal.isEdit) {
        await updateRegistryItemApi(showItemModal.itemId, itemFormName.trim());
      } else {
        await addRegistryItemApi(showItemModal.regId, itemFormName.trim());
      }
      setShowItemModal({ open: false, regId: null, regName: "", isEdit: false, itemId: null });
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Delete "${itemName}"? If this is an Act, it will also be unassigned from enrolled enterprise accounts.`)) return;
    try {
      setSaving(true);
      await deleteRegistryItemApi(itemId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Synchronizing Master Registries & Enterprise Accounts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[60] bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      {/* ========================================================================= */}
      {/* SUB-TABS NAVIGATION: DEFAULT IS ACCOUNT REGISTRY                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" /> Tab 1: Management Center
          </h2>
          <p className="text-xs text-slate-500">Configure enterprise multi-tenant accounts, compliance registries, and custom taxonomies.</p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab("accounts")}
            className={`px-4 py-2 rounded-md transition flex items-center gap-2 ${
              activeSubTab === "accounts" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-4 h-4" /> Account Registry ({data?.accounts?.length || 0})
          </button>
          <button
            onClick={() => setActiveSubTab("masters")}
            className={`px-4 py-2 rounded-md transition flex items-center gap-2 ${
              activeSubTab === "masters" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database className="w-4 h-4" /> Master Registries ({data?.registries?.length || 0})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: ACCOUNT REGISTRY (DEFAULT OPEN)                                */}
      {/* ========================================================================= */}
      {activeSubTab === "accounts" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header & Controls */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/70 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" /> Enterprise Accounts Registry
                </h3>
                <p className="text-xs text-slate-500">Multi-tenant client accounts with project lifecycles, enrolled regulatory acts, and admin provisioning.</p>
              </div>
              <button
                onClick={handleOpenCreateAccount}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-xs transition"
              >
                <PlusCircle className="w-4 h-4" /> Register New Account
              </button>
            </div>

            {/* Filters & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Account Name, ID (ACC-0001), Act, or Admin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-bold">
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-3 py-1 rounded-md transition ${statusFilter === "ALL" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600"}`}
                  >
                    All ({data?.accounts?.length || 0})
                  </button>
                  <button
                    onClick={() => setStatusFilter("Active")}
                    className={`px-3 py-1 rounded-md transition ${statusFilter === "Active" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-600"}`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setStatusFilter("Inactive")}
                    className={`px-3 py-1 rounded-md transition ${statusFilter === "Inactive" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-600"}`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Accounts Table List */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider select-none">
                  {/* Sortable: Account ID */}
                  <th
                    onClick={() => handleSort("account_code")}
                    className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Account ID</span>
                      {sortConfig.field === "account_code" ? (
                        sortConfig.direction === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Sortable: Account Name */}
                  <th
                    onClick={() => handleSort("account_name")}
                    className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Account Name &amp; Org Type</span>
                      {sortConfig.field === "account_name" ? (
                        sortConfig.direction === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Enrolled Acts</th>

                  {/* Sortable: Project End Date */}
                  <th
                    onClick={() => handleSort("project_end_date")}
                    className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Project End Date</span>
                      {sortConfig.field === "project_end_date" ? (
                        sortConfig.direction === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedAccounts.length > 0 ? (
                  paginatedAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-bold text-blue-700 font-mono">
                        {acc.account_code}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">{acc.account_name}</div>
                        <span className="text-[11px] text-slate-500 font-normal">{acc.org_type}</span>
                      </td>

                      <td className="p-3.5 text-slate-700">
                        {acc.location}
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {acc.enrolled_acts && acc.enrolled_acts.length > 0 ? (
                            acc.enrolled_acts.map((act, i) => (
                              <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {act}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No acts enrolled</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-700 font-medium">
                        {acc.project_end_date}
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          acc.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-300"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${acc.status === "Active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {acc.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenEditAccount(acc, true)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          onClick={() => handleOpenEditAccount(acc, false)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      No enterprise accounts found matching your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar (Paginated after 150 items) */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Showing <strong>{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, totalItems)}</strong> of <strong>{totalItems}</strong> accounts</span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={150}>150</option>
                  <option value={300}>300</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-300 rounded">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: MASTER REGISTRIES                                              */}
      {/* ========================================================================= */}
      {activeSubTab === "masters" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" /> Master Registries Catalog
              </h3>
              <p className="text-xs text-slate-500">Configure master taxonomies, acts, organizational types, and add/edit custom master lists.</p>
            </div>
            <button
              onClick={handleOpenCreateList}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" /> Add New Master List
            </button>
          </div>

          {/* Dynamic Master Lists Grid with Edit/Delete list controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.registries?.map((reg) => (
              <div key={reg.id} className="bg-slate-50/70 rounded-xl border border-slate-200 p-3.5 flex flex-col h-72 shadow-2xs">
                <div className="mb-2 pb-2 border-b border-slate-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-xs text-slate-800 flex items-center gap-1">
                      {reg.display_name}
                      <span className="text-[10px] text-slate-500 font-normal">({reg.items?.length || 0})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenAddItem(reg)}
                        title="Add Item"
                        className="text-blue-600 hover:text-blue-800 text-[11px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200"
                      >
                        <PlusCircle className="w-3 h-3" /> Add
                      </button>
                      {/* Edit Master List Name & Description */}
                      <button
                        onClick={() => handleOpenEditList(reg)}
                        title="Edit Master List"
                        className="text-slate-500 hover:text-blue-600 p-1 rounded hover:bg-slate-200"
                      >
                        <FolderEdit className="w-3.5 h-3.5" />
                      </button>
                      {!reg.is_system && (
                        <button
                          onClick={() => handleDeleteRegistry(reg.id, reg.display_name)}
                          title="Delete List"
                          className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Master List Description */}
                  <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                    {reg.description || "Custom enterprise registry catalog"}
                  </p>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {reg.items && reg.items.length > 0 ? (
                    reg.items.map((item) => (
                      <div key={item.id} className="p-1.5 bg-white rounded border border-slate-200 text-xs flex justify-between items-center">
                        <span className="text-slate-700 font-medium truncate pr-2">{item.item_name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditItem(reg, item)}
                            className="text-slate-400 hover:text-blue-600 p-0.5"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.item_name)}
                            className="text-slate-400 hover:text-red-600 p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400 italic py-4 text-center">No items. Click "+ Add" to create one.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* MODAL: REGISTER / EDIT / VIEW ENTERPRISE ACCOUNT                          */}
      {/* ========================================================================= */}
      {showAccountModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 text-xs max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {showAccountModal.isViewOnly ? "Account Detailed View" : showAccountModal.isEdit ? "Edit Enterprise Account" : "Register Enterprise Account"}
                </h3>
                <span className="text-[11px] text-slate-500">All fields are mandatory and editable upon registration.</span>
              </div>
              <button onClick={() => setShowAccountModal({ open: false, isEdit: false, isViewOnly: false, accountId: null })}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Account Name *</label>
                  <input
                    type="text"
                    required
                    disabled={showAccountModal.isViewOnly}
                    placeholder="e.g. Apex Health Corp"
                    value={accountForm.account_name}
                    onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    disabled={showAccountModal.isViewOnly}
                    placeholder="e.g. Mumbai, India"
                    value={accountForm.location}
                    onChange={(e) => setAccountForm({ ...accountForm, location: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Organization Type *</label>
                  <select
                    disabled={showAccountModal.isViewOnly}
                    value={accountForm.org_type}
                    onChange={(e) => setAccountForm({ ...accountForm, org_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white disabled:bg-slate-50"
                  >
                    {orgTypeList.map((ot) => (
                      <option key={ot.id} value={ot.item_name}>{ot.item_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" /> Project Start *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={showAccountModal.isViewOnly}
                    value={accountForm.project_start_date}
                    onChange={(e) => setAccountForm({ ...accountForm, project_start_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs bg-white disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" /> Project End *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={showAccountModal.isViewOnly}
                    value={accountForm.project_end_date}
                    onChange={(e) => setAccountForm({ ...accountForm, project_end_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs bg-white disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" /> Tracking Start *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={showAccountModal.isViewOnly}
                    value={accountForm.tracking_start_date}
                    onChange={(e) => setAccountForm({ ...accountForm, tracking_start_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs bg-white disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" /> Tracking End *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={showAccountModal.isViewOnly}
                    value={accountForm.tracking_end_date}
                    onChange={(e) => setAccountForm({ ...accountForm, tracking_end_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs bg-white disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase">CEO / Founder Details</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-medium text-slate-600 block mb-0.5">Name *</label>
                      <input
                        type="text"
                        required
                        disabled={showAccountModal.isViewOnly}
                        value={accountForm.ceo_name}
                        onChange={(e) => setAccountForm({ ...accountForm, ceo_name: e.target.value })}
                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-slate-600 block mb-0.5">Phone *</label>
                      <input
                        type="text"
                        required
                        disabled={showAccountModal.isViewOnly}
                        value={accountForm.ceo_phone}
                        onChange={(e) => setAccountForm({ ...accountForm, ceo_phone: e.target.value })}
                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase">Contact Person Details</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-medium text-slate-600 block mb-0.5">Name *</label>
                      <input
                        type="text"
                        required
                        disabled={showAccountModal.isViewOnly}
                        value={accountForm.contact_person_name}
                        onChange={(e) => setAccountForm({ ...accountForm, contact_person_name: e.target.value })}
                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-slate-600 block mb-0.5">Phone *</label>
                      <input
                        type="text"
                        required
                        disabled={showAccountModal.isViewOnly}
                        value={accountForm.contact_person_phone}
                        onChange={(e) => setAccountForm({ ...accountForm, contact_person_phone: e.target.value })}
                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Acts Enrolled For (Select Multiple) *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-slate-300 rounded-lg p-3 bg-slate-50/50">
                  {actsList.map((act) => {
                    const isChecked = accountForm.enrolled_acts.includes(act.item_name);
                    return (
                      <label
                        key={act.id}
                        className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-xs font-semibold transition ${
                          isChecked ? "bg-blue-50 border-blue-400 text-blue-800" : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={showAccountModal.isViewOnly}
                          checked={isChecked}
                          onChange={() => handleToggleActSelection(act.item_name)}
                          className="rounded text-blue-600"
                        />
                        <span>{act.item_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Account Admins Provisioning</span>
                    <span className="text-[11px] text-slate-400">Multiple admins can be added. Passwords can be edited and toggled.</span>
                  </div>
                  {!showAccountModal.isViewOnly && (
                    <button
                      type="button"
                      onClick={handleAddAdminField}
                      className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Add Admin
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {accountForm.admins.map((adm, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                        <span>Admin #{idx + 1} {adm.admin_code ? `(${adm.admin_code})` : "(Auto-Generated ID)"}</span>
                        {!showAccountModal.isViewOnly && accountForm.admins.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAdminField(idx)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Full Name *</label>
                          <input
                            type="text"
                            required
                            disabled={showAccountModal.isViewOnly}
                            placeholder="Admin Name"
                            value={adm.name}
                            onChange={(e) => handleAdminFieldChange(idx, "name", e.target.value)}
                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white disabled:bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Phone *</label>
                          <input
                            type="text"
                            required
                            disabled={showAccountModal.isViewOnly}
                            placeholder="Phone Number"
                            value={adm.phone}
                            onChange={(e) => handleAdminFieldChange(idx, "phone", e.target.value)}
                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white disabled:bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Email / Login *</label>
                          <input
                            type="email"
                            required
                            disabled={showAccountModal.isViewOnly}
                            placeholder="admin@login.com"
                            value={adm.email}
                            onChange={(e) => handleAdminFieldChange(idx, "email", e.target.value)}
                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white disabled:bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            Password {adm.id ? "" : "*"}
                          </label>
                          <div className="relative">
                            <input
                              type={visiblePasswords[idx] ? "text" : "password"}
                              required={!adm.id}
                              disabled={showAccountModal.isViewOnly}
                              placeholder={adm.id ? "Leave blank to keep current password" : "Password"}
                              value={adm.password}
                              onChange={(e) => handleAdminFieldChange(idx, "password", e.target.value)}
                              className="w-full border border-slate-300 rounded p-1.5 pr-7 text-xs bg-white disabled:bg-slate-50 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(idx)}
                              className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                            >
                              {visiblePasswords[idx] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAccountModal({ open: false, isEdit: false, isViewOnly: false, accountId: null })}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold"
                >
                  {showAccountModal.isViewOnly ? "Close" : "Cancel"}
                </button>
                {!showAccountModal.isViewOnly && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {showAccountModal.isEdit ? "Update Account" : "Register Account"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE OR EDIT CUSTOM MASTER LIST                                  */}
      {/* ========================================================================= */}
      {showNewListModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                {showNewListModal.isEdit ? "Edit Master List" : "Create New Master List"}
              </h3>
              <button onClick={() => setShowNewListModal({ open: false, isEdit: false, regId: null })}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveList} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Master List Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audit Frameworks"
                  value={listForm.display_name}
                  onChange={(e) => setListForm({ ...listForm, display_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of this master list..."
                  value={listForm.description}
                  onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowNewListModal({ open: false, isEdit: false, regId: null })} className="bg-slate-100 px-3 py-1.5 rounded-lg font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold flex items-center gap-1">
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />} {showNewListModal.isEdit ? "Update List" : "Create List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT MASTER ITEM                                             */}
      {/* ========================================================================= */}
      {showItemModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                {showItemModal.isEdit ? `Edit in ${showItemModal.regName}` : `Add to ${showItemModal.regName}`}
              </h3>
              <button onClick={() => setShowItemModal({ open: false, regId: null, regName: "", isEdit: false, itemId: null })}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Item Title / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter name..."
                  value={itemFormName}
                  onChange={(e) => setItemFormName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal({ open: false, regId: null, regName: "", isEdit: false, itemId: null })}
                  className="bg-slate-100 px-3 py-1.5 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold flex items-center gap-1">
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}