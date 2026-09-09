import React, { useEffect, useState, useMemo } from "react";
import { Archive, Eye, Download, Search, Loader2, RefreshCw } from "lucide-react";
import { fetchEnrolledActsApi } from "../../services/rulesApi";
import { fetchDocumentsApi, fetchEvidenceApi, viewSopFile, downloadSopFile } from "../../services/sopsApi";

const getBadgeColor = (ext) => {
  switch (ext?.toUpperCase()) {
    case "PDF": return "bg-red-50 text-red-700 border-red-200";
    case "XLS": case "XLSX": case "CSV": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "DOC": case "DOCX": return "bg-blue-50 text-blue-700 border-blue-200";
    case "JPG": case "PNG": case "JPEG": return "bg-purple-50 text-purple-700 border-purple-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export default function LibraryTab({ kind = "document" }) {
  const isEvidence = kind === "evidence";
  const title = isEvidence ? "Evidences" : "Document Library";
  const typeLabel = isEvidence ? "Evidence Type" : "Document Type";

  const [acts, setActs] = useState([]);
  const [selectedAct, setSelectedAct] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState("ALL");

  useEffect(() => {
    fetchEnrolledActsApi().then((data) => {
      setActs(data);
      if (data.length > 0) setSelectedAct(data[0]);
    }).catch((err) => setError(err.message));
  }, []);

  const loadFiles = async (actCode) => {
    if (!actCode) return;
    setLoading(true);
    setError("");
    try {
      const data = isEvidence ? await fetchEvidenceApi(actCode) : await fetchDocumentsApi(actCode);
      setFiles(data);
    } catch (err) {
      setError(err.message || "Failed to load files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(selectedAct); }, [selectedAct]);

  const filtered = useMemo(() => {
    let list = files;
    if (activeTypeFilter !== "ALL") {
      list = list.filter((f) => (f.type_name || "Uncategorized") === activeTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description || "").toLowerCase().includes(q) ||
        (f.sop_name || "").toLowerCase().includes(q) ||
        (f.process_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [files, activeTypeFilter, searchQuery]);

  const groups = useMemo(() => {
    const names = [...new Set(files.map((f) => f.type_name || "Uncategorized"))];
    return names.map((name) => ({ name, count: files.filter((f) => (f.type_name || "Uncategorized") === name).length }));
  }, [files]);

  return (
    <div className="p-6 space-y-6 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Archive className="w-5 h-5 text-blue-600" /> {title}
          </h2>
          <p className="text-xs text-slate-500">
            {isEvidence ? "Evidences" : "Documents"} uploaded from SOPs. View-only &mdash; manage uploads from the SOPs tab.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {acts.map((a) => (
            <button
              key={a}
              onClick={() => setSelectedAct(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                selectedAct === a ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

      </div>

      {error && <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {loading ? (
        <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Loading...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="p-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
          No {isEvidence ? "evidence" : "documents"} uploaded yet.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-4">
          {/* LEFT: vertical section tabs */}
          <div className="w-full lg:w-52 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-xs p-2">
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{typeLabel}s</span>
              <button onClick={() => loadFiles(selectedAct)} className="p-1 rounded hover:bg-slate-100" title="Refresh">
                <RefreshCw className="w-3 h-3 text-slate-400" />
              </button>
            </div>
            <div className="space-y-0.5 lg:max-h-[520px] lg:overflow-y-auto">
              <button
                onClick={() => setActiveTypeFilter("ALL")}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold text-left border-l-2 transition ${
                  activeTypeFilter === "ALL" ? "bg-blue-50 text-blue-700 border-blue-600" : "text-slate-600 border-transparent hover:bg-slate-50"
                }`}
              >
                <span className="truncate">All</span>
                <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-extrabold flex-shrink-0 ${activeTypeFilter === "ALL" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                  {files.length}
                </span>
              </button>
              {groups.map((g) => (
                <button
                  key={g.name}
                  onClick={() => setActiveTypeFilter(g.name)}
                  title={g.name}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold text-left border-l-2 transition ${
                    activeTypeFilter === g.name ? "bg-blue-50 text-blue-700 border-blue-600" : "text-slate-600 border-transparent hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{g.name}</span>
                  <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-extrabold flex-shrink-0 ${activeTypeFilter === g.name ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    {g.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: search + results for the selected section */}
          <div className="flex-1 min-w-0 w-full space-y-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Search by name, SOP, process, ${typeLabel.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
                Nothing matches in this {typeLabel.toLowerCase()}.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filtered.map((doc) => (
                    <div key={doc.id} className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-xs text-slate-900 leading-snug truncate">{doc.name}</h4>
                          <div className="flex items-center gap-1 shrink-0">
                            {doc.has_file && (
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border mr-0.5 ${getBadgeColor(doc.file_type)}`}>
                                {doc.file_type || "FILE"}
                              </span>
                            )}
                            {doc.has_file && (
                              <>
                                <button onClick={() => viewSopFile(doc.id)} title="View" className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => downloadSopFile(doc.id, doc.file_name)} title="Download" className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-100 transition">
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-1">{doc.description || "No description provided."}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1 text-[9px] font-bold">
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{doc.sop_name}</span>
                        {doc.process_name && (
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">{doc.process_name}</span>
                        )}
                        {doc.owner && (
                          <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">Owner: {doc.owner.name}</span>
                        )}
                        {doc.version && (
                          <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">v{doc.version}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
