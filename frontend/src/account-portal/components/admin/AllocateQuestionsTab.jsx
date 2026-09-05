import React, { useState, useEffect, useMemo } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Loader2, RefreshCw } from "lucide-react";
import { fetchQuestionsApi, fetchAssignableUsersApi, assignQuestionApi, unassignQuestionApi } from "../../services/questionsApi";
import useRegistryLabels from "../../hooks/useRegistryLabels";

export default function AllocateQuestionsTab({ acts }) {
  const { department_label: departmentLabel, process_label: processLabel } = useRegistryLabels();
  const [selectedAct, setSelectedAct] = useState(acts[0] || "");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: "question", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null); // { ids: [...] } when bulk-assign modal open
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  const loadQuestions = async (actCode) => {
    if (!actCode) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchQuestionsApi(actCode);
      setQuestions(data);
      setSelectedIds([]);
    } catch (err) {
      setError(err.message || "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions(selectedAct);
  }, [selectedAct]);

  const handleSort = (field) => {
    setSortConfig((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "asc" }
    );
  };

  const filteredSorted = useMemo(() => {
    let filtered = questions.filter((q) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        q.question.toLowerCase().includes(query) ||
        (q.industry_process || "").toLowerCase().includes(query) ||
        (q.sop_name || "").toLowerCase().includes(query) ||
        q.industries.some((i) => i.toLowerCase().includes(query))
      );
    });

    filtered.sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.field === "assignee") {
        aVal = a.assigned_user?.name || "";
        bVal = b.assigned_user?.name || "";
      } else if (sortConfig.field === "industries") {
        aVal = a.industries.join(", ");
        bVal = b.industries.join(", ");
      } else {
        aVal = a[sortConfig.field] ?? "";
        bVal = b[sortConfig.field] ?? "";
      }
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [questions, searchQuery, sortConfig]);

  const unassignedSelectable = filteredSorted.filter((q) => !q.assigned_user);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === unassignedSelectable.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unassignedSelectable.map((q) => q.id));
    }
  };

  const openAssignModal = async (ids) => {
    try {
      const users = await fetchAssignableUsersApi();
      setAssignableUsers(users);
      setAssignTarget({ ids });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssign = async (userId) => {
    setAssigning(true);
    try {
      for (const id of assignTarget.ids) {
        await assignQuestionApi(id, userId);
      }
      setAssignTarget(null);
      await loadQuestions(selectedAct);
    } catch (err) {
      alert(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (id) => {
    try {
      await unassignQuestionApi(id);
      await loadQuestions(selectedAct);
    } catch (err) {
      alert(err.message);
    }
  };

  const SortIcon = ({ field }) =>
    sortConfig.field === field ? (
      sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
    ) : (
      <ArrowUpDown className="w-3 h-3 text-slate-400" />
    );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Act:</label>
            <select
              value={selectedAct}
              onChange={(e) => setSelectedAct(e.target.value)}
              className="border border-slate-300 rounded-lg p-1.5 text-xs bg-white font-semibold"
            >
              {acts.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button onClick={() => loadQuestions(selectedAct)} className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search questions, ${departmentLabel}, ${processLabel}, SOP...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs font-semibold text-blue-800">
            <span>{selectedIds.length} question(s) selected</span>
            <button
              onClick={() => openAssignModal(selectedIds)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-bold"
            >
              Assign to User
            </button>
          </div>
        )}
      </div>

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border-b border-red-200">{error}</div>}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-semibold">Loading questions...</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={unassignedSelectable.length > 0 && selectedIds.length === unassignedSelectable.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3 cursor-pointer" onClick={() => handleSort("question")}>
                  <div className="flex items-center gap-1">Question Title <SortIcon field="question" /></div>
                </th>
                <th className="p-3 cursor-pointer" onClick={() => handleSort("industries")}>
                  <div className="flex items-center gap-1">{departmentLabel} <SortIcon field="industries" /></div>
                </th>
                <th className="p-3 cursor-pointer" onClick={() => handleSort("industry_process")}>
                  <div className="flex items-center gap-1">{processLabel} <SortIcon field="industry_process" /></div>
                </th>
                <th className="p-3 cursor-pointer" onClick={() => handleSort("assignee")}>
                  <div className="flex items-center gap-1">Current Assignee <SortIcon field="assignee" /></div>
                </th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSorted.length > 0 ? (
                filteredSorted.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/80">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        disabled={!!q.assigned_user}
                        checked={selectedIds.includes(q.id)}
                        onChange={() => toggleSelect(q.id)}
                      />
                    </td>
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
                    <td className="p-3">
                      {q.assigned_user ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                            {q.assigned_user.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-700">{q.assigned_user.name}</span>
                          <span className="text-[10px] text-slate-400">({q.assigned_user.user_code})</span>
                        </div>
                      ) : (
                        <span className="italic text-slate-400 text-[10px]">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {q.assigned_user ? (
                        <button
                          onClick={() => handleUnassign(q.id)}
                          title="Remove Assignment"
                          className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 p-1.5 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                    No questions found for this act.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-800">
              Assign {assignTarget.ids.length} question(s) to...
            </h3>
            {assignableUsers.length > 0 ? (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {assignableUsers.map((u) => (
                  <button
                    key={u.id}
                    disabled={assigning}
                    onClick={() => handleAssign(u.id)}
                    className="w-full text-left p-2 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-between"
                  >
                    <span className="font-semibold text-slate-700">{u.name}</span>
                    <span className="text-slate-400 font-mono">{u.user_code}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 italic p-3 text-center border border-dashed border-slate-200 rounded-lg">
                No active users yet. Create one from "Create User" first.
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button onClick={() => setAssignTarget(null)} className="bg-slate-100 px-3 py-1.5 rounded-lg font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
