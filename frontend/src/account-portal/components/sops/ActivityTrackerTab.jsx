import React, { useState, useEffect, useMemo } from "react";
import { Activity, Loader2, RefreshCw, Info, X, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchActivitiesApi, setActivityStatusApi } from "../../services/sopsApi";
import { loadAccountSession } from "../../services/accountAuthApi";

function ActivityDetailsModal({ activity, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">{activity.activity_name}</h3>
            <span className="text-[11px] text-slate-500">{activity.sop_name}</span>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div>
          <label className="font-bold text-slate-700 block mb-1 text-[11px] uppercase">Description</label>
          <p className="text-slate-600 leading-relaxed">{activity.detail || "No description provided."}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div><span className="text-slate-400">Created By</span><div className="font-semibold text-slate-700">{activity.creator?.name || "-"}</div></div>
          <div><span className="text-slate-400">Owner</span><div className="font-semibold text-slate-700">{activity.owner?.name || "Unassigned"}</div></div>
          <div><span className="text-slate-400">Status</span><div className="font-semibold text-slate-700">{activity.status}</div></div>
          <div><span className="text-slate-400">Date of Completion</span><div className="font-semibold text-slate-700">{activity.completed_at || "-"}</div></div>
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ActivityTrackerTab() {
  const session = loadAccountSession();
  const isManager = session?.role === "Account Admin";
  const currentAdminId = session?.id;

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const loadActivities = async () => {
    setLoading(true);
    setError("");
    try {
      setActivities(await fetchActivitiesApi());
    } catch (err) {
      setError(err.message || "Failed to load activities.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadActivities(); }, []);

  const totalPages = Math.max(1, Math.ceil(activities.length / pageSize));
  const pagedActivities = useMemo(() => {
    const start = (page - 1) * pageSize;
    return activities.slice(start, start + pageSize);
  }, [activities, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const toggleComplete = async (activity) => {
    setUpdatingId(activity.id);
    try {
      const next = activity.status === "Completed" ? "Pending" : "Completed";
      await setActivityStatusApi(activity.id, next);
      await loadActivities();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6 space-y-4 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" /> Activity Tracker
            </h2>
            <p className="text-xs text-slate-500">
              {isManager
                ? "Activities created from SOPs across your account."
                : "Activities you created, or that are allocated to you."}
            </p>
          </div>
          <button onClick={loadActivities} className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {error && <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Loading activities...</span>
        </div>
      ) : activities.length === 0 ? (
        <div className="p-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
          No activities created yet. Create one from a SOP card.
        </div>
      ) : (
        <>
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-3">Activity</th>
                  <th className="p-3">SOP Name</th>
                  <th className="p-3">Created By</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Date of Completion</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedActivities.map((act) => {
                  const canToggle = act.owner?.id === currentAdminId;
                  return (
                    <tr key={act.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-semibold text-slate-800">{act.activity_name}</td>
                      <td className="p-3 text-slate-600">{act.sop_name}</td>
                      <td className="p-3 text-slate-600">{act.creator?.name || "-"}</td>
                      <td className="p-3 text-slate-600">{act.owner?.name || "Unassigned"}</td>
                      <td className="p-3 text-slate-600">{act.completed_at || "-"}</td>
                      <td className="p-3">
                        {canToggle ? (
                          <button
                            onClick={() => toggleComplete(act)}
                            disabled={updatingId === act.id}
                            title="Click to toggle"
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                              act.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {updatingId === act.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            {act.status}
                          </button>
                        ) : (
                          <span
                            title="Only the Owner can change this status"
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              act.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {act.status}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => setViewing(act)} title="View Details" className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Rows per page:</span>
            {[50, 100, 150].map((size) => (
              <button
                key={size}
                onClick={() => { setPageSize(size); setPage(1); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                  pageSize === size ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              Page {page} of {totalPages} &middot; {activities.length} activit{activities.length === 1 ? "y" : "ies"}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>
        </>
      )}

      {viewing && <ActivityDetailsModal activity={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
