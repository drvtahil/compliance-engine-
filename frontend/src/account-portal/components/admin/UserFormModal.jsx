import React, { useState, useEffect } from "react";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { createUserApi, updateUserApi } from "../../services/usersApi";
import useRegistryLabels from "../../hooks/useRegistryLabels";

const emptyForm = {
  name: "",
  job_title: "",
  role_description: "",
  phone: "",
  email: "",
  password: "",
};

export default function UserFormModal({ editingUser, onClose, onSaved }) {
  const { department_label: departmentLabel, process_label: processLabel } = useRegistryLabels();
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingUser) {
      setForm({
        name: editingUser.name,
        job_title: editingUser.job_title,
        role_description: editingUser.role_description,
        phone: editingUser.phone,
        email: editingUser.email,
        password: "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.name.trim().length < 2) {
      setError("Full Name must be at least 2 characters.");
      return;
    }
    if (!editingUser && !form.password.trim()) {
      setError("A password is required to create a user.");
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        await updateUserApi(editingUser.id, form);
      } else {
        await createUserApi(form);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800">
            {editingUser ? `Edit Profile — ${editingUser.user_code}` : "Create User"}
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 overflow-y-auto pr-1 flex-1">
          {error && (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
            <input
              type="text"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Role *</label>
              <input
                type="text"
                required
                placeholder="e.g. Compliance Officer"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Phone *</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Role Description</label>
            <textarea
              rows={2}
              placeholder="Job scope and assessment context..."
              value={form.role_description}
              onChange={(e) => setForm({ ...form, role_description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Email / Login *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Password {editingUser ? "" : "*"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required={!editingUser}
                placeholder={editingUser ? "Leave blank to keep current password" : "Temporary baseline password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 pr-8 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 italic bg-slate-50 border border-slate-200 rounded-lg p-2">
            {departmentLabel} and {processLabel} are set by assigning questions to this user from "Allocate Role & Questions" — not here.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingUser ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
