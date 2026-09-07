import React, { useState, useEffect } from "react";
import { Gauge, Loader2, RefreshCw, LayoutGrid, Building2, Users } from "lucide-react";
import { fetchEnrolledActsApi } from "../../services/rulesApi";
import { fetchComplianceScoreApi } from "../../services/sopsApi";
import SemicircleGauge from "../SemicircleGauge";

const RISK_STYLES = {
  Compliant: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Low Risk": "bg-teal-50 text-teal-700 border-teal-200",
  "Medium Risk": "bg-amber-50 text-amber-700 border-amber-200",
  "High Risk": "bg-red-50 text-red-700 border-red-200",
  "No Data": "bg-slate-100 text-slate-500 border-slate-300",
};

function RiskBadge({ level }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RISK_STYLES[level] || RISK_STYLES["No Data"]}`}>
      {level}
    </span>
  );
}

function ScoreLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
      <span className="font-bold text-slate-600">Score bands:</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> 0&ndash;49% High Risk</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 50&ndash;89% Medium Risk</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> 90&ndash;99% Low Risk</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> 100% Compliant</span>
    </div>
  );
}

function TotalPanel({ data }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 flex flex-col items-center">
      <SemicircleGauge score={data.score} size={220} strokeWidth={22} />
      <div className="text-sm font-bold text-slate-800 mt-3">Overall Compliance Score</div>
      <div className="mt-2"><RiskBadge level={data.risk_level} /></div>
      <div className="text-[11px] text-slate-500 mt-3">
        {data.compliant} Compliant &middot; {data.not_compliant} Not Compliant &middot; {data.not_applicable} Not Applicable
      </div>
    </div>
  );
}

function GroupPanel({ items, emptyLabel, nameOf }) {
  if (items.length === 0) {
    return <div className="p-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center bg-slate-50/70 rounded-lg border border-slate-200 p-3.5">
              <SemicircleGauge score={item.score} size={110} strokeWidth={11} />
              <div className="text-[11px] font-bold text-slate-700 text-center mt-2 leading-snug">{nameOf(item)}</div>
              <div className="mt-1"><RiskBadge level={item.risk_level} /></div>
              <div className="text-[10px] text-slate-400 mt-1">
                {item.compliant}C &middot; {item.not_compliant}NC &middot; {item.not_applicable}NA
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3">Name</th>
                <th className="p-3">Score</th>
                <th className="p-3">Risk Level</th>
                <th className="p-3">Compliant</th>
                <th className="p-3">Not Compliant</th>
                <th className="p-3">Not Applicable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="p-3 font-semibold text-slate-800">{nameOf(item)}</td>
                  <td className="p-3 text-slate-600">{item.score == null ? "-" : `${item.score}%`}</td>
                  <td className="p-3"><RiskBadge level={item.risk_level} /></td>
                  <td className="p-3 text-slate-600">{item.compliant}</td>
                  <td className="p-3 text-slate-600">{item.not_compliant}</td>
                  <td className="p-3 text-slate-600">{item.not_applicable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const SUB_TABS = [
  { key: "total", label: "Total", icon: LayoutGrid },
  { key: "department", label: "By Department", icon: Building2 },
  { key: "user", label: "By User", icon: Users },
];

export default function ComplianceScoreTab() {
  const [acts, setActs] = useState([]);
  const [selectedAct, setSelectedAct] = useState("");
  const [subTab, setSubTab] = useState("total");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEnrolledActsApi().then((acts) => {
      setActs(acts);
      if (acts.length > 0) setSelectedAct(acts[0]);
    }).catch((err) => setError(err.message));
  }, []);

  const loadScore = async (actCode) => {
    if (!actCode) return;
    setLoading(true);
    setError("");
    try {
      setData(await fetchComplianceScoreApi(actCode));
    } catch (err) {
      setError(err.message || "Failed to load compliance score.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadScore(selectedAct); }, [selectedAct]);

  return (
    <div className="p-6 space-y-4 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-600" /> Compliance Score
            </h2>
            <p className="text-xs text-slate-500">
              Read-only view of SOP compliance for your account, computed from Compliant &divide; (Compliant + Not Compliant) &times; 100.
            </p>
          </div>
          <button onClick={() => loadScore(selectedAct)} className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {acts.map((a) => (
            <button
              key={a}
              onClick={() => setSelectedAct(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                selectedAct === a ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 pt-1">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const active = subTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border-b-2 ${
                  active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <ScoreLegend />
      </div>

      {error && <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Calculating compliance score...</span>
        </div>
      ) : !data ? null : (
        <>
          {subTab === "total" && <TotalPanel data={data.total} />}
          {subTab === "department" && (
            <GroupPanel items={data.departments} emptyLabel="No department-tagged SOPs yet." nameOf={(d) => d.name} />
          )}
          {subTab === "user" && (
            <GroupPanel items={data.users} emptyLabel="No SOPs allocated to any user yet." nameOf={(u) => u.user.name} />
          )}
        </>
      )}
    </div>
  );
}
