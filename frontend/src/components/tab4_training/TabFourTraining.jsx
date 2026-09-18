import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  GraduationCap, PlusCircle, Edit2, Trash2, Archive, UploadCloud, Download,
  Loader2, ChevronLeft, Video, FileText, Presentation, Link2, Music, FileSpreadsheet, Image, File as FileIcon,
  Eye, Users, History, Layers, GripVertical, X, Copy, Send, EyeOff,
  ChevronUp, ChevronDown, ChevronsUpDown, LayoutDashboard
} from "lucide-react";
import { fetchTab1BootstrapApi } from "../../services/tab1Api";
import {
  fetchRolesApi, fetchContentTypesApi, fetchCoursesApi, createCourseApi, getCourseApi, updateCourseApi,
  deleteCourseApi, archiveCourseApi, publishCourseApi, unpublishCourseApi, previewCourseApi,
  createModuleApi, updateModuleApi, deleteModuleApi, duplicateModuleApi, reorderModulesApi,
  createContentItemApi, updateContentItemApi, deleteContentItemApi, reorderContentItemsApi,
  viewContentFile, listAllocationsApi, createAllocationApi, deleteAllocationApi,
  bulkAllocateCsvApi, getAuditLogApi
} from "../../services/tab4TrainingApi";
import {
  fetchDashboardSummaryApi, fetchDashboardAccountsApi, fetchDashboardCoursesApi,
  fetchDashboardCourseModulesApi, fetchDashboardRecordsApi
} from "../../services/tab4DashboardApi";
import TrainingDashboardView from "../../shared/TrainingDashboardView";

// File type is the authoritative signal when a real file was uploaded (exact
// extension); content_type (from the Master Registry list) is the fallback
// for external-URL items, which have no file extension of their own.
function getContentIcon(item) {
  const ext = (item.file_type || "").toLowerCase();
  const type = (item.content_type || "").toLowerCase();

  // The real file extension is authoritative when present - a mislabeled
  // content_type (e.g. "Video" picked for an actually-audio upload) must
  // never override what the uploaded file actually is.
  if (ext) {
    if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext)) return Video;
    if (["mp3", "wav", "m4a", "ogg", "aac"].includes(ext)) return Music;
    if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
    if (["ppt", "pptx"].includes(ext)) return Presentation;
    if (["doc", "docx"].includes(ext)) return FileText;
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext)) return Image;
    if (ext === "pdf") return FileText;
  }

  // No file extension to go on (external URL) - fall back to the content_type label.
  if (type.includes("video")) return Video;
  if (type.includes("audio")) return Music;
  if (type.includes("excel") || type.includes("spreadsheet")) return FileSpreadsheet;
  if (type.includes("powerpoint") || type.includes("slide")) return Presentation;
  if (type.includes("word")) return FileText;
  if (type.includes("image")) return Image;
  if (type.includes("pdf")) return FileText;
  return FileIcon;
}

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  published: "bg-green-50 text-green-700 border-green-200",
  archived: "bg-amber-50 text-amber-700 border-amber-200",
};

function useSortedList(items, defaultKey, defaultDir = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av == null && bv == null) return 0;
      if (av == null) return sortDir === "asc" ? -1 : 1;
      if (bv == null) return sortDir === "asc" ? 1 : -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  return { sorted, sortKey, sortDir, toggleSort };
}

function SortableTh({ label, sortKeyName, currentKey, currentDir, onSort, className = "" }) {
  const active = sortKeyName === currentKey;
  return (
    <th
      onClick={() => onSort(sortKeyName)}
      className={`py-1.5 font-semibold text-left cursor-pointer select-none hover:text-slate-700 ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          currentDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 text-slate-300" />
        )}
      </span>
    </th>
  );
}

function ViewModeToggle({ viewMode, setViewMode }) {
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
      <button
        onClick={() => setViewMode("courses")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${viewMode === "courses" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
      >
        <GraduationCap className="w-3.5 h-3.5" /> Courses
      </button>
      <button
        onClick={() => setViewMode("dashboard")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${viewMode === "dashboard" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
      >
        <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
      </button>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {status}
    </span>
  );
}

export default function TabFourTraining() {
  const [viewMode, setViewMode] = useState("courses"); // courses | dashboard
  const [registries, setRegistries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedAct, setSelectedAct] = useState("");
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [subTab, setSubTab] = useState("builder"); // builder | allocations | audit

  const [selectedModuleId, setSelectedModuleId] = useState(null);

  const [courseModal, setCourseModal] = useState(null); // null | { editing: course|null }
  const [moduleModal, setModuleModal] = useState(null); // null | { editing: module|null }
  const [contentModal, setContentModal] = useState(null); // null | { editing: item|null }
  const [allocationModal, setAllocationModal] = useState(false);
  const [allocationRefreshKey, setAllocationRefreshKey] = useState(0);
  const [previewData, setPreviewData] = useState(null);

  const actsList = registries.find((r) => r.registry_key === "acts")?.items || [];
  const departmentList = registries.find((r) => r.registry_key === "industries")?.items || [];
  const processList = registries.find((r) => r.registry_key === "industry_processes")?.items || [];

  useEffect(() => {
    (async () => {
      try {
        const [bootstrap, rolesData, contentTypesData] = await Promise.all([fetchTab1BootstrapApi(), fetchRolesApi(), fetchContentTypesApi()]);
        setRegistries(bootstrap.registries || []);
        setAccounts(bootstrap.accounts || []);
        setRoles(rolesData || []);
        setContentTypes(contentTypesData || []);
        const firstAct = (bootstrap.registries || []).find((r) => r.registry_key === "acts")?.items?.[0]?.item_name;
        if (firstAct) setSelectedAct(firstAct);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadCourses = useCallback(async (actCode) => {
    if (!actCode) return;
    setCoursesLoading(true);
    try {
      setCourses(await fetchCoursesApi(actCode));
    } catch (e) {
      setError(e.message);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAct) loadCourses(selectedAct);
  }, [selectedAct, loadCourses]);

  const loadCourse = useCallback(async (id) => {
    setCourseLoading(true);
    try {
      const data = await getCourseApi(id);
      setCourse(data);
      if (!selectedModuleId && data.modules?.length) setSelectedModuleId(data.modules[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setCourseLoading(false);
    }
  }, [selectedModuleId]);

  useEffect(() => {
    if (selectedCourseId) loadCourse(selectedCourseId);
  }, [selectedCourseId, loadCourse]);

  const refreshCourse = () => selectedCourseId && loadCourse(selectedCourseId);
  const refreshCourses = () => loadCourses(selectedAct);

  const openCourse = (id) => {
    setSelectedCourseId(id);
    setSelectedModuleId(null);
    setSubTab("builder");
  };

  const backToList = () => {
    setSelectedCourseId(null);
    setCourse(null);
    refreshCourses();
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  if (viewMode === "dashboard") {
    return (
      <div>
        <div className="p-6 pb-0 max-w-7xl mx-auto flex justify-end">
          <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
        <TrainingDashboardView
          scope="super_admin"
          title="Training Dashboard"
          api={{
            fetchSummary: fetchDashboardSummaryApi,
            fetchAccounts: fetchDashboardAccountsApi,
            fetchCourses: fetchDashboardCoursesApi,
            fetchCourseModules: fetchDashboardCourseModulesApi,
            fetchRecords: fetchDashboardRecordsApi,
          }}
          departmentList={departmentList}
          processList={processList}
          roles={roles}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {!selectedCourseId ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">Training - Course Builder</h2>
            </div>
            <div className="flex items-center gap-2">
              <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
              <button
                onClick={() => setCourseModal({ editing: null })}
                className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700"
              >
                <PlusCircle className="w-4 h-4" /> New Course
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500">Act:</label>
            <select
              value={selectedAct}
              onChange={(e) => setSelectedAct(e.target.value)}
              className="border border-slate-300 rounded-lg text-sm px-3 py-1.5"
            >
              {actsList.map((a) => (
                <option key={a.id} value={a.item_name}>{a.item_name}</option>
              ))}
            </select>
          </div>

          {coursesLoading ? (
            <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>
          ) : courses.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-16 border border-dashed border-slate-200 rounded-xl">
              No courses under this Act yet.
            </div>
          ) : (
            <CourseListTable
              courses={courses}
              onView={openCourse}
              onEdit={(c) => setCourseModal({ editing: c })}
              onPublish={(id) => publishCourseApi(id).then(refreshCourses).catch((e) => setError(e.message))}
              onUnpublish={(id) => unpublishCourseApi(id).then(refreshCourses).catch((e) => setError(e.message))}
              onArchive={(id) => archiveCourseApi(id).then(refreshCourses).catch((e) => setError(e.message))}
              onDelete={async (id, name) => {
                if (!window.confirm(`Delete course "${name}"? This cannot be undone.`)) return;
                try { await deleteCourseApi(id); refreshCourses(); } catch (e) { setError(e.message); }
              }}
            />
          )}
        </>
      ) : (
        <CourseDetail
          course={course}
          loading={courseLoading}
          subTab={subTab}
          setSubTab={setSubTab}
          selectedModuleId={selectedModuleId}
          setSelectedModuleId={setSelectedModuleId}
          departmentList={departmentList}
          processList={processList}
          accounts={accounts}
          roles={roles}
          onBack={backToList}
          onRefresh={refreshCourse}
          onEditCourse={() => setCourseModal({ editing: course })}
          onOpenModuleModal={(editing) => setModuleModal({ editing })}
          onOpenContentModal={(editing) => setContentModal({ editing })}
          onOpenAllocationModal={() => setAllocationModal(true)}
          allocationRefreshKey={allocationRefreshKey}
          onPreview={async () => setPreviewData(await previewCourseApi(course.id))}
          setError={setError}
        />
      )}

      {courseModal && (
        <CourseFormModal
          editing={courseModal.editing}
          actsList={actsList}
          defaultAct={selectedAct}
          onClose={() => setCourseModal(null)}
          onSaved={() => { setCourseModal(null); refreshCourses(); refreshCourse(); }}
          setError={setError}
        />
      )}

      {moduleModal && course && (
        <ModuleFormModal
          courseId={course.id}
          editing={moduleModal.editing}
          departmentList={departmentList}
          processList={processList}
          onClose={() => setModuleModal(null)}
          onSaved={(mod) => { setModuleModal(null); refreshCourse(); setSelectedModuleId(mod.id); }}
          setError={setError}
        />
      )}

      {contentModal && selectedModuleId && (
        <ContentFormModal
          moduleId={selectedModuleId}
          editing={contentModal.editing}
          contentTypes={contentTypes}
          onClose={() => setContentModal(null)}
          onSaved={() => { setContentModal(null); refreshCourse(); }}
          setError={setError}
        />
      )}

      {allocationModal && course && (
        <AllocationModal
          courseId={course.id}
          courseActCode={course.act_code}
          accounts={accounts}
          allAccountsCount={accounts.length}
          roles={roles.filter((r) => !course.default_roles.length || course.default_roles.includes(r.role_name))}
          onClose={() => setAllocationModal(false)}
          onSaved={() => { setAllocationModal(false); setAllocationRefreshKey((k) => k + 1); }}
          setError={setError}
        />
      )}

      {previewData && <PreviewModal data={previewData} onClose={() => setPreviewData(null)} />}
    </div>
  );
}

function CourseListTable({ courses, onView, onEdit, onPublish, onUnpublish, onArchive, onDelete }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortedList(courses, "name");

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-slate-500">
            <SortableTh label="Course Name" sortKeyName="name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="pl-4" />
            <SortableTh label="Act" sortKeyName="act_code" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
            <th className="py-1.5 font-semibold text-left">Description</th>
            <th className="py-1.5 font-semibold text-left">Default Roles</th>
            <SortableTh label="Modules" sortKeyName="module_count" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Status" sortKeyName="status" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
            <th className="py-1.5 font-semibold text-right pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="py-2.5 pl-4 font-bold text-slate-800">{c.name}</td>
              <td className="py-2.5 text-slate-500">{c.act_code}</td>
              <td className="py-2.5 text-slate-500 max-w-xs truncate">{c.description || "-"}</td>
              <td className="py-2.5 text-slate-500">{c.default_roles.join(", ") || "-"}</td>
              <td className="py-2.5 text-slate-500 flex items-center gap-1"><Layers className="w-3 h-3" /> {c.module_count}</td>
              <td className="py-2.5"><StatusBadge status={c.status} /></td>
              <td className="py-2.5 pr-4">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onView(c.id)} title="View Details" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"><Eye className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onEdit(c)} title="Edit" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"><Edit2 className="w-3.5 h-3.5" /></button>
                  {c.status === "published" ? (
                    <button onClick={() => onUnpublish(c.id)} title="Unpublish" className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50"><EyeOff className="w-3.5 h-3.5" /></button>
                  ) : (
                    <button onClick={() => onPublish(c.id)} title="Publish" className="p-1.5 rounded-md text-green-600 hover:bg-green-50"><Send className="w-3.5 h-3.5" /></button>
                  )}
                  <button onClick={() => onArchive(c.id)} title="Archive" className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50"><Archive className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(c.id, c.name)} title="Delete" className="p-1.5 rounded-md text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseDetail({
  course, loading, subTab, setSubTab, selectedModuleId, setSelectedModuleId,
  departmentList, processList, accounts, roles, onBack, onRefresh,
  onEditCourse, onOpenModuleModal, onOpenContentModal, onOpenAllocationModal, allocationRefreshKey, onPreview, setError
}) {
  if (loading || !course) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  const selectedModule = course.modules.find((m) => m.id === selectedModuleId);

  const doAction = async (fn) => {
    try {
      await fn();
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteCourse = async () => {
    if (!window.confirm(`Delete course "${course.name}"? This cannot be undone.`)) return;
    try {
      await deleteCourseApi(course.id);
      onBack();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteModule = async (id) => {
    if (!window.confirm("Delete this module and all its content?")) return;
    doAction(() => deleteModuleApi(id));
  };

  const handleDeleteContent = async (id) => {
    if (!window.confirm("Delete this content item?")) return;
    doAction(() => deleteContentItemApi(id));
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
        <ChevronLeft className="w-3.5 h-3.5" /> Back to Courses
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-slate-800">{course.name}</h2>
            <StatusBadge status={course.status} />
          </div>
          <div className="text-xs text-slate-500">{course.act_code} &middot; {course.description || "No description."}</div>
          <div className="text-[11px] text-slate-400 mt-1">Default roles: {course.default_roles.join(", ") || "None"}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onPreview} title="Preview" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Eye className="w-4 h-4" /></button>
          <button onClick={onEditCourse} title="Edit" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Edit2 className="w-4 h-4" /></button>
          {course.status === "published" ? (
            <button onClick={() => doAction(() => unpublishCourseApi(course.id))} title="Unpublish" className="p-2 rounded-lg text-amber-600 hover:bg-amber-50"><EyeOff className="w-4 h-4" /></button>
          ) : (
            <button onClick={() => doAction(() => publishCourseApi(course.id))} title="Publish" className="p-2 rounded-lg text-green-600 hover:bg-green-50"><Send className="w-4 h-4" /></button>
          )}
          <button onClick={() => doAction(() => archiveCourseApi(course.id))} title="Archive" className="p-2 rounded-lg text-amber-600 hover:bg-amber-50"><Archive className="w-4 h-4" /></button>
          <button onClick={handleDeleteCourse} title="Delete" className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "builder", label: "Modules & Content", icon: Layers },
          { key: "allocations", label: "Allocations", icon: Users },
          { key: "audit", label: "Audit Log", icon: History },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 ${
              subTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {subTab === "builder" && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="w-full lg:w-64 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-2 space-y-1">
            {course.modules.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModuleId(m.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between ${
                  selectedModuleId === m.id ? "bg-blue-50 text-blue-700 border-l-2 border-blue-600" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{m.sequence_order}. {m.module_name}</span>
                <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">{m.content_items.length}</span>
              </button>
            ))}
            <button
              onClick={() => onOpenModuleModal(null)}
              className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Module
            </button>
          </div>

          <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl p-4">
            {!selectedModule ? (
              <div className="text-center text-sm text-slate-400 py-12">Select or create a module to manage its content.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-800">{selectedModule.module_name}</div>
                    <div className="text-xs text-slate-500">{selectedModule.short_description}</div>
                    <div className="flex items-center flex-wrap gap-1 mt-1.5">
                      {selectedModule.department_name && (
                        <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{selectedModule.department_name}</span>
                      )}
                      {selectedModule.process_name && (
                        <span className="text-[9px] font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">{selectedModule.process_name}</span>
                      )}
                      {selectedModule.chapter && (
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">{selectedModule.chapter}</span>
                      )}
                      {selectedModule.rules && (
                        <span className="text-[9px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{selectedModule.rules}</span>
                      )}
                      <span className="text-[9px] font-semibold text-slate-400">Test required: {selectedModule.test_required ? "Yes" : "No"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onOpenModuleModal(selectedModule)} title="Edit module" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => doAction(() => duplicateModuleApi(selectedModule.id))} title="Duplicate module" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteModule(selectedModule.id)} title="Delete module" className="p-1.5 rounded-md text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {selectedModule.content_items.map((ci) => {
                    const Icon = getContentIcon(ci);
                    return (
                      <div key={ci.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-700 truncate">{ci.title}</div>
                          {ci.description && (
                            <div className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">{ci.description}</div>
                          )}
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            {ci.source_type === "external_url" ? (
                              <><Link2 className="w-2.5 h-2.5" /> External link</>
                            ) : (
                              ci.file_name
                            )}
                          </div>
                        </div>
                        {ci.source_type === "upload" && (
                          <button onClick={() => viewContentFile(ci.id)} title="View" className="p-1 rounded text-slate-400 hover:text-slate-700"><Eye className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => onOpenContentModal(ci)} title="Edit" className="p-1 rounded text-slate-400 hover:text-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteContent(ci.id)} title="Delete" className="p-1 rounded text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => onOpenContentModal(null)}
                  className="w-full flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded-lg py-2 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Content Item
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "allocations" && (
        <AllocationsPanel courseId={course.id} accounts={accounts} roles={roles} onOpenAllocationModal={onOpenAllocationModal} refreshKey={allocationRefreshKey} setError={setError} />
      )}

      {subTab === "audit" && <AuditLogPanel entityType="course" entityId={course.id} setError={setError} />}
    </div>
  );
}

function CourseFormModal({ editing, actsList, defaultAct, onClose, onSaved, setError }) {
  const [actCode, setActCode] = useState(editing?.act_code || defaultAct || actsList[0]?.item_name || "");
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [roleAccountAdmin, setRoleAccountAdmin] = useState(editing ? editing.default_roles.includes("Account Admin") : true);
  const [roleUser, setRoleUser] = useState(editing ? editing.default_roles.includes("User") : true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return setError("Course name is required.");
    setSaving(true);
    try {
      const default_roles = [...(roleAccountAdmin ? ["Account Admin"] : []), ...(roleUser ? ["User"] : [])];
      const payload = { act_code: actCode, name, description, default_roles };
      if (editing) await updateCourseApi(editing.id, payload);
      else await createCourseApi(payload);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={editing ? "Edit Course" : "New Course"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Act">
          <select value={actCode} onChange={(e) => setActCode(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2">
            {actsList.map((a) => <option key={a.id} value={a.item_name}>{a.item_name}</option>)}
          </select>
        </Field>
        <Field label="Course Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" placeholder="e.g. Data Processor Training" />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" />
        </Field>
        <Field label="Default applicable roles">
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={roleAccountAdmin} onChange={(e) => setRoleAccountAdmin(e.target.checked)} /> Account Admin</label>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={roleUser} onChange={(e) => setRoleUser(e.target.checked)} /> User</label>
          </div>
        </Field>
      </div>
      <ModalFooter onClose={onClose} onSubmit={submit} saving={saving} label={editing ? "Save Changes" : "Create Course"} />
    </ModalShell>
  );
}

function ModuleFormModal({ courseId, editing, departmentList, processList, onClose, onSaved, setError }) {
  const [moduleName, setModuleName] = useState(editing?.module_name || "");
  const [shortDescription, setShortDescription] = useState(editing?.short_description || "");
  const [departmentItemId, setDepartmentItemId] = useState(editing?.department_item_id || "");
  const [processItemId, setProcessItemId] = useState(editing?.process_item_id || "");
  const [chapter, setChapter] = useState(editing?.chapter || "");
  const [rules, setRules] = useState(editing?.rules || "");
  const [testRequired, setTestRequired] = useState(editing?.test_required || false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!moduleName.trim()) return setError("Module name is required.");
    setSaving(true);
    try {
      const payload = {
        module_name: moduleName,
        short_description: shortDescription,
        department_item_id: departmentItemId ? Number(departmentItemId) : null,
        process_item_id: processItemId ? Number(processItemId) : null,
        chapter,
        rules,
        test_required: testRequired,
      };
      const result = editing ? await updateModuleApi(editing.id, payload) : await createModuleApi(courseId, payload);
      onSaved(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={editing ? "Edit Module" : "New Module"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Module Name">
          <input value={moduleName} onChange={(e) => setModuleName(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" placeholder="e.g. Consent & Data Principal Rights" />
        </Field>
        <Field label="Short Description">
          <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <select value={departmentItemId} onChange={(e) => setDepartmentItemId(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2">
              <option value="">None</option>
              {departmentList.map((d) => <option key={d.id} value={d.id}>{d.item_name}</option>)}
            </select>
          </Field>
          <Field label="Process">
            <select value={processItemId} onChange={(e) => setProcessItemId(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2">
              <option value="">None</option>
              {processList.map((p) => <option key={p.id} value={p.id}>{p.item_name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chapter (optional)">
            <input value={chapter} onChange={(e) => setChapter(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" placeholder="e.g. Chapter III" />
          </Field>
          <Field label="Rules (optional)">
            <input value={rules} onChange={(e) => setRules(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" placeholder="e.g. Rule 5, 7" />
          </Field>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={testRequired} onChange={(e) => setTestRequired(e.target.checked)} />
          Require a test after this module (test engine coming in a future feature)
        </label>
      </div>
      <ModalFooter onClose={onClose} onSubmit={submit} saving={saving} label={editing ? "Save Changes" : "Add Module"} />
    </ModalShell>
  );
}

function ContentFormModal({ moduleId, editing, contentTypes, onClose, onSaved, setError }) {
  const [contentType, setContentType] = useState(editing?.content_type || contentTypes[0]?.item_name || "");
  const [title, setTitle] = useState(editing?.title || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [sourceType, setSourceType] = useState(editing?.source_type || "upload");
  const [externalUrl, setExternalUrl] = useState(editing?.external_url || "");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return setError("Content title is required.");
    if (sourceType === "upload" && !editing && !file) return setError("Please choose a file to upload.");
    if (sourceType === "external_url" && !externalUrl.trim()) return setError("Please enter an external URL.");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("content_type", contentType);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("source_type", sourceType);
      formData.append("external_url", externalUrl);
      if (file) formData.append("file", file);
      if (editing) await updateContentItemApi(editing.id, formData);
      else await createContentItemApi(moduleId, formData);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={editing ? "Edit Content Item" : "Add Content Item"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Content Type">
            <select value={contentType} onChange={(e) => setContentType(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2">
              {contentTypes.map((ct) => <option key={ct.id} value={ct.item_name}>{ct.item_name}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2">
              <option value="upload">Upload File</option>
              <option value="external_url">External URL</option>
            </select>
          </Field>
        </div>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" />
        </Field>
        <Field label="Description (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" placeholder="What does this content cover?" />
        </Field>
        {sourceType === "upload" ? (
          <Field label={editing?.file_name ? `Replace file (current: ${editing.file_name})` : "File"}>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} className="w-full text-xs" />
          </Field>
        ) : (
          <Field label="External URL (e.g. Vimeo private link)">
            <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2" placeholder="https://vimeo.com/..." />
          </Field>
        )}
      </div>
      <ModalFooter onClose={onClose} onSubmit={submit} saving={saving} label={editing ? "Save Changes" : "Add Content"} />
    </ModalShell>
  );
}

function AllocationsPanel({ courseId, accounts, roles, onOpenAllocationModal, refreshKey, setError }) {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [csvBusy, setCsvBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAllocations(await listAllocationsApi(courseId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, setError]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleRemove = async (id) => {
    if (!window.confirm("Remove this allocation?")) return;
    try {
      await deleteAllocationApi(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent = "account_code,role_name\nACC-0001,Account Admin\nACC-0002,User\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "training_allocation_template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCsv = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvBusy(true);
    try {
      const result = await bulkAllocateCsvApi(courseId, file);
      alert(`Created: ${result.created}, Skipped (already allocated): ${result.skipped}, Errors: ${result.errors.length}${result.errors.length ? "\n" + result.errors.join("\n") : ""}`);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setCsvBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-800">Account &amp; Role Allocations</div>
        <div className="flex items-center gap-2">
          <button onClick={downloadCsvTemplate} title="Download a sample CSV to fill in" className="flex items-center gap-1.5 text-xs font-bold text-slate-500 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> Template
          </button>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 border border-slate-300 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-slate-50">
            <UploadCloud className="w-3.5 h-3.5" /> {csvBusy ? "Uploading..." : "Bulk CSV"}
            <input type="file" accept=".csv" onChange={handleCsv} className="hidden" disabled={csvBusy} />
          </label>
          <button onClick={() => onOpenAllocationModal()} className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700">
            <PlusCircle className="w-3.5 h-3.5" /> Allocate
          </button>
        </div>
      </div>
      <div className="text-[10px] text-slate-400">
        CSV columns: <code className="font-mono">account_code</code>, <code className="font-mono">role_name</code> — one row per account + user type (role_name must be exactly "Account Admin" or "User"). Download the template for the exact format.
      </div>

      {loading ? (
        <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>
      ) : allocations.length === 0 ? (
        <div className="text-center text-xs text-slate-400 py-8">No accounts allocated yet.</div>
      ) : (
        <AllocationsTable allocations={allocations} onRemove={handleRemove} />
      )}
    </div>
  );
}

function AllocationsTable({ allocations, onRemove }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortedList(allocations, "account_name");
  return (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <SortableTh label="Account" sortKeyName="account_name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Role" sortKeyName="role_name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Mandatory" sortKeyName="is_mandatory" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Status" sortKeyName="status" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.id} className="border-b border-slate-50">
                <td className="py-1.5 font-semibold text-slate-700">{a.account_name} <span className="text-slate-400">({a.account_code})</span></td>
                <td className="py-1.5">{a.role_name}</td>
                <td className="py-1.5">{a.is_mandatory ? "Yes" : "No"}</td>
                <td className="py-1.5">{a.status}</td>
                <td className="py-1.5 text-right"><button onClick={() => onRemove(a.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
  );
}

function AllocationModal({ courseId, courseActCode, accounts, allAccountsCount, roles, onClose, onSaved, setError }) {
  // An account must already be enrolled in this course's Act (at Tab 1) before
  // it can be allocated training for that Act - same rule Resources already follows.
  const eligibleAccounts = accounts.filter((a) => (a.enrolled_acts || []).includes(courseActCode));
  const [accountId, setAccountId] = useState(eligibleAccounts[0]?.id || "");
  const [roleId, setRoleId] = useState(roles[0]?.id || "");
  const [isMandatory, setIsMandatory] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!accountId || !roleId) return setError("Choose an account and a role.");
    setSaving(true);
    try {
      await createAllocationApi(courseId, { account_id: Number(accountId), role_id: Number(roleId), is_mandatory: isMandatory });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Allocate Course to Account" onClose={onClose}>
      <div className="space-y-3">
        {eligibleAccounts.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg">
            {allAccountsCount === 0
              ? "No accounts exist yet. Register one in Tab 1 first."
              : `No accounts are enrolled in ${courseActCode} yet. Enroll the Act for an account in Tab 1 → Account Registry before allocating this course.`}
          </div>
        ) : (
          <>
            <Field label="Account">
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2">
                {eligibleAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.account_code})</option>)}
              </select>
              <div className="text-[10px] text-slate-400 mt-1">Only accounts enrolled in {courseActCode} are shown.</div>
            </Field>
            <Field label="User Type">
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2">
                {roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} /> Mandatory
            </label>
          </>
        )}
      </div>
      <ModalFooter onClose={onClose} onSubmit={submit} saving={saving || eligibleAccounts.length === 0} label="Allocate" />
    </ModalShell>
  );
}

function AuditLogPanel({ entityType, entityId, setError }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setEntries(await getAuditLogApi(entityType, entityId));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [entityType, entityId, setError]);

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-sm font-bold text-slate-800 mb-3">Audit Log</div>
      {entries.length === 0 ? (
        <div className="text-center text-xs text-slate-400 py-8">No changes logged yet.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="text-xs border-b border-slate-50 pb-2">
              <span className="font-bold text-slate-700 uppercase">{e.action}</span>
              <span className="text-slate-400"> &middot; {e.entity_type} #{e.entity_id} &middot; {new Date(e.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewModal({ data, onClose }) {
  return (
    <ModalShell title={`Preview: ${data.name}`} onClose={onClose} wide>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="text-xs text-slate-500">{data.description}</div>
        {data.modules.map((m) => (
          <div key={m.id} className="border border-slate-200 rounded-lg p-3">
            <div className="font-bold text-sm text-slate-800">{m.sequence_order}. {m.module_name}</div>
            <div className="text-xs text-slate-500 mb-2">{m.short_description}</div>
            <div className="space-y-1">
              {m.content_items.map((ci) => {
                const Icon = getContentIcon(ci);
                return (
                  <div key={ci.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <Icon className="w-3.5 h-3.5 text-slate-400" /> {ci.title}
                  </div>
                );
              })}
            </div>
            {m.test_required && <div className="text-[10px] font-bold text-amber-600 mt-2">Test required after this module</div>}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

// --- Small shared UI primitives ---
function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400 hover:text-slate-700" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onSubmit, saving, label }) {
  return (
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
      <button onClick={onSubmit} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {label}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-slate-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}
