import React, { useState, useEffect, useMemo } from "react";
import { ListChecks, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchEnrolledActsApi } from "../../services/rulesApi";
import { loadAccountSession } from "../../services/accountAuthApi";
import {
  fetchSopsApi,
  fetchUploadRegistriesApi,
  fetchAssignableOwnersApi,
  setSopStatusApi,
  setProcessStatusApi,
  deleteSopFileApi,
} from "../../services/sopsApi";
import useRegistryLabels from "../../hooks/useRegistryLabels";
import SopCard from "./SopCard";
import CreateActivityModal from "./CreateActivityModal";
import UploadFileModal from "./UploadFileModal";

export default function SopTab() {
  const isManager = loadAccountSession()?.role === "Account Admin";
  const { department_label: departmentLabel, process_label: processLabel } = useRegistryLabels();
  const [acts, setActs] = useState([]);
  const [selectedAct, setSelectedAct] = useState("");
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [owners, setOwners] = useState([]);
  const [registries, setRegistries] = useState({ document_types: [], evidence_types: [], processes: [] });

  const [activityModal, setActivityModal] = useState(null); // assessment_id | null
  const [uploadModal, setUploadModal] = useState(null); // { assessmentId, kind } | null

  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchEnrolledActsApi().then((data) => {
      setActs(data);
      if (data.length > 0) setSelectedAct(data[0]);
    }).catch((err) => setError(err.message));

    fetchAssignableOwnersApi().then(setOwners).catch(() => {});
    fetchUploadRegistriesApi().then(setRegistries).catch(() => {});
  }, []);

  const loadSops = async (actCode) => {
    if (!actCode) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchSopsApi(actCode);
      setSops(data);
    } catch (err) {
      setError(err.message || "Failed to load SOPs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadSops(selectedAct);
  }, [selectedAct]);

  const handleSetStatus = async (assessmentId, status) => {
    setSops((prev) => prev.map((s) => (s.assessment_id === assessmentId ? { ...s, status } : s)));
    try {
      await setSopStatusApi(assessmentId, status);
    } catch (err) {
      alert(err.message);
      await loadSops(selectedAct);
    }
  };

  const handleSetProcessStatus = async (assessmentId, processIndex, status) => {
    setSops((prev) => prev.map((s) => {
      if (s.assessment_id !== assessmentId) return s;
      const processes = s.processes.map((p, i) => (i === processIndex ? { ...p, status } : p));
      return { ...s, processes };
    }));
    try {
      await setProcessStatusApi(assessmentId, processIndex, status);
    } catch (err) {
      alert(err.message);
      await loadSops(selectedAct);
    }
  };

  const handleEditFile = (kind, file) => {
    setUploadModal({ assessmentId: null, kind, editingFile: file });
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    try {
      await deleteSopFileApi(file.id);
      await loadSops(selectedAct);
    } catch (err) {
      alert(err.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(sops.length / pageSize));
  const pagedSops = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sops.slice(start, start + pageSize);
  }, [sops, page, pageSize]);

  return (
    <div className="p-6 space-y-4 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-600" /> SOPs
          </h2>
          <p className="text-xs text-slate-500">
            Standard operating procedures mapped to your account's Acts and Organization Type. View-only apart from status, activities, documents and evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {acts.map((a) => (
            <button
              key={a}
              onClick={() => setSelectedAct(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                selectedAct === a
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {a}
            </button>
          ))}
          <button onClick={() => loadSops(selectedAct)} className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 ml-1">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {error && <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Loading SOPs...</span>
        </div>
      ) : sops.length === 0 ? (
        <div className="p-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
          No SOPs to show for this Act yet.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pagedSops.map((sop, idx) => (
              <SopCard
                key={sop.assessment_id}
                number={(page - 1) * pageSize + idx + 1}
                sop={sop}
                departmentLabel={departmentLabel}
                processLabel={processLabel}
                isManager={isManager}
                onSetStatus={(status) => handleSetStatus(sop.assessment_id, status)}
                onSetProcessStatus={(processIndex, status) => handleSetProcessStatus(sop.assessment_id, processIndex, status)}
                onCreateActivity={() => setActivityModal(sop.assessment_id)}
                onUploadFile={(kind) => setUploadModal({ assessmentId: sop.assessment_id, kind, editingFile: null })}
                onEditFile={handleEditFile}
                onDeleteFile={handleDeleteFile}
              />
            ))}
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
                Page {page} of {totalPages} &middot; {sops.length} SOP{sops.length === 1 ? "" : "s"}
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

      {activityModal && (
        <CreateActivityModal
          assessmentId={activityModal}
          owners={owners}
          onClose={() => setActivityModal(null)}
          onCreated={() => {
            setActivityModal(null);
            loadSops(selectedAct);
          }}
        />
      )}

      {uploadModal && (
        <UploadFileModal
          assessmentId={uploadModal.assessmentId}
          kind={uploadModal.kind}
          editingFile={uploadModal.editingFile}
          owners={owners}
          typeOptions={uploadModal.kind === "evidence" ? registries.evidence_types : registries.document_types}
          processOptions={registries.processes}
          onClose={() => setUploadModal(null)}
          onUploaded={() => {
            setUploadModal(null);
            loadSops(selectedAct);
          }}
        />
      )}
    </div>
  );
}
