import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ShieldCheck, Building2, BookOpen, FolderArchive, Activity, LogOut, GraduationCap } from "lucide-react";
import TabOneAccounts from "./components/tab1_accounts/TabOneAccounts";
import TabTwoRules from "./components/tab2_rules/TabTwoRules";
import TabThreeResources from "./components/tab3_resources/TabThreeResources";
import TabFourTraining from "./components/tab4_training/TabFourTraining";
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
    <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-white border border-[#ece9e2] rounded-xl shadow-sm p-8 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-[#ff5a36] text-white p-2 rounded-lg shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#0b3f3c]">Mood9 Compliance</h1>
            <p className="text-xs text-[#8a8578]">Sign in to continue</p>
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
          className="w-full bg-[#ff5a36] hover:bg-[#e14a26] text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

// Local dev defaults keep the current simple paths (Super Admin at "/",
// Account Portal at "/account"). Production sets VITE_ADMIN_BASE_PATH and
// VITE_ACCOUNT_BASE_PATH (e.g. "/admin" and "/compliance") so both apps can
// be served from one domain without changing anything in local dev.
const ADMIN_BASE = import.meta.env.VITE_ADMIN_BASE_PATH || "";
const ACCOUNT_BASE = import.meta.env.VITE_ACCOUNT_BASE_PATH || "/account";

export default function App() {
  return (
    <Routes>
      <Route path={`${ACCOUNT_BASE}/*`} element={<AccountPortalRoot />} />
      <Route path={`${ADMIN_BASE}/*`} element={<SuperAdminApp />} />
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
    <div className="min-h-screen bg-[#f7f6f3] text-[#1a1a1a] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-[#ece9e2] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-[#ff5a36] text-white p-2 rounded-lg shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0b3f3c]">Mood9 Compliance</h1>
              <p className="text-xs text-[#8a8578]">Compliance & Regulatory Management Portal</p>
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
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#6b6a63] hover:bg-[#f7f6f3] flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>

        {/* 3 Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-[#f0ede6]">
          <button
            onClick={() => setActiveTab("tab1")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "tab1"
                ? "border-[#ff5a36] text-[#c8431f] bg-[#fff1ec]/50"
                : "border-transparent text-[#6b6a63] hover:text-[#1a1a1a]"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Tab 1: Master Lists & Accounts
          </button>
          <button
            onClick={() => setActiveTab("tab2")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "tab2"
                ? "border-[#ff5a36] text-[#c8431f] bg-[#fff1ec]/50"
                : "border-transparent text-[#6b6a63] hover:text-[#1a1a1a]"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Tab 2: Deep Rules Engine & Legal Explorer
          </button>
          <button
            onClick={() => setActiveTab("tab3")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "tab3"
                ? "border-[#ff5a36] text-[#c8431f] bg-[#fff1ec]/50"
                : "border-transparent text-[#6b6a63] hover:text-[#1a1a1a]"
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            Tab 3: Resources
          </button>
          <button
            onClick={() => setActiveTab("tab4")}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "tab4"
                ? "border-[#ff5a36] text-[#c8431f] bg-[#fff1ec]/50"
                : "border-transparent text-[#6b6a63] hover:text-[#1a1a1a]"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Tab 4: Training
          </button>
        </div>
      </header>

      {/* Main Tab Render Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 space-y-6">
        {activeTab === "tab1" && <TabOneAccounts />}

        {activeTab === "tab2" && <TabTwoRules />}

        {activeTab === "tab3" && <TabThreeResources />}

        {activeTab === "tab4" && <TabFourTraining />}
      </main>
    </div>
  );
}