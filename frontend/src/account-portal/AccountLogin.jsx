import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { accountLoginApi, saveAccountSession } from "./services/accountAuthApi";

export default function AccountLogin({ onLoggedIn }) {
  const [loginAs, setLoginAs] = useState("admin"); // "admin" | "user"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await accountLoginApi(email, password, loginAs);
      saveAccountSession(session);
      onLoggedIn(session);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Mood9 Compliance</h1>
            <p className="text-xs text-slate-500">Account Portal &middot; sign in</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setLoginAs("admin")}
            className={`flex-1 px-3 py-1.5 rounded-md transition ${
              loginAs === "admin" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Account Admin
          </button>
          <button
            type="button"
            onClick={() => setLoginAs("user")}
            className={`flex-1 px-3 py-1.5 rounded-md transition ${
              loginAs === "user" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            User
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-sm"
              placeholder="you@yourcompany.com"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-sm"
              placeholder="Password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-center text-[11px] text-slate-400 pt-3 border-t border-slate-100">
            {loginAs === "user"
              ? "For users provisioned by your Account Admin."
              : "For account admins."}{" "}
            Access ends automatically after your account's project period.
          </div>
        </form>
      </div>
    </div>
  );
}
