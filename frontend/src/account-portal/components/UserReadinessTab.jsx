import React, { useState, useEffect, useMemo } from "react";
import { ClipboardCheck, Search, Loader2, RefreshCw } from "lucide-react";
import { fetchEnrolledActsApi } from "../services/rulesApi";
import { fetchMyReadinessApi, setReadinessResponseApi } from "../services/readinessApi";
import useRegistryLabels from "../hooks/useRegistryLabels";
import ReadinessTable from "./ReadinessTable";
import ReadinessScoreView from "./ReadinessScoreView";

export default function UserReadinessTab() {
  const { department_label: departmentLabel, process_label: processLabel } = useRegistryLabels();
  const [acts, setActs] = useState([]);
  const [selectedAct, setSelectedAct] = useState("");
  const [questions, setQuestions] = useState([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchEnrolledActsApi().then((data) => {
      setActs(data);
      if (data.length > 0) setSelectedAct(data[0]);
    }).catch((err) => setError(err.message));
  }, []);

  const loadQuestions = async (actCode) => {
    if (!actCode) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyReadinessApi(actCode);
      setQuestions(data.questions);
      setLocked(data.locked);
    } catch (err) {
      setError(err.message || "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions(selectedAct);
  }, [selectedAct]);

  const handleSetResponse = async (assessmentId, response) => {
    // optimistic update
    setQuestions((prev) => prev.map((q) => (q.assessment_id === assessmentId ? { ...q, response } : q)));
    try {
      await setReadinessResponseApi(assessmentId, response);
    } catch (err) {
      alert(err.message);
      await loadQuestions(selectedAct);
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return questions;
    const q = searchQuery.toLowerCase();
    return questions.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.industries.some((v) => v.toLowerCase().includes(q)) ||
        item.industry_process.toLowerCase().includes(q)
    );
  }, [questions, searchQuery]);

  return (
    <div className="p-6 space-y-4 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" /> Readiness
          </h2>
          <p className="text-xs text-slate-500">Questions allocated to you. Set a response for each — click a selected option again to clear it.</p>
        </div>

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

          {!locked && (
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Search question, ${departmentLabel}, ${processLabel}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {error && <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Loading questions...</span>
        </div>
      ) : locked ? (
        <ReadinessScoreView actCode={selectedAct} showReopen={false} />
      ) : (
        <ReadinessTable
          questions={filtered}
          locked={locked}
          showAssignee={false}
          onSetResponse={handleSetResponse}
          departmentLabel={departmentLabel}
          processLabel={processLabel}
        />
      )}
    </div>
  );
}
