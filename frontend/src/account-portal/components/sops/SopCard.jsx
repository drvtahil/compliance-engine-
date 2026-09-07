import React, { useState } from "react";
import { PlusCircle, FileUp, ShieldPlus, Eye, Download, Edit2, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { viewSopFile, downloadSopFile } from "../../services/sopsApi";

const STATUS_OPTIONS = ["Not Compliant", "Compliant", "Not Applicable"];
const DEFAULT_STATUS = "Not Compliant";

const STATUS_STYLES = {
  Compliant: { active: "bg-emerald-600 text-white border-emerald-600", idle: "bg-white text-slate-600 border-slate-300 hover:bg-emerald-50" },
  "Not Compliant": { active: "bg-red-600 text-white border-red-600", idle: "bg-white text-slate-600 border-slate-300 hover:bg-red-50" },
  "Not Applicable": { active: "bg-slate-500 text-white border-slate-500", idle: "bg-white text-slate-600 border-slate-300 hover:bg-slate-100" },
};

const KIND_STYLES = {
  document: { border: "border-purple-200", chip: "bg-purple-50 text-purple-700 border-purple-200" },
  evidence: { border: "border-amber-200", chip: "bg-amber-50 text-amber-700 border-amber-200" },
};

const getFileTypeBadgeColor = (ext) => {
  switch (ext?.toUpperCase()) {
    case "PDF": return "bg-red-50 text-red-700 border-red-200";
    case "XLS": case "XLSX": case "CSV": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "DOC": case "DOCX": return "bg-blue-50 text-blue-700 border-blue-200";
    case "JPG": case "PNG": case "JPEG": return "bg-purple-50 text-purple-700 border-purple-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

function StatusPill({ status }) {
  const color = status === "Compliant"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "Not Applicable"
    ? "bg-slate-100 text-slate-600 border-slate-300"
    : "bg-red-50 text-red-700 border-red-200";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>{status}</span>;
}

function FileCard({ file, kind, isManager, onEdit, onDelete }) {
  const style = KIND_STYLES[kind];
  return (
    <div className={`bg-white border ${style.border} rounded-lg p-2.5 space-y-1`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {file.process_name && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${style.chip}`}>Process: {file.process_name}</span>
          )}
          {file.type_name && (
            <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
              {kind === "evidence" ? "Evidence Type" : "Document Type"}: {file.type_name}
            </span>
          )}
          {file.has_file && (
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${getFileTypeBadgeColor(file.file_type)}`}>
              {file.file_type || "FILE"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {file.has_file && (
            <>
              <button onClick={() => viewSopFile(file.id)} title="View" className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => downloadSopFile(file.id, file.file_name)} title="Download" className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-100">
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={() => onEdit(file)} title="Edit" className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {isManager && (
            <button onClick={() => onDelete(file)} title="Delete" className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="text-[11px] font-bold text-slate-800 truncate">{file.name}</div>
      {file.description && <div className="text-[10px] text-slate-500 truncate">{file.description}</div>}

      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
        {file.owner && <span>Owner: <span className="font-semibold text-slate-600">{file.owner.name}</span></span>}
        {file.version && <span>v{file.version}</span>}
        {file.updated_on && <span>{file.updated_on}</span>}
      </div>
    </div>
  );
}

export default function SopCard({ sop, departmentLabel, processLabel, isManager, onSetStatus, onSetProcessStatus, onCreateActivity, onUploadFile, onEditFile, onDeleteFile }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-emerald-50/40 transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-emerald-700 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-emerald-700 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-emerald-900 truncate">{sop.sop_name}</div>
            <div className="text-[10px] text-slate-500 truncate">
              {sop.chapter_title} &middot; Rule No. {sop.rule_order}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {sop.assigned_user && (
            <span className="text-[10px] text-slate-500 hidden sm:inline">Assigned to: <span className="font-semibold text-slate-700">{sop.assigned_user.name}</span></span>
          )}
          <StatusPill status={sop.status} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-emerald-100 pt-3">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-emerald-100 pb-2">
            <span className="text-xs font-extrabold text-emerald-900 mr-1">SOP</span>
            {sop.industries.map((ind, i) => (
              <span key={`d-${i}`} className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 uppercase">
                {departmentLabel.toUpperCase()}: {ind}
              </span>
            ))}
            {sop.industry_process && (
              <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase">
                {processLabel.toUpperCase()}: {sop.industry_process}
              </span>
            )}
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3">
            <div className="font-bold text-emerald-900 text-xs">SOP Guidelines</div>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">{sop.sop_details}</p>
          </div>

          <div>
            <span className="font-bold text-slate-800 text-xs">Question: </span>
            <span className="text-xs text-slate-700">{sop.question}</span>
          </div>

          {sop.processes.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-2">Process Action</th>
                    <th className="p-2">Task Name</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sop.processes.map((proc, i) => (
                    <tr key={i}>
                      <td className="p-2 align-top">
                        <div className="font-bold text-blue-700">Process No. {i + 1}</div>
                        <div className="text-slate-600">{proc.action}</div>
                      </td>
                      <td className="p-2 align-top text-slate-700 font-medium">{proc.task_name}</td>
                      <td className="p-2 align-top">
                        <button
                          onClick={() => onSetProcessStatus(i, proc.status === "Complete" ? "Incomplete" : "Complete")}
                          className={`text-[10px] font-bold px-2 py-1 rounded-md border transition ${
                            proc.status === "Complete"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {proc.status === "Complete" ? "Complete" : "Incomplete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {sop.assigned_user ? (
              <span className="text-[11px] text-slate-500">
                Assigned to: <span className="font-semibold text-slate-700">{sop.assigned_user.name}</span>
              </span>
            ) : <span />}
            <div className="flex items-center gap-1">
              {STATUS_OPTIONS.map((opt) => {
                const style = sop.status === opt ? STATUS_STYLES[opt].active : STATUS_STYLES[opt].idle;
                return (
                  <button
                    key={opt}
                    onClick={() => onSetStatus(sop.status === opt ? DEFAULT_STATUS : opt)}
                    title={sop.status === opt ? "Click again to reset to default" : `Set status to ${opt}`}
                    className={`px-2.5 py-1 rounded-md border text-[10.5px] font-bold transition ${style}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={onCreateActivity}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Create Activity
            </button>
            <button
              onClick={() => onUploadFile("document")}
              className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
            >
              <FileUp className="w-3.5 h-3.5" /> Upload Document
            </button>
            <button
              onClick={() => onUploadFile("evidence")}
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
            >
              <ShieldPlus className="w-3.5 h-3.5" /> Upload Evidence
            </button>
          </div>

          {(sop.documents.length > 0 || sop.evidence.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {sop.documents.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Documents</div>
                  {sop.documents.map((f) => (
                    <FileCard key={f.id} file={f} kind="document" isManager={isManager} onEdit={(file) => onEditFile("document", file)} onDelete={(file) => onDeleteFile(file)} />
                  ))}
                </div>
              )}
              {sop.evidence.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Evidences</div>
                  {sop.evidence.map((f) => (
                    <FileCard key={f.id} file={f} kind="evidence" isManager={isManager} onEdit={(file) => onEditFile("evidence", file)} onDelete={(file) => onDeleteFile(file)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
