import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createActivityApi } from "../../services/sopsApi";

export default function CreateActivityModal({ assessmentId, owners, onClose, onCreated }) {
  const [form, setForm] = useState({ activity_name: "", detail: "", owner_admin_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.activity_name.trim()) {
      setError("Activity name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createActivityApi(assessmentId, {
        activity_name: form.activity_name.trim(),
        detail: form.detail.trim(),
        owner_admin_id: form.owner_admin_id ? Number(form.owner_admin_id) : null,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800">Create Activity</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Activity Name *</label>
            <input
              type="text"
              required
              value={form.activity_name}
              onChange={(e) => setForm({ ...form, activity_name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Detail</label>
            <textarea
              rows={3}
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs resize-y focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Owner</label>
            <select
              value={form.owner_admin_id}
              onChange={(e) => setForm({ ...form, owner_admin_id: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
            >
              <option value="">Select owner...</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.user_code})</option>
              ))}
            </select>
          </div>

          {error && <div className="p-2 text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
