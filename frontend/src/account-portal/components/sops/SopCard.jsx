import React from "react";
import { PlusCircle, FileUp, ShieldPlus, Eye, Download, FileCheck } from "lucide-react";
import { viewSopFile, downloadSopFile } from "../../services/sopsApi";

const STATUS_OPTIONS = ["Not Compliant", "Compliant", "Not Applicable"];

const STATUS_STYLES = {
  Compliant: { active: "bg-emerald-600 text-white border-emerald-600", idle: "bg-white text-slate-600 border-slate-300 hover:bg-emerald-50" },
  "Not Compliant": { active: "bg-red-600 text-white border-red-600", idle: "bg-white text-slate-600 border-slate-300 hover:bg-red-50" },
  "Not Applicable": { active: "bg-slate-500 text-white border-slate-500", idle: "bg-white text-slate-600 border-slate-300 hover:bg-slate-100" },
};

function FileRow({ file }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
      <div className="min-w-0 flex items-center gap-2">
        <FileCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-slate-700 truncate">{file.name}</span>
        {file.type_name && (
          <span className="text-[9px] font-bold bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">{file.type_name}</span>
        )}
      </div>
      {file.has_file && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => viewSopFile(file.id)} title="View" className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => downloadSopFile(file.id, file.file_name)} title="Download" className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-100">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SopCard({ sop, departmentLabel, processLabel, onSetStatus, onCreateActivity, onUploadFile }) {
  return (
    <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-emerald-100 pb-2">
        <span className="text-xs font-extrabold text-emerald-900">ASSESSMENT, SOP &amp; PROCESS</span>
        <div className="flex flex-wrap items-center gap-1.5">
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
          {sop.mapped_org_types.map((org, i) => (
            <span key={`o-${i}`} className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 uppercase">
              ORGANIZATION TYPE: {org}
            </span>
          ))}
        </div>
      </div>

      <div>
        <span className="font-bold text-slate-800 text-xs">Question: </span>
        <span className="text-xs text-slate-700">{sop.question}</span>
      </div>

      <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3">
        <div className="font-bold text-emerald-900 text-xs">SOP: {sop.sop_name}</div>
        <p className="text-xs text-emerald-800 mt-1 leading-relaxed">{sop.sop_details}</p>
      </div>

      {sop.processes.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="p-2">Process Action</th>
                <th className="p-2">Task Name</th>
                <th className="p-2">Schedule / Auto-Tracking</th>
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
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800">{proc.schedule}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${proc.auto_tracking ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                        {proc.auto_tracking ? "Enabled" : "Disabled"}
                      </span>
                    </div>
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
                onClick={() => onSetStatus(opt)}
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
              {sop.documents.map((f) => <FileRow key={f.id} file={f} />)}
            </div>
          )}
          {sop.evidence.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Evidence</div>
              {sop.evidence.map((f) => <FileRow key={f.id} file={f} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
