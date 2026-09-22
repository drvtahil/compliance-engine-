import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  LogOut,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usePortalTabs, PortalNav, NoTabsEnabled } from "./portalTabs.jsx";
import RulesTab from "./components/RulesTab";
import ResourcesTab from "./components/ResourcesTab";
import ChangePasswordModal from "./components/ChangePasswordModal";
import AdminTab from "./components/admin/AdminTab";
import AdminReadinessTab from "./components/admin/AdminReadinessTab";
import SopTab from "./components/sops/SopTab";
import ActivityTrackerTab from "./components/sops/ActivityTrackerTab";
import DocumentLibraryTab from "./components/sops/DocumentLibraryTab";
import EvidenceLibraryTab from "./components/sops/EvidenceLibraryTab";
import ComplianceScoreTab from "./components/sops/ComplianceScoreTab";
import TrainingTab from "./components/training/TrainingTab";
import TeamTrainingDashboard from "./components/TeamTrainingDashboard";
import NotificationBell from "./components/NotificationBell";
import NotificationsPage from "./components/NotificationsPage";

export default function AccountAdminApp({ session, onLogout }) {
  const { tabs, loading: tabsLoading, isEnabled, firstEnabledKey } = usePortalTabs();
  const [activeTab, setActiveTab] = useState(null);

  // Open the first active tab once the list loads, and step off a tab that is no longer active.
  useEffect(() => {
    if (tabsLoading) return;
    if (activeTab !== "notifications" && (!activeTab || !isEnabled(activeTab))) setActiveTab(firstEnabledKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsLoading, tabs]);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("mood9_sidebar_collapsed") === "1"; } catch { return false; }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("mood9_sidebar_collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-[#1a1a1a] flex font-sans">
      <aside className={`${sidebarCollapsed ? "w-16" : "w-52"} flex-shrink-0 bg-[#0b3f3c] flex flex-col transition-all duration-200`}>
        <div className={`flex items-center gap-2 px-3.5 py-3.5 ${sidebarCollapsed ? "justify-center" : ""}`}>
          <div className="bg-[#ff5a36] text-white p-1.5 rounded-lg shadow-sm flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-white leading-tight">Mood9 Compliance</div>
              <div className="text-[9.5px] text-[#9fd0cb] truncate">{session.account_name}</div>
              <div className="text-[9.5px] text-[#ff9269] font-bold truncate">{session.role}</div>
              <div className="text-[9.5px] text-[#d3ece8] font-semibold truncate">{session.name}</div>
            </div>
          )}
        </div>

        <PortalNav tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} collapsed={sidebarCollapsed} />

        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center gap-1.5 py-2 text-[10.5px] font-bold text-[#9fd0cb] hover:bg-[#12504c] border-t border-[#17423b]"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <><ChevronLeft className="w-3.5 h-3.5" /> Collapse</>}
        </button>

        <div className={`m-2 mt-2 bg-[#12504c] rounded-xl px-3 py-3 flex ${sidebarCollapsed ? "flex-col items-center gap-2" : "items-center justify-between gap-2"}`}>
          <div className="w-8 h-8 rounded-full bg-[#ff7a4d] text-[#0b3f3c] flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {session.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell onNavigateToTraining={() => isEnabled("training") && setActiveTab("training")} onViewAll={() => setActiveTab("notifications")} />
            <button
              onClick={() => setShowChangePassword(true)}
              title="Change Password"
              className="p-1.5 rounded-md text-[#d3ece8] hover:bg-[#0b3f3c] hover:text-white"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 rounded-md text-[#ffb495] hover:bg-[#0b3f3c] hover:text-[#ff9269]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {!tabsLoading && !activeTab && <NoTabsEnabled />}
        {activeTab === "rules" && <RulesTab />}
        {activeTab === "readiness" && <AdminReadinessTab />}
        {activeTab === "training" && <TrainingTab />}
        {activeTab === "team_training" && <TeamTrainingDashboard />}
        {activeTab === "notifications" && <NotificationsPage />}
        {activeTab === "sops" && <SopTab />}
        {activeTab === "compliance" && <ComplianceScoreTab />}
        {activeTab === "activity" && <ActivityTrackerTab />}
        {activeTab === "library" && <DocumentLibraryTab />}
        {activeTab === "evidence" && <EvidenceLibraryTab />}
        {activeTab === "resources" && <ResourcesTab />}
        {activeTab === "admin" && <AdminTab />}
      </main>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
