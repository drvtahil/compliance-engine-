import React, { useState } from "react";
import {
  ShieldCheck,
  BookOpen,
  ClipboardCheck,
  ListChecks,
  Gauge,
  Activity,
  FolderOpen,
  Archive,
  UserCog,
  LogOut,
  KeyRound,
} from "lucide-react";
import AccountLogin from "./AccountLogin";
import RulesTab from "./components/RulesTab";
import ChangePasswordModal from "./components/ChangePasswordModal";
import AdminTab from "./components/admin/AdminTab";
import { loadAccountSession, clearAccountSession } from "./services/accountAuthApi";

export default function AccountPortalRoot() {
  const [session, setSession] = useState(() => loadAccountSession());
  const [activeTab, setActiveTab] = useState("rules");
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = () => {
    clearAccountSession();
    setSession(null);
  };

  if (!session) {
    return <AccountLogin onLoggedIn={setSession} />;
  }

  const isAccountAdmin = session.role === "Account Admin";

  const NAV_ITEMS = [
    { key: "rules", label: "Rules & Acts", icon: BookOpen, enabled: true },
    { key: "readiness", label: "Readiness", icon: ClipboardCheck, enabled: false },
    { key: "sops", label: "SOPs", icon: ListChecks, enabled: false },
    { key: "compliance", label: "Compliance Score", icon: Gauge, enabled: false },
    { key: "activity", label: "Activity Tracker", icon: Activity, enabled: false },
    { key: "library", label: "Library", icon: FolderOpen, enabled: false },
    { key: "resources", label: "Resources", icon: Archive, enabled: false },
    { key: "admin", label: "Admin", icon: UserCog, enabled: isAccountAdmin },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      <aside className="w-52 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="flex items-center gap-2 px-3.5 py-3.5 border-b border-slate-200">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-bold text-slate-800 leading-tight">Mood9 Compliance</div>
            <div className="text-[9.5px] text-slate-400 truncate">{session.account_name}</div>
          </div>
        </div>

        <nav className="flex-1 p-1.5 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                disabled={!item.enabled}
                onClick={() => item.enabled && setActiveTab(item.key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-left ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : item.enabled
                    ? "text-slate-600 hover:bg-slate-50"
                    : "text-slate-300 cursor-not-allowed"
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {!item.enabled && (
                  <span className="text-[9px] font-bold text-slate-300 border border-slate-200 rounded px-1 py-0.5">Soon</span>
                )}
              </button>
            );
          })}

          <div className="my-1.5 border-t border-slate-100" />

          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-left text-slate-600 hover:bg-slate-50"
          >
            <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">Change Password</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-left text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">Logout</span>
          </button>
        </nav>

        <div className="border-t border-slate-200 px-3 py-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {session.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-800 truncate">{session.name}</div>
            <div className="text-[10px] text-slate-400 truncate">{session.role} &middot; {session.account_name}</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {activeTab === "rules" && <RulesTab />}
        {activeTab === "admin" && isAccountAdmin && <AdminTab />}
      </main>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
