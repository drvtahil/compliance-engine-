import React, { useState } from "react";
import { Trash2, Loader2, X, AlertTriangle } from "lucide-react";

// Shown when a master value is still used somewhere: replace it with another
// value from the same list, or remove it from those records (optional fields only).
export default function DeleteMasterItemModal({ usage, onClose, onConfirm }) {
  const [mode, setMode] = useState(usage.can_remove ? "remove" : "replace");
  const [replaceWith, setReplaceWith] = useState("");
  const [busy, setBusy] = useState(false);

  const blockedAct = usage.is_act;
  const canSubmit = !blockedAct && (mode === "remove" ? usage.can_remove : !!replaceWith);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(mode, mode === "replace" ? Number(replaceWith) : null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><Trash2 className="w-4 h-4" /></div>
            <h3 className="text-sm font-bold text-slate-800">Delete &quot;{usage.item_name}&quot;?</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div>
          <div className="font-bold text-slate-700 mb-1">It is used in:</div>
          <ul className="space-y-0.5">
            {usage.usages.map((u) => (
              <li key={u.label} className="flex justify-between gap-2">
                <span className="text-slate-600">{u.label}</span>
                <span className="font-bold text-slate-800">{u.count}</span>
              </li>
            ))}
          </ul>
        </div>

        {blockedAct ? (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            An Act can&apos;t be deleted while it is in use. Delete its chapters, resources and courses first.
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-0.5 text-[#ff5a36] focus:ring-[#ff5a36]" />
              <div className="flex-1">
                <div className="font-bold text-slate-800">Replace it with</div>
                <select
                  value={replaceWith}
                  onChange={(e) => { setReplaceWith(e.target.value); setMode("replace"); }}
                  className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                >
                  <option value="">Choose a value...</option>
                  {usage.replacements.map((r) => <option key={r.id} value={r.id}>{r.item_name}</option>)}
                </select>
              </div>
            </label>
            <label className={`flex items-start gap-2 ${usage.can_remove ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
              <input type="radio" disabled={!usage.can_remove} checked={mode === "remove"} onChange={() => setMode("remove")} className="mt-0.5 text-[#ff5a36] focus:ring-[#ff5a36]" />
              <div>
                <div className="font-bold text-slate-800">Remove it (leave those fields without it)</div>
                {!usage.can_remove && (
                  <div className="text-amber-700 flex items-start gap-1 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                    Not allowed - it is a mandatory or only value on: {usage.remove_blockers.join(", ")}. Choose a replacement.
                  </div>
                )}
              </div>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold">Cancel</button>
          {!blockedAct && (
            <button
              type="button"
              disabled={!canSubmit || busy}
              onClick={submit}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
