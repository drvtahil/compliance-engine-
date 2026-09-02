import React, { useState, useEffect } from "react";
import { Users, UserPlus, ListChecks, Loader2 } from "lucide-react";
import { fetchUsersApi } from "../../services/usersApi";
import { fetchEnrolledActsApi } from "../../services/rulesApi";
import UserListTab from "./UserListTab";
import UserFormModal from "./UserFormModal";
import AllocateQuestionsTab from "./AllocateQuestionsTab";

const SUB_TABS = [
  { key: "list", label: "User List", icon: Users },
  { key: "create", label: "Create User", icon: UserPlus },
  { key: "allocate", label: "Allocate Role & Questions", icon: ListChecks },
];

export default function AdminTab() {
  const [activeSubTab, setActiveSubTab] = useState("list");
  const [users, setUsers] = useState([]);
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const refreshUsers = async () => {
    try {
      setUsers(await fetchUsersApi());
    } catch (err) {
      alert(err.message);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [usersData, actsData] = await Promise.all([
        fetchUsersApi(),
        fetchEnrolledActsApi(),
      ]);
      setUsers(usersData);
      setActs(actsData);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Question assignments made in the Allocate tab change a user's derived
  // Industry/Process Areas — refresh whenever User List becomes active so
  // it never shows stale allocations.
  useEffect(() => {
    if (activeSubTab === "list") {
      refreshUsers();
    }
  }, [activeSubTab]);

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Loading Admin console...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">Admin</h2>
        <p className="text-xs text-slate-500">Provision users, assign roles, and allocate compliance questions.</p>
      </div>

      <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold w-fit">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => (tab.key === "create" ? setShowCreateModal(true) : setActiveSubTab(tab.key))}
              className={`px-3.5 py-2 rounded-md transition flex items-center gap-1.5 ${
                activeSubTab === tab.key ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeSubTab === "list" && (
        <UserListTab users={users} onRefresh={loadAll} />
      )}

      {activeSubTab === "allocate" && <AllocateQuestionsTab acts={acts} />}

      {showCreateModal && (
        <UserFormModal
          editingUser={null}
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => {
            setShowCreateModal(false);
            setActiveSubTab("list");
            await loadAll();
          }}
        />
      )}
    </div>
  );
}
