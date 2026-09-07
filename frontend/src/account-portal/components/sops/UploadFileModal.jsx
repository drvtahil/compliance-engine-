import React, { useState } from "react";
import { X, Loader2, Upload, FileCheck } from "lucide-react";
import { uploadSopFileApi, updateSopFileApi } from "../../services/sopsApi";

export default function UploadFileModal({ assessmentId, kind, owners, typeOptions, processOptions, editingFile, onClose, onUploaded }) {
  const isEditing = !!editingFile;
  const isEvidence = kind === "evidence";
  const label = isEvidence ? "Evidence" : "Document";

  const [form, setForm] = useState(() => editingFile ? {
    name: editingFile.name,
    description: editingFile.description || "",
    owner_admin_id: editingFile.owner?.id || "",
    version: editingFile.version || "",
    updated_on: editingFile.updated_on || "",
    type_name: editingFile.type_name || "",
    process_name: editingFile.process_name || "",
    file: null,
  } : {
    name: "", description: "", owner_admin_id: "", version: "",
    updated_on: "", type_name: "", process_name: "", file: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(`${label} name is required.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = new FormData();
      if (!isEditing) payload.append("kind", kind);
      payload.append("name", form.name.trim());
      payload.append("description", form.description.trim());
      if (form.owner_admin_id) payload.append("owner_admin_id", form.owner_admin_id);
      payload.append("version", form.version.trim());
      if (form.updated_on) payload.append("updated_on", form.updated_on);
      payload.append("type_name", form.type_name);
      payload.append("process_name", form.process_name);
      if (form.file) payload.append("file", form.file);

      if (isEditing) {
        await updateSopFileApi(editingFile.id, payload);
      } else {
        await uploadSopFileApi(assessmentId, payload);
      }
      onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800">{isEditing ? `Edit ${label}` : `Upload ${label}`}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 overflow-y-auto pr-1 flex-1">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Name of {label} *</label>
            <input
              type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs resize-y focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="font-bold text-slate-700 block mb-1">Version</label>
              <input
                type="text" value={form.version} placeholder="e.g. 1.0"
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Updated On</label>
              <input
                type="date" value={form.updated_on}
                onChange={(e) => setForm({ ...form, updated_on: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{label} Type</label>
              <select
                value={form.type_name}
                onChange={(e) => setForm({ ...form, type_name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
              >
                <option value="">Select type...</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {typeOptions.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1">
                  No {label.toLowerCase()} types found. Ask Super Admin to add a "{isEvidence ? "Evidence Types" : "Document Types"}" master list.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Process</label>
            <select
              value={form.process_name}
              onChange={(e) => setForm({ ...form, process_name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
            >
              <option value="">Select process...</option>
              {processOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-blue-600" /> Browse &amp; Upload
            </label>
            <input
              type="file"
              onChange={(e) => e.target.files?.[0] && setForm({ ...form, file: e.target.files[0] })}
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
            />
            {isEditing && editingFile.file_name && !form.file && (
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5" /> Current file: {editingFile.file_name} &mdash; choose a new file above to replace it.
              </span>
            )}
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
              {isEditing ? "Save Changes" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
