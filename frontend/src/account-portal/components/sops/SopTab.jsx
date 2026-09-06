import React, { useState, useEffect } from "react";
import { ListChecks, Loader2, RefreshCw } from "lucide-react";
import { fetchEnrolledActsApi } from "../../services/rulesApi";
import {
  fetchSopsApi,
  fetchUploadRegistriesApi,
  fetchAssignableOwnersApi,
  setSopStatusApi,
} from "../../services/sopsApi";
import useRegistryLabels from "../../hooks/useRegistryLabels";
import SopCard from "./SopCard";
import CreateActivityModal from "./CreateActivityModal";
import UploadFileModal from "./UploadFileModal";

export default function SopTab() {
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
        <div className="space-y-4">
          {sops.map((sop) => (
            <SopCard
              key={sop.assessment_id}
              sop={sop}
              departmentLabel={departmentLabel}
              processLabel={processLabel}
              onSetStatus={(status) => handleSetStatus(sop.assessment_id, status)}
              onCreateActivity={() => setActivityModal(sop.assessment_id)}
              onUploadFile={(kind) => setUploadModal({ assessmentId: sop.assessment_id, kind })}
            />
          ))}
        </div>
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
