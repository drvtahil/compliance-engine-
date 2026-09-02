import React, { useEffect, useState, useMemo } from "react";
import {
  Archive,
  FileText,
  Eye,
  Download,
  Info,
  Search,
  Loader2,
  RefreshCw,
  X,
  BookOpen,
  Activity,
  Briefcase,
  Building,
} from "lucide-react";
import { fetchAccountResourcesApi, getResourceViewUrl, getResourceDownloadUrl } from "../services/resourcesApi";

const getBadgeColor = (ext) => {
  switch (ext?.toUpperCase()) {
    case "PDF":
      return "bg-red-50 text-red-700 border-red-200";
    case "XLS":
    case "XLSX":
    case "CSV":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "DOC":
    case "DOCX":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "JPG":
    case "PNG":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

function DocumentDetailsModal({ doc, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">{doc.title}</h3>
            <span className="text-[11px] text-slate-500">{doc.section_name}</span>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          <div>
            <label className="font-bold text-slate-700 block mb-1 text-[11px] uppercase">Description</label>
            <p className="text-slate-600 leading-relaxed">{doc.description || "No description provided."}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${getBadgeColor(doc.file_type)}`}>
                {doc.file_type || "FILE"}
              </span>
              <div className="text-slate-600 mt-1 truncate">{doc.file_name}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a
                href={getResourceViewUrl(doc.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> View
              </a>
              <a
                href={getResourceDownloadUrl(doc.id)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Acts
            </label>
            <div className="flex flex-wrap gap-1.5">
              {doc.mapped_acts.length > 0 ? (
                doc.mapped_acts.map((v, i) => (
                  <span key={i} className="px-2 py-1 rounded-md bg-blue-600 text-white text-[11px] font-bold">{v}</span>
                ))
              ) : (
                <span className="italic text-slate-400">None mapped</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" /> Industry Processes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {doc.mapped_industry_processes.length > 0 ? (
                doc.mapped_industry_processes.map((v, i) => (
                  <span key={i} className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold">{v}</span>
                ))
              ) : (
                <span className="italic text-slate-400">None mapped</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-purple-600" /> Industries
            </label>
            <div className="flex flex-wrap gap-1.5">
              {doc.mapped_industries.length > 0 ? (
                doc.mapped_industries.map((v, i) => (
                  <span key={i} className="px-2 py-1 rounded-md bg-purple-600 text-white text-[11px] font-bold">{v}</span>
                ))
              ) : (
                <span className="italic text-slate-400">None mapped</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-amber-600" /> Organization Types
            </label>
            <div className="flex flex-wrap gap-1.5">
              {doc.mapped_org_types.map((v, i) => (
                <span key={i} className="px-2 py-1 rounded-md bg-amber-600 text-white text-[11px] font-bold">{v}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResourcesTab() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSectionFilter, setActiveSectionFilter] = useState("ALL");
  const [detailsDoc, setDetailsDoc] = useState(null);

  const loadResources = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAccountResourcesApi();
      setResources(data);
    } catch (err) {
      setError(err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const filtered = useMemo(() => {
    let list = resources;
    if (activeSectionFilter !== "ALL") {
      list = list.filter((r) => r.section_name === activeSectionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          r.mapped_acts.some((v) => v.toLowerCase().includes(q)) ||
          r.mapped_industries.some((v) => v.toLowerCase().includes(q)) ||
          r.mapped_industry_processes.some((v) => v.toLowerCase().includes(q)) ||
          r.mapped_org_types.some((v) => v.toLowerCase().includes(q))
      );
    }
    return list;
  }, [resources, searchQuery, activeSectionFilter]);

  const sections = useMemo(() => {
    const names = [...new Set(resources.map((r) => r.section_name))];
    return names.map((name) => ({
      name,
      count: resources.filter((r) => r.section_name === name).length,
    }));
  }, [resources]);

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Archive className="w-5 h-5 text-blue-600" /> Resources
          </h2>
          <p className="text-xs text-slate-500">
            Compliance document templates published for your organization type. View-only — reach out to your Super Admin for changes.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by document name, Acts, Industry, Org type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Filter:</span>
            <button
              onClick={() => setActiveSectionFilter("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                activeSectionFilter === "ALL"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              All Documents ({resources.length})
            </button>
            {sections.map((sec) => (
              <button
                key={sec.name}
                onClick={() => setActiveSectionFilter(sec.name)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                  activeSectionFilter === sec.name
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {sec.name} ({sec.count})
              </button>
            ))}
            <button
              onClick={loadResources}
              className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {error && <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {resources.length === 0 && !error ? (
        <div className="p-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
          No documents have been published for your organization type yet.
        </div>
      ) : (
        sections
          .filter((sec) => activeSectionFilter === "ALL" || sec.name === activeSectionFilter)
          .map((sec) => {
            const sectionDocs = filtered.filter((d) => d.section_name === sec.name);
            if (sectionDocs.length === 0) return null;
            return (
              <div key={sec.name} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="bg-[#0f172a] text-white px-5 py-3.5 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm tracking-wide">{sec.name}</h3>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold ml-1">
                    {sectionDocs.length} {sectionDocs.length === 1 ? "Document" : "Documents"}
                  </span>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sectionDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between space-y-2.5"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-xs text-slate-900 leading-snug truncate">{doc.title}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border mr-0.5 ${getBadgeColor(doc.file_type)}`}>
                                {doc.file_type || "FILE"}
                              </span>
                              <a
                                href={getResourceViewUrl(doc.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View Document"
                                className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={getResourceDownloadUrl(doc.id)}
                                title="Download Document"
                                className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-100 transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => setDetailsDoc(doc)}
                                title="View Details"
                                className="text-slate-400 hover:text-amber-600 p-1 rounded hover:bg-slate-100 transition"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 truncate mt-1">
                            {doc.description || "No description provided."}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                          {doc.mapped_acts.map((act, i) => (
                            <span key={`act-${i}`} className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              {act}
                            </span>
                          ))}
                          {doc.mapped_industries.map((ind, i) => (
                            <span key={`ind-${i}`} className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                              {ind}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
      )}

      {detailsDoc && <DocumentDetailsModal doc={detailsDoc} onClose={() => setDetailsDoc(null)} />}
    </div>
  );
}
