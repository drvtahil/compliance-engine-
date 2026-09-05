import React, { useState, useEffect } from "react";
import { Loader2, Unlock, CheckCircle2 } from "lucide-react";
import { fetchReadinessScoreApi } from "../services/readinessApi";
import useRegistryLabels from "../hooks/useRegistryLabels";
import SemicircleGauge from "./SemicircleGauge";

export default function ReadinessScoreView({ actCode, showReopen, onReopen, reopening }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { department_label: departmentLabel } = useRegistryLabels();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchReadinessScoreApi(actCode)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [actCode]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Calculating Readiness score...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 flex flex-col items-center">
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-bold mb-4">
          <CheckCircle2 className="w-3.5 h-3.5" /> Readiness Submitted
        </div>
        <SemicircleGauge score={data.total.score} size={220} strokeWidth={22} />
        <div className="text-sm font-bold text-slate-800 mt-3">Overall Readiness Score</div>
        <div className="text-[11px] text-slate-500 mt-1">
          {data.total.yes} Yes &middot; {data.total.no} No &middot; {data.total.na} N/A
        </div>

        {showReopen && (
          <button
            onClick={onReopen}
            disabled={reopening}
            className="mt-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5"
          >
            {reopening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
            Reopen for Editing
          </button>
        )}
      </div>

      {data.departments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-4">Score by {departmentLabel}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.departments.map((d) => (
              <div key={d.name} className="flex flex-col items-center bg-slate-50/70 rounded-lg border border-slate-200 p-3.5">
                <SemicircleGauge score={d.score} size={110} strokeWidth={11} />
                <div className="text-[11px] font-bold text-slate-700 text-center mt-2 leading-snug">{d.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {d.yes}Y &middot; {d.no}N &middot; {d.na}NA
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
