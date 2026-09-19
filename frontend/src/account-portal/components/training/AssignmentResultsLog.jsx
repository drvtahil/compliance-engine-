import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { fetchMyAttemptsApi } from "../../services/trainingApi";
import { ScorePill, formatDateTime } from "./assignmentUtils.jsx";

export default function AssignmentResultsLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyAttemptsApi().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded">{error}</div>;
  if (rows.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-16 border border-dashed border-slate-200 rounded-xl">You haven't taken any assignments yet.</div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-xs min-w-[640px]">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
          <tr>
            <th className="py-2 pl-4 font-semibold text-left">Module</th>
            <th className="py-2 font-semibold text-left">Assignment</th>
            <th className="py-2 font-semibold text-left">Date &amp; Time</th>
            <th className="py-2 font-semibold text-left">Attempt</th>
            <th className="py-2 pr-4 font-semibold text-left">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.attempt_id} className="border-b border-slate-50 last:border-0">
              <td className="py-2.5 pl-4">
                <div className="font-bold text-slate-800">{r.module_name}</div>
                <div className="text-[10px] text-slate-400">{r.course_name}</div>
              </td>
              <td className="py-2.5 text-slate-600">{r.assignment_title}</td>
              <td className="py-2.5 text-slate-500">{formatDateTime(r.submitted_at)}</td>
              <td className="py-2.5 text-slate-500">{r.attempt_number}</td>
              <td className="py-2.5 pr-4"><ScorePill percent={r.score_percent} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
