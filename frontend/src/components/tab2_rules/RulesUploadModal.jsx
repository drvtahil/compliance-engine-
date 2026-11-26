import React, { useState } from "react";
import { X, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, Save } from "lucide-react";
import { checkUploadApi, downloadUploadErrorReportApi, saveUploadApi } from "../../services/tab2Api";

// Upload an Excel of chapters / rules / sections / questions: Check File first
// (nothing saved), then Confirm & Save once there are no problems.
export default function RulesUploadModal({ acts, defaultAct, onClose, onSaved }) {
  const [actCode, setActCode] = useState(defaultAct || acts[0]?.item_name || "");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null); // { errors, summary, skipped }
  const [error, setError] = useState("");
  const [showSkipped, setShowSkipped] = useState(false);

  const reset = (patch) => { setResult(null); setError(""); setShowSkipped(false); patch(); };

  const run = async (kind, fn) => {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const handleCheck = () => run("check", async () => setResult(await checkUploadApi(actCode, file)));
  const handleReport = () => run("report", () => downloadUploadErrorReportApi(actCode, file));
  const handleSave = () => run("save", async () => {
    const res = await saveUploadApi(actCode, file);
    alert(`Saved: ${res.summary.new_questions} question(s), ${res.summary.new_rules} rule(s), ${res.summary.new_sections} section(s) added.`);
    onSaved(actCode);
  });

  const s = result?.summary;
  const clean = result && result.errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl text-xs">
        <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#fff1ec] text-[#ff5a36] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Upload Rules from Excel</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Act *</label>
              <select
                value={actCode}
                onChange={(e) => reset(() => setActCode(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white font-semibold"
              >
                {acts.map((a) => <option key={a.id} value={a.item_name}>{a.item_name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Excel file (.xlsx) *</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => reset(() => setFile(e.target.files[0] || null))}
                className="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Existing chapters, rules, sections and questions are kept as they are and skipped - only new ones are added.
            Nothing is saved until you click Confirm &amp; Save.
          </p>

          {error && <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

          {result && !clean && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 font-bold">
                <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {result.errors.length} problem(s) found - nothing has been saved</span>
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={!!busy}
                  className="flex items-center gap-1 bg-white border border-red-300 text-red-700 px-2.5 py-1 rounded-md hover:bg-red-100 disabled:opacity-60"
                >
                  {busy === "report" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download Error Report
                </button>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase sticky top-0">
                    <tr><th className="p-2">Sheet</th><th className="p-2">Row</th><th className="p-2">Column</th><th className="p-2">Problem</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="p-2 text-slate-600">{e.sheet}</td>
                        <td className="p-2 font-bold text-slate-700">{e.row}</td>
                        <td className="p-2 text-slate-600">{e.column}</td>
                        <td className="p-2 text-red-700">{e.problem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">Fix these cells in your Excel (the error report highlights them in red), then choose the file again and Check File.</p>
            </div>
          )}

          {clean && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> File is valid
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["New chapters", s.new_chapters], ["New rules", s.new_rules], ["New sections", s.new_sections],
                  ["New questions", s.new_questions], ["New processes", s.new_processes], ["Sub-section rows", s.new_sub_rows],
                  ["Existing rules (kept)", s.skipped_rules], ["Existing questions (skipped)", s.skipped_questions],
                ].map(([label, n]) => (
                  <div key={label} className="border border-slate-200 rounded-lg p-2.5">
                    <div className="text-lg font-extrabold text-slate-800">{n}</div>
                    <div className="text-[10.5px] text-slate-500 font-semibold">{label}</div>
                  </div>
                ))}
              </div>
              {result.skipped?.length > 0 && (
                <div>
                  <button type="button" onClick={() => setShowSkipped((v) => !v)} className="text-[11px] font-bold text-[#0b3f3c] underline">
                    {showSkipped ? "Hide" : "Show"} questions that already exist ({result.skipped.length})
                  </button>
                  {showSkipped && (
                    <ul className="mt-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-0.5 text-slate-600">
                      {result.skipped.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {s.new_questions > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                  {s.new_questions} new question(s) will have no Organization Type and won&apos;t show to accounts until you set it in Tab 2
                  (use &quot;Show only questions missing Organization Type&quot;).
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold">Cancel</button>
          <button
            type="button"
            onClick={handleCheck}
            disabled={!file || !actCode || !!busy}
            className="bg-[#0b3f3c] hover:bg-[#12504c] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy === "check" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Check File
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!clean || !!busy || (s.new_questions + s.new_rules + s.new_sections + s.new_sub_rows === 0)}
            className="bg-[#ff5a36] hover:bg-[#c8431f] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Confirm &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}
