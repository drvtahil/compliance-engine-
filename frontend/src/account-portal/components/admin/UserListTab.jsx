import React, { useState } from "react";
import { Edit2, KeyRound, UserX, UserCheck, Loader2, X } from "lucide-react";
import { toggleUserActiveApi } from "../../services/usersApi";
import UserFormModal from "./UserFormModal";
import ResetUserPasswordModal from "./ResetUserPasswordModal";
import useRegistryLabels from "../../hooks/useRegistryLabels";

export default function UserListTab({ users, onRefresh }) {
  const { department_label: departmentLabel, process_label: processLabel } = useRegistryLabels();
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [blockedNotice, setBlockedNotice] = useState(null);

  const handleToggleActive = async (user) => {
    setTogglingId(user.id);
    try {
      await toggleUserActiveApi(user.id);
      await onRefresh();
    } catch (err) {
      setBlockedNotice({ message: err.message, reasons: err.reasons || [] });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-3">User ID</th>
              <th className="p-3">Full Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Role Title</th>
              <th className="p-3">{departmentLabel}</th>
              <th className="p-3">{processLabel}</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.length > 0 ? (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="p-3 font-bold text-blue-700 font-mono">{u.user_code}</td>
                  <td className="p-3 font-semibold text-slate-800">{u.name}</td>
                  <td className="p-3 text-slate-600">{u.email}</td>
                  <td className="p-3 text-slate-600">{u.phone}</td>
                  <td className="p-3 text-slate-600">{u.job_title}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {u.industries.length > 0 ? (
                        u.industries.map((ind, i) => (
                          <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {ind}
                          </span>
                        ))
                      ) : (
                        <span className="italic text-slate-400 text-[10px]">None yet</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {u.process_areas.length > 0 ? (
                        u.process_areas.map((p, i) => (
                          <span key={i} className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="italic text-slate-400 text-[10px]">None yet</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      u.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {u.is_active ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button
                      onClick={() => setEditingUser(u)}
                      title="Edit Profile"
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 p-1.5 rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setResettingUser(u)}
                      title="Reset Password"
                      className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 p-1.5 rounded"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={togglingId === u.id}
                      title={u.is_active ? "Deactivate" : "Activate"}
                      className={`p-1.5 rounded border ${
                        u.is_active
                          ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {togglingId === u.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : u.is_active ? (
                        <UserX className="w-3.5 h-3.5" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                  No users provisioned yet. Use "Create User" to add your first team member.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <UserFormModal
          editingUser={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={async () => {
            setEditingUser(null);
            await onRefresh();
          }}
        />
      )}

      {resettingUser && (
        <ResetUserPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onDone={() => setResettingUser(null)}
        />
      )}

      {blockedNotice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-amber-300 shadow-2xl p-5 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-amber-700">Cannot deactivate</h3>
              <button onClick={() => setBlockedNotice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600">{blockedNotice.message}</p>
            {blockedNotice.reasons.length > 0 && (
              <ul className="space-y-1.5">
                {blockedNotice.reasons.map((r, i) => (
                  <li key={i} className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-slate-700">
                    {r}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setBlockedNotice(null)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
