import React, { useState } from "react";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { resetUserPasswordApi } from "../../services/usersApi";

export default function ResetUserPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      await resetUserPasswordApi(user.id, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800">Reset Password — {user.name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {success ? (
          <div className="space-y-3">
            <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
              Password reset to <span className="font-mono font-bold">{password}</span>. Share this with {user.name} now — it won't be shown again.
            </div>
            <button onClick={onDone} className="w-full bg-blue-600 text-white text-xs font-bold rounded-lg py-2">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <div className="text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            <div>
              <label className="font-bold text-slate-700 block mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={onClose} className="bg-slate-100 px-3 py-1.5 rounded-lg font-bold">Cancel</button>
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold flex items-center gap-1">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Reset Password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
