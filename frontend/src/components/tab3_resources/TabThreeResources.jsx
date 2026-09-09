import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  PlusCircle,
  Trash2,
  Edit2,
  Loader2,
  Search,
  FolderPlus,
  BookOpen,
  Briefcase,
  Activity,
  Building,
  X,
  Eye,
  Download,
  Upload,
  FileCheck
} from "lucide-react";
import { fetchTab1BootstrapApi } from "../../services/tab1Api";
import {
  fetchSectionsApi,
  createSectionApi,
  updateSectionApi,
  deleteSectionApi,
  fetchResourcesApi,
  createResourceWithFileApi,
  updateResourceWithFileApi,
  deleteResourceApi,
  getFileViewUrl,
  getFileDownloadUrl
} from "../../services/resourcesApi";

export default function TabThreeResources() {
  const [selectedAct, setSelectedAct] = useState("");
  const [sections, setSections] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tab 1 Masters
  const [samplePoliciesMaster, setSamplePoliciesMaster] = useState([]);
  const [actsMaster, setActsMaster] = useState([]);
  const [industryProcessesMaster, setIndustryProcessesMaster] = useState([]);
  const [industriesMaster, setIndustriesMaster] = useState([]);
  const [orgTypesMaster, setOrgTypesMaster] = useState([]);
  const [departmentLabel, setDepartmentLabel] = useState("Department");
  const [processLabel, setProcessLabel] = useState("Process");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSectionFilter, setActiveSectionFilter] = useState("ALL");

  // Section Modal (Add / Edit)
  const [sectionModal, setSectionModal] = useState({ open: false, isEdit: false, sectionId: null, name: "" });

  // Document Modal (Add / Edit)
  const initialDocState = {
    title: "",
    section_name: "Sample Policy",
    description: "",
    mapped_acts: [],
    mapped_industry_processes: [],
    mapped_industries: [],
    mapped_org_types: [],
    file: null,
    existingFileName: "",
    existingFileType: ""
  };
  const [docModal, setDocModal] = useState({ open: false, isEdit: false, docId: null });
  const [docForm, setDocForm] = useState(initialDocState);

  const loadMasters = async () => {
    try {
      setLoading(true);
      const bootstrapData = await fetchTab1BootstrapApi();
      const regs = bootstrapData.registries || [];

      setSamplePoliciesMaster(regs.find((r) => r.registry_key === "sample_policies")?.items || []);
      const acts = regs.find((r) => r.registry_key === "acts")?.items || [];
      setActsMaster(acts);
      const processesRegistry = regs.find((r) => r.registry_key === "industry_processes");
      const industriesRegistry = regs.find((r) => r.registry_key === "industries");
      setIndustryProcessesMaster(processesRegistry?.items || []);
      setIndustriesMaster(industriesRegistry?.items || []);
      setOrgTypesMaster(regs.find((r) => r.registry_key === "organization_types")?.items || []);
      setDepartmentLabel(industriesRegistry?.display_name || "Department");
      setProcessLabel(processesRegistry?.display_name || "Process");

      if (acts.length > 0) {
        setSelectedAct((prev) => prev || acts[0].item_name);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error loading Tab 3 masters: " + err.message);
      setLoading(false);
    }
  };

  const loadSectionsAndResources = async (actCode) => {
    if (!actCode) return;
    try {
      setLoading(true);
      const [secList, resList] = await Promise.all([fetchSectionsApi(actCode), fetchResourcesApi(actCode)]);
      setSections(secList);
      setResources(resList);
      setActiveSectionFilter("ALL");
    } catch (err) {
      console.error(err);
      alert("Error loading documents for this Act: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadData = () => loadSectionsAndResources(selectedAct);

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    loadSectionsAndResources(selectedAct);
  }, [selectedAct]);

  // Multi-Select Toggle Helper
  const toggleArrayItem = (field, itemVal) => {
    setDocForm((prev) => {
      const cur = prev[field] || [];
      const updated = cur.includes(itemVal)
        ? cur.filter((x) => x !== itemVal)
        : [...cur, itemVal];
      return { ...prev, [field]: updated };
    });
  };

  // Section Handlers
  const handleOpenAddSection = () => {
    setSectionModal({ open: true, isEdit: false, sectionId: null, name: "" });
  };

  const handleOpenEditSection = (sec) => {
    if (sec.name === "Sample Policy" || sec.is_system) {
      alert("Sample Policy section cannot be renamed.");
      return;
    }
    setSectionModal({ open: true, isEdit: true, sectionId: sec.id, name: sec.name });
  };

  const handleSaveSection = async (e) => {
    e.preventDefault();
    if (!sectionModal.name.trim()) return;
    try {
      setSaving(true);
      if (sectionModal.isEdit) {
        await updateSectionApi(sectionModal.sectionId, sectionModal.name.trim());
      } else {
        await createSectionApi(selectedAct, sectionModal.name.trim());
      }
      setSectionModal({ open: false, isEdit: false, sectionId: null, name: "" });
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (sec) => {
    if (sec.name === "Sample Policy" || sec.is_system) {
      alert("Sample Policy section cannot be deleted.");
      return;
    }
    if (sec.doc_count > 0) {
      alert(`Cannot delete "${sec.name}" because it contains ${sec.doc_count} document(s). Please delete all documents inside this section first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete section "${sec.name}"?`)) return;

    try {
      setSaving(true);
      await deleteSectionApi(sec.id);
      if (activeSectionFilter === sec.name) setActiveSectionFilter("ALL");
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Document Handlers
  const handleOpenAddDoc = (targetSection = "Sample Policy") => {
    const defaultTitle = targetSection === "Sample Policy" && samplePoliciesMaster.length > 0
      ? samplePoliciesMaster[0].item_name
      : "";

    setDocForm({
      ...initialDocState,
      section_name: targetSection,
      title: defaultTitle
    });
    setDocModal({ open: true, isEdit: false, docId: null });
  };

  const handleOpenEditDoc = (doc) => {
    setDocForm({
      title: doc.title,
      section_name: doc.section_name,
      description: doc.description || "",
      mapped_acts: doc.mapped_acts || [],
      mapped_industry_processes: doc.mapped_industry_processes || [],
      mapped_industries: doc.mapped_industries || [],
      mapped_org_types: doc.mapped_org_types || [],
      file: null,
      existingFileName: doc.file_name || "",
      existingFileType: doc.file_type || ""
    });
    setDocModal({ open: true, isEdit: true, docId: doc.id });
  };

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    if (!docForm.title.trim()) {
      alert("Please enter or select a document name.");
      return;
    }

    const payload = new FormData();
    payload.append("title", docForm.title.trim());
    payload.append("act_code", selectedAct);
    payload.append("section_name", docForm.section_name);
    payload.append("description", docForm.description.trim());
    payload.append("mapped_acts", JSON.stringify(docForm.mapped_acts));
    payload.append("mapped_industry_processes", JSON.stringify(docForm.mapped_industry_processes));
    payload.append("mapped_industries", JSON.stringify(docForm.mapped_industries));
    payload.append("mapped_org_types", JSON.stringify(docForm.mapped_org_types));

    if (docForm.file) {
      payload.append("file", docForm.file);
    }

    try {
      setSaving(true);
      if (docModal.isEdit) {
        await updateResourceWithFileApi(docModal.docId, payload);
      } else {
        await createResourceWithFileApi(payload);
      }
      setDocModal({ open: false, isEdit: false, docId: null });
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      setSaving(true);
      await deleteResourceApi(id);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Search & Filter Logic
  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
      if (activeSectionFilter !== "ALL" && item.section_name !== activeSectionFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchDocName = item.title.toLowerCase().includes(q);
      const matchActs = item.mapped_acts?.some((a) => a.toLowerCase().includes(q));
      const matchProcs = item.mapped_industry_processes?.some((p) => p.toLowerCase().includes(q));
      const matchInds = item.mapped_industries?.some((i) => i.toLowerCase().includes(q));
      const matchOrgs = item.mapped_org_types?.some((o) => o.toLowerCase().includes(q));

      return matchDocName || matchActs || matchProcs || matchInds || matchOrgs;
    });
  }, [resources, activeSectionFilter, searchQuery]);

  const visibleSections = useMemo(() => {
    if (activeSectionFilter === "ALL") return sections;
    return sections.filter((s) => s.name === activeSectionFilter);
  }, [sections, activeSectionFilter]);

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
      case "JPEG":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Synchronizing Policy Documents &amp; Master Registries...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & RIGHT FILTERS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Tab 3: Document &amp; Compliance Resources Library
            </h2>
            <p className="text-xs text-slate-500">
              Manage statutory policy templates, vendor contracts, and audit documents mapped directly to Tab 1 Master Registries.
            </p>
          </div>

          <button
            onClick={handleOpenAddSection}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition self-start sm:self-auto"
          >
            <FolderPlus className="w-4 h-4" /> Add Section
          </button>
        </div>

        {/* Dynamic Master Act Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {actsMaster.map((act) => (
            <button
              key={act.id}
              onClick={() => setSelectedAct(act.item_name)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedAct === act.item_name
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {act.item_name}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full pt-1">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={`Search by Document name, Acts, ${processLabel}, ${departmentLabel}, Org type...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
          />
        </div>

        {/* Section Tabs */}
        <div className="flex items-center justify-between gap-2 border-b-2 border-slate-100">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveSectionFilter("ALL")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 -mb-0.5 transition ${
                activeSectionFilter === "ALL" ? "text-blue-600 border-blue-600" : "text-slate-500 border-transparent hover:text-slate-800"
              }`}
            >
              All Documents
              <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-extrabold ${activeSectionFilter === "ALL" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                {resources.length}
              </span>
            </button>
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSectionFilter(sec.name)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 -mb-0.5 transition ${
                  activeSectionFilter === sec.name ? "text-blue-600 border-blue-600" : "text-slate-500 border-transparent hover:text-slate-800"
                }`}
              >
                {sec.name}
                <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-extrabold ${activeSectionFilter === sec.name ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                  {sec.doc_count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. ALL DOCUMENTS: FLAT GRID (no per-section chrome, nothing to scroll past) */}
      {activeSectionFilter === "ALL" ? (
        filteredResources.length === 0 ? (
          <div className="p-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
            No documents match.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between space-y-2.5"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-xs text-slate-900 leading-snug truncate">{doc.title}</h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.has_file && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border mr-0.5 ${getBadgeColor(doc.file_type)}`}>
                            {doc.file_type || "FILE"}
                          </span>
                        )}
                        {doc.has_file && (
                          <a href={getFileViewUrl(doc.id)} target="_blank" rel="noreferrer" title="View Document" className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition">
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {doc.has_file && (
                          <a href={getFileDownloadUrl(doc.id)} download title="Download Document" className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-100 transition">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={() => handleOpenEditDoc(doc)} title="Edit Document" className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteDocument(doc.id, doc.title)} title="Delete Document" className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">{doc.description || "No description provided."}</p>
                    <span className="inline-block mt-1 text-[9px] font-bold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{doc.section_name}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {doc.mapped_acts?.map((act, i) => (
                      <span key={`act-${i}`} className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{act}</span>
                    ))}
                    {doc.mapped_industries?.map((ind, i) => (
                      <span key={`ind-${i}`} className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">{ind}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
      <div className="space-y-6">
        {visibleSections.map((sec) => {
          const sectionDocs = filteredResources.filter((d) => d.section_name === sec.name);

          return (
            <div key={sec.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Section Header */}
              <div className="bg-[#0f172a] text-white px-5 py-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm tracking-wide capitalize">{sec.name}</h3>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold ml-1">
                    {sectionDocs.length} {sectionDocs.length === 1 ? "Document" : "Documents"}
                  </span>

                  {/* Edit & Delete Section Buttons (Disabled for Sample Policy) */}
                  {!sec.is_system && sec.name !== "Sample Policy" && (
                    <div className="flex items-center gap-1 ml-3 border-l border-slate-700 pl-3">
                      <button
                        onClick={() => handleOpenEditSection(sec)}
                        title="Rename Section"
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSection(sec)}
                        title="Delete Section (Must be empty)"
                        className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-slate-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleOpenAddDoc(sec.name)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition self-start sm:self-auto"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Document to {sec.name}
                </button>
              </div>

              {/* Compact Card Grid */}
              <div className="p-4 sm:p-5">
                {sectionDocs.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 italic text-xs">
                    No documents found in this section.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sectionDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between space-y-2.5"
                      >
                        <div>
                          {/* Row 1: Document Name + Separate View & Download + Edit & Delete */}
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-xs text-slate-900 leading-snug truncate">
                              {doc.title}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* File Type Badge */}
                              {doc.has_file && (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border mr-0.5 ${getBadgeColor(doc.file_type)}`}>
                                  {doc.file_type || "FILE"}
                                </span>
                              )}

                              {/* 1. View Document Button */}
                              {doc.has_file && (
                                <a
                                  href={getFileViewUrl(doc.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="View Document"
                                  className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* 2. Download Document Button */}
                              {doc.has_file && (
                                <a
                                  href={getFileDownloadUrl(doc.id)}
                                  download
                                  title="Download Document"
                                  className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-100 transition"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Edit Document */}
                              <button
                                onClick={() => handleOpenEditDoc(doc)}
                                title="Edit Document"
                                className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Document */}
                              <button
                                onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                title="Delete Document"
                                className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: 1-Line Truncated Description */}
                          <p className="text-[11px] text-slate-500 truncate mt-1">
                            {doc.description || "No description provided."}
                          </p>
                        </div>

                        {/* Mapped Masters: ACTS + INDUSTRIES */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                          {/* Acts (Blue Badges) */}
                          {doc.mapped_acts?.map((act, i) => (
                            <span key={`act-${i}`} className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              {act}
                            </span>
                          ))}
                          {/* Industries (Purple Badges) */}
                          {doc.mapped_industries?.map((ind, i) => (
                            <span key={`ind-${i}`} className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                              {ind}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* 3. MODAL: ADD / EDIT DOCUMENT WITH FILE UPLOAD & MASTER MULTI-SELECTS */}
      {docModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {docModal.isEdit ? `Edit Document in "${docForm.section_name}"` : `Add Document to "${docForm.section_name}"`}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Fill in document specifications and attach required files.
                </span>
              </div>
              <button onClick={() => setDocModal({ open: false, isEdit: false, docId: null })}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Document Name / Sample Policy Dropdown */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {docForm.section_name === "Sample Policy" ? "Policy Name (from Tab 1 Master) *" : "Document Name *"}
                </label>
                {docForm.section_name === "Sample Policy" ? (
                  <select
                    value={docForm.title}
                    onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    {samplePoliciesMaster.map((pol) => (
                      <option key={pol.id} value={pol.item_name}>
                        {pol.item_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Enter document name..."
                    value={docForm.title}
                    onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                )}
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter a brief one-line description and scope..."
                  value={docForm.description}
                  onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 resize-y focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              {/* File Upload Input */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-blue-600" /> Upload Document (PDF, Excel, Word, etc.)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls,.docx,.doc,.txt,.csv,image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setDocForm({ ...docForm, file: e.target.files[0] });
                      }
                    }}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                  />
                </div>
                {docForm.existingFileName && !docForm.file && (
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5" /> Current file: {docForm.existingFileName} ({docForm.existingFileType})
                  </span>
                )}
              </div>

              {/* 1) Acts Multi-Select */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" /> 1. Acts (Multi-Select)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-24 overflow-y-auto p-1">
                  {actsMaster.map((act) => {
                    const isChecked = docForm.mapped_acts?.includes(act.item_name);
                    return (
                      <button
                        type="button"
                        key={act.id}
                        onClick={() => toggleArrayItem("mapped_acts", act.item_name)}
                        className={`p-1.5 rounded-md border text-[11px] font-bold text-left truncate transition ${
                          isChecked
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {act.item_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2) Industry Processes Multi-Select */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" /> 2. {processLabel} (Multi-Select)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-24 overflow-y-auto p-1">
                  {industryProcessesMaster.map((proc) => {
                    const isChecked = docForm.mapped_industry_processes?.includes(proc.item_name);
                    return (
                      <button
                        type="button"
                        key={proc.id}
                        onClick={() => toggleArrayItem("mapped_industry_processes", proc.item_name)}
                        className={`p-1.5 rounded-md border text-[11px] font-bold text-left truncate transition ${
                          isChecked
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {proc.item_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3) Industries Multi-Select */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-purple-600" /> 3. {departmentLabel} (Multi-Select)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-24 overflow-y-auto p-1">
                  {industriesMaster.map((ind) => {
                    const isChecked = docForm.mapped_industries?.includes(ind.item_name);
                    return (
                      <button
                        type="button"
                        key={ind.id}
                        onClick={() => toggleArrayItem("mapped_industries", ind.item_name)}
                        className={`p-1.5 rounded-md border text-[11px] font-bold text-left truncate transition ${
                          isChecked
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {ind.item_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4) Organization Types Multi-Select */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-600" /> 4. Organization Types (Multi-Select)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-24 overflow-y-auto p-1">
                  {orgTypesMaster.map((org) => {
                    const isChecked = docForm.mapped_org_types?.includes(org.item_name);
                    return (
                      <button
                        type="button"
                        key={org.id}
                        onClick={() => toggleArrayItem("mapped_org_types", org.item_name)}
                        className={`p-1.5 rounded-md border text-[11px] font-bold text-left truncate transition ${
                          isChecked
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {org.item_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDocModal({ open: false, isEdit: false, docId: null })}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-xs"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {docModal.isEdit ? "Update Document" : "Save Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: ADD / EDIT SECTION */}
      {sectionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                {sectionModal.isEdit ? "Rename Document Section" : "Add New Document Section"}
              </h3>
              <button onClick={() => setSectionModal({ open: false, isEdit: false, sectionId: null, name: "" })}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Section Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vendor Contracts, Audit Evidence"
                  value={sectionModal.name}
                  onChange={(e) => setSectionModal({ ...sectionModal, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSectionModal({ open: false, isEdit: false, sectionId: null, name: "" })}
                  className="bg-slate-100 px-3 py-1.5 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-bold flex items-center gap-1"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {sectionModal.isEdit ? "Update Section" : "Create Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}