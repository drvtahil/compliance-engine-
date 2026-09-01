import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ShieldCheck, Building2, BookOpen, FolderArchive, Activity, LogOut } from "lucide-react";
import TabOneAccounts from "./components/tab1_accounts/TabOneAccounts";
import TabTwoRules from "./components/tab2_rules/TabTwoRules";
import TabThreeResources from "./components/tab3_resources/TabThreeResources";
import { loginApi, loadSession, saveSession, clearSession } from "./services/authApi";
import AccountPortalRoot from "./account-portal/AccountPortalRoot";

function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await loginApi(email, password);
      saveSession(session);
      onLoggedIn(session);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Mood9 Compliance</h1>
            <p className="text-xs text-slate-500">Sign in to continue</p>
          </div>
        </div>

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
            placeholder="admin@login.com"
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
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/account/*" element={<AccountPortalRoot />} />
      <Route path="/*" element={<SuperAdminApp />} />
    </Routes>
  );
}

function SuperAdminApp() {
  const [activeTab, setActiveTab] = useState("tab1");
  const [session, setSession] = useState(() => loadSession());

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  if (!session) {
    return <LoginScreen onLoggedIn={setSession} />;
  }

  const isSuperAdmin = !!session.is_superadmin;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">Mood9 Compliance</h1>
              <p className="text-xs text-slate-500">Compliance & Regulatory Management Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                isSuperAdmin
                  ? "bg-purple-100 text-purple-800 border border-purple-300"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {session.name} {isSuperAdmin ? "(Super Admin)" : "(Standard User)"}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>

        {/* 3 Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTab("tab1")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "tab1"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Tab 1: Master Lists & Accounts
          </button>
          <button
            onClick={() => setActiveTab("tab2")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "tab2"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Tab 2: Deep Rules Engine & Legal Explorer
          </button>
          <button
            onClick={() => setActiveTab("tab3")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "tab3"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            Tab 3: Resources
          </button>
        </div>
      </header>

      {/* Main Tab Render Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 space-y-6">
        {activeTab === "tab1" && <TabOneAccounts />}

        {activeTab === "tab2" && <TabTwoRules />}

        {activeTab === "tab3" && <TabThreeResources />}
      </main>
    </div>
  );
}