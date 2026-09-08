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
  ShieldPlus,
  LogOut,
  KeyRound,
} from "lucide-react";
import RulesTab from "./components/RulesTab";
import ResourcesTab from "./components/ResourcesTab";
import UserReadinessTab from "./components/UserReadinessTab";
import ChangePasswordModal from "./components/ChangePasswordModal";
import SopTab from "./components/sops/SopTab";
import ActivityTrackerTab from "./components/sops/ActivityTrackerTab";
import DocumentLibraryTab from "./components/sops/DocumentLibraryTab";
import EvidenceLibraryTab from "./components/sops/EvidenceLibraryTab";
import ComplianceScoreTab from "./components/sops/ComplianceScoreTab";

// Same tab list as the Account Admin App, minus Admin — Users are scoped to
// their own account's view-only data, never to user/question management.
const NAV_ITEMS = [
  { key: "rules", label: "Rules & Acts", icon: BookOpen, enabled: true },
  { key: "readiness", label: "Readiness", icon: ClipboardCheck, enabled: true },
  { key: "sops", label: "SOPs", icon: ListChecks, enabled: true },
  { key: "compliance", label: "Compliance Score", icon: Gauge, enabled: true },
  { key: "activity", label: "Activity Tracker", icon: Activity, enabled: true },
  { key: "library", label: "Document Library", icon: FolderOpen, enabled: true },
  { key: "evidence", label: "Evidences", icon: ShieldPlus, enabled: true },
  { key: "resources", label: "Resources", icon: Archive, enabled: true },
];

export default function UserPortalRoot({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState("rules");
  const [showChangePassword, setShowChangePassword] = useState(false);

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
            <div className="text-[9.5px] text-blue-600 font-bold truncate">{session.role}</div>
            <div className="text-[9.5px] text-slate-500 font-semibold truncate">{session.name}</div>
            {session.job_title && (
              <div className="text-[9.5px] text-purple-600 font-semibold truncate">{session.job_title}</div>
            )}
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

        </nav>

        <div className="border-t border-slate-200 px-3 py-3 flex items-center justify-between gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {session.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowChangePassword(true)}
              title="Change Password"
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 rounded-md text-red-500 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {activeTab === "rules" && <RulesTab />}
        {activeTab === "readiness" && <UserReadinessTab />}
        {activeTab === "sops" && <SopTab />}
        {activeTab === "compliance" && <ComplianceScoreTab />}
        {activeTab === "activity" && <ActivityTrackerTab />}
        {activeTab === "library" && <DocumentLibraryTab />}
        {activeTab === "evidence" && <EvidenceLibraryTab />}
        {activeTab === "resources" && <ResourcesTab />}
      </main>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
