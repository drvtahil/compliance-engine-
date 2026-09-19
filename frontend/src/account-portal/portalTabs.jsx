import { useState, useEffect } from "react";
import {
  BookOpen, ClipboardCheck, GraduationCap, LayoutDashboard, ListChecks, Gauge, Activity,
  FolderOpen, ShieldPlus, Archive, UserCog, Lock
} from "lucide-react";
import { fetchMyPortalTabsApi } from "./services/portalApi";

// The server owns the tab list (key, label, who sees it, whether it is active for
// this account). This file only supplies each tab's icon. To add a tab: add it to
// app/core/portal_tabs.py on the server, an icon here, and its screen in the portal roots.
const TAB_ICONS = {
  rules: BookOpen,
  readiness: ClipboardCheck,
  training: GraduationCap,
  team_training: LayoutDashboard,
  sops: ListChecks,
  compliance: Gauge,
  activity: Activity,
  library: FolderOpen,
  evidence: ShieldPlus,
  resources: Archive,
  admin: UserCog,
};

// Tabs for the signed-in person, with active/inactive state, plus the tab to open first.
export function usePortalTabs() {
  const [tabs, setTabs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMyPortalTabsApi()
      .then((data) => { if (!cancelled) setTabs(data.map((t) => ({ ...t, icon: TAB_ICONS[t.key] || BookOpen }))); })
      .catch(() => { if (!cancelled) setTabs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isEnabled = (key) => tabs.some((t) => t.key === key && t.enabled);
  const firstEnabledKey = tabs.find((t) => t.enabled)?.key || null;
  return { tabs, loading, isEnabled, firstEnabledKey };
}

// Sidebar list: every tab stays visible; inactive ones are greyed out with a lock.
export function PortalNav({ tabs, activeTab, onSelect, collapsed }) {
  return (
    <nav className="flex-1 p-1.5 space-y-0.5 overflow-y-auto">
      {tabs.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.key;
        return (
          <button
            key={item.key}
            disabled={!item.enabled}
            onClick={() => item.enabled && onSelect(item.key)}
            title={item.enabled ? (collapsed ? item.label : undefined) : `${item.label} is not enabled for your account`}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-left ${collapsed ? "justify-center" : ""} ${
              active
                ? "bg-blue-50 text-blue-700"
                : item.enabled
                ? "text-slate-600 hover:bg-slate-50"
                : "text-slate-300 cursor-not-allowed"
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && <span className="flex-1">{item.label}</span>}
            {!collapsed && !item.enabled && <Lock className="w-3 h-3 flex-shrink-0" />}
          </button>
        );
      })}
    </nav>
  );
}

export function NoTabsEnabled() {
  return (
    <div className="p-10 max-w-md mx-auto text-center text-sm text-slate-400">
      <Lock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
      No tabs are enabled for your account yet. Please contact your administrator.
    </div>
  );
}
