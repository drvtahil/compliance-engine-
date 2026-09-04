import React from "react";

const OPTIONS = ["Yes", "No", "NA"];

const OPTION_STYLES = {
  Yes: { active: "bg-emerald-600 text-white border-emerald-600", idle: "bg-white text-slate-600 border-slate-300 hover:bg-emerald-50" },
  No: { active: "bg-red-600 text-white border-red-600", idle: "bg-white text-slate-600 border-slate-300 hover:bg-red-50" },
  NA: { active: "bg-slate-500 text-white border-slate-500", idle: "bg-white text-slate-600 border-slate-300 hover:bg-slate-100" },
};

function ResponseSelector({ value, disabled, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map((opt) => {
        const active = value === opt;
        const style = active ? OPTION_STYLES[opt].active : OPTION_STYLES[opt].idle;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? null : opt)}
            title={active ? "Click again to clear" : `Set response to ${opt}`}
            className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${style}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export default function ReadinessTable({ questions, locked, showAssignee, onSetResponse }) {
  if (questions.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
        No questions to show.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-3 w-8">#</th>
              <th className="p-3">Question</th>
              <th className="p-3">Department</th>
              <th className="p-3">Process</th>
              {showAssignee && <th className="p-3">Assigned To</th>}
              <th className="p-3">Response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {questions.map((q, idx) => (
              <tr key={q.assessment_id} className="hover:bg-slate-50/80 align-top">
                <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                <td className="p-3 text-slate-700 max-w-md">
                  <div className="line-clamp-2">{q.question}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{q.chapter_title} &middot; Rule {q.rule_order}</div>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1 max-w-[160px]">
                    {q.industries.length > 0 ? (
                      q.industries.map((ind, i) => (
                        <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {ind}
                        </span>
                      ))
                    ) : (
                      <span className="italic text-slate-400 text-[10px]">Unset</span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  {q.industry_process ? (
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {q.industry_process}
                    </span>
                  ) : (
                    <span className="italic text-slate-400 text-[10px]">Unset</span>
                  )}
                </td>
                {showAssignee && (
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                        {q.assigned_user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-700">{q.assigned_user.name}</span>
                    </div>
                  </td>
                )}
                <td className="p-3">
                  <ResponseSelector
                    value={q.response}
                    disabled={locked}
                    onChange={(val) => onSetResponse(q.assessment_id, val)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
