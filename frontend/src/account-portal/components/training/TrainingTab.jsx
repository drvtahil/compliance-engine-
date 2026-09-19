import React, { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, ChevronLeft, ChevronRight, ChevronDown, Lock, CheckCircle2, Circle, PlayCircle, AlertCircle,
  Video, FileText, Presentation, Loader2, Music, FileSpreadsheet, Image, File as FileIcon, ClipboardList
} from "lucide-react";
import { fetchMyCoursesApi, fetchMyCourseDetailApi, markContentCompleteApi, fetchContentBlobUrl } from "../../services/trainingApi";
import AssignmentPlayer from "./AssignmentPlayer";
import AssignmentResultsLog from "./AssignmentResultsLog";
import { ScorePill } from "./assignmentUtils.jsx";

// Mirrors the Super Admin builder's icon logic: file_type (the real
// extension) is authoritative when a file was uploaded; content_type (the
// Master Registry label) is the fallback for external-URL items.
const VIDEO_EXTS = ["mp4", "mov", "avi", "mkv", "webm", "m4v"];
const AUDIO_EXTS = ["mp3", "wav", "m4a", "ogg", "aac"];

function getContentIcon(item) {
  const ext = (item.file_type || "").toLowerCase();
  const type = (item.content_type || "").toLowerCase();

  // The real file extension is authoritative when present - a mislabeled
  // content_type must never override what the uploaded file actually is.
  if (ext) {
    if (VIDEO_EXTS.includes(ext)) return Video;
    if (AUDIO_EXTS.includes(ext)) return Music;
    if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
    if (["ppt", "pptx"].includes(ext)) return Presentation;
    if (["doc", "docx"].includes(ext)) return FileText;
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext)) return Image;
    if (ext === "pdf") return FileText;
  }

  if (type.includes("video")) return Video;
  if (type.includes("audio")) return Music;
  if (type.includes("excel") || type.includes("spreadsheet")) return FileSpreadsheet;
  if (type.includes("powerpoint") || type.includes("slide")) return Presentation;
  if (type.includes("word")) return FileText;
  if (type.includes("image")) return Image;
  if (type.includes("pdf")) return FileText;
  return FileIcon;
}

function isVideoContent(item) {
  const ext = (item.file_type || "").toLowerCase();
  if (ext) return VIDEO_EXTS.includes(ext);
  return (item.content_type || "").toLowerCase().includes("video");
}

function isAudioContent(item) {
  const ext = (item.file_type || "").toLowerCase();
  if (ext) return AUDIO_EXTS.includes(ext);
  return (item.content_type || "").toLowerCase().includes("audio");
}

function getCourseStatus(c) {
  if (c.completed_count === 0) {
    return { label: "Not Started", icon: Circle, badge: "bg-slate-100 text-slate-600 border-slate-200", bar: "bg-slate-300" };
  }
  if (c.completed_count < c.content_count) {
    return { label: "In Progress", icon: PlayCircle, badge: "bg-blue-50 text-blue-700 border-blue-200", bar: "bg-blue-600" };
  }
  if (c.has_test_required) {
    return { label: "Test Pending", icon: AlertCircle, badge: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500" };
  }
  return { label: "Completed", icon: CheckCircle2, badge: "bg-green-50 text-green-700 border-green-200", bar: "bg-green-600" };
}

export default function TrainingTab() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedAct, setSelectedAct] = useState("");
  const [view, setView] = useState("courses"); // courses | results

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyCoursesApi();
      setCourses(data);
      setSelectedAct((prev) => {
        if (prev && data.some((c) => c.act_code === prev)) return prev;
        return data[0]?.act_code || "";
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  if (selectedCourseId) {
    return <CoursePlayer courseId={selectedCourseId} onBack={() => { setSelectedCourseId(null); loadCourses(); }} />;
  }

  const actCodes = [...new Set(courses.map((c) => c.act_code))];
  const coursesForAct = courses.filter((c) => c.act_code === selectedAct);

  const summary = coursesForAct.reduce(
    (acc, c) => {
      const s = getCourseStatus(c).label;
      if (s === "Completed") acc.completed++;
      else if (s === "Test Pending") acc.testPending++;
      else if (s === "In Progress") acc.inProgress++;
      else acc.notStarted++;
      return acc;
    },
    { completed: 0, testPending: 0, inProgress: 0, notStarted: 0 }
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">My Training</h2>
        </div>
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          {[["courses", "My Courses"], ["results", "My Results"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold ${view === key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "courses" && actCodes.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500">Act:</label>
            <select
              value={selectedAct}
              onChange={(e) => setSelectedAct(e.target.value)}
              className="border border-slate-300 rounded-lg text-sm px-3 py-1.5"
            >
              {actCodes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded">{error}</div>}

      {view === "results" ? (
        <AssignmentResultsLog />
      ) : loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-16 border border-dashed border-slate-200 rounded-xl">
          No training courses assigned to you yet.
        </div>
      ) : coursesForAct.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-16 border border-dashed border-slate-200 rounded-xl">
          No training courses under this Act.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryTile label="Not Started" value={summary.notStarted} color="text-slate-600" />
            <SummaryTile label="In Progress" value={summary.inProgress} color="text-blue-600" />
            <SummaryTile label="Test Pending" value={summary.testPending} color="text-amber-600" />
            <SummaryTile label="Completed" value={summary.completed} color="text-green-600" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {coursesForAct.map((c) => {
              const status = getCourseStatus(c);
              const StatusIcon = status.icon;
              const actionLabel = c.completed_count === 0 ? "Start Training"
                : c.completed_count < c.content_count ? "Continue"
                : "Review";
              return (
                <div key={c.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-800">{c.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 flex-shrink-0 ${status.badge}`}>
                        <StatusIcon className="w-3 h-3" /> {status.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{c.description || "No description."}</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-xs">
                        <div className={`h-1.5 rounded-full transition-all ${status.bar}`} style={{ width: `${c.progress_percent}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 flex-shrink-0">
                        {c.completed_count}/{c.content_count} sections &middot; {c.progress_percent}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCourseId(c.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3.5 py-2 rounded-lg hover:bg-blue-700"
                  >
                    {actionLabel} <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10.5px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function CoursePlayer({ courseId, onBack }) {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedContentId, setSelectedContentId] = useState(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState(new Set());
  const [marking, setMarking] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null); // null | { assignmentId, moduleName }

  const toggleModule = (moduleId) => {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const selectContent = (moduleId, contentId) => {
    setActiveAssignment(null);
    setSelectedModuleId(moduleId);
    setSelectedContentId(contentId);
    setExpandedModuleIds((prev) => new Set(prev).add(moduleId));
  };

  const load = useCallback(async () => {
    try {
      const data = await fetchMyCourseDetailApi(courseId);
      setCourse(data);
      if (!selectedModuleId && data.modules.length) {
        const firstId = data.modules[0].id;
        setSelectedModuleId(firstId);
        setSelectedContentId(data.modules[0].content_items[0]?.id || null);
        setExpandedModuleIds(new Set([firstId]));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (contentId) => {
    setMarking(true);
    try {
      await markContentCompleteApi(contentId);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setMarking(false);
    }
  };

  if (loading || !course) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  const selectedModule = course.modules.find((m) => m.id === selectedModuleId);
  const selectedContent = selectedModule?.content_items.find((ci) => ci.id === selectedContentId);

  const allContent = course.modules.flatMap((m) => m.content_items);
  const totalCount = allContent.length;
  const completedCount = allContent.filter((ci) => ci.is_completed).length;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
        <ChevronLeft className="w-3.5 h-3.5" /> Back to My Training
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800">{course.name}</h2>
            <div className="text-xs text-slate-500 mt-0.5">{course.description}</div>
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-sm">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 flex-shrink-0">
                {completedCount}/{totalCount} sections &middot; {progressPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded">{error}</div>}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {sidebarCollapsed ? (
          <div className="w-full lg:w-14 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-2 flex lg:flex-col items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Show modules"
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-full h-px lg:h-px bg-slate-100 hidden lg:block" />
            {course.modules.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSidebarCollapsed(false); toggleModule(m.id); }}
                title={m.module_name}
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                  m.is_complete ? "bg-green-100 text-green-700" :
                  selectedModuleId === m.id ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {m.is_complete ? <CheckCircle2 className="w-4 h-4" /> : m.sequence_order}
              </button>
            ))}
          </div>
        ) : (
          <div className="w-full lg:w-72 flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Modules</span>
              <button
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse modules"
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
              >
                <ChevronLeft className="w-3 h-3" /> Collapse
              </button>
            </div>
            {course.modules.map((m) => {
              const isExpanded = expandedModuleIds.has(m.id);
              const moduleContentCount = m.content_items.length;
              const moduleCompletedCount = m.content_items.filter((ci) => ci.is_completed).length;
              return (
                <div
                  key={m.id}
                  className={`bg-white border rounded-lg overflow-hidden transition-colors ${
                    m.is_complete ? "border-green-200" : "border-slate-200"
                  }`}
                >
                  <button
                    onClick={() => toggleModule(m.id)}
                    className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                        m.is_complete ? "bg-green-100 text-green-700" : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {m.is_complete ? <CheckCircle2 className="w-3.5 h-3.5" /> : m.sequence_order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9.5px] font-bold text-blue-600 uppercase tracking-wide">Module {m.sequence_order}</div>
                      <div className="text-[12px] font-bold text-slate-800 leading-snug">{m.module_name}</div>
                      <div className="text-[9.5px] text-slate-400 mt-0.5">{moduleCompletedCount}/{moduleContentCount} sections completed</div>
                      {(m.department_name || m.process_name || m.chapter || m.rules) && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {m.department_name && (
                            <span className="text-[8.5px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{m.department_name}</span>
                          )}
                          {m.process_name && (
                            <span className="text-[8.5px] font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">{m.process_name}</span>
                          )}
                          {m.chapter && (
                            <span className="text-[8.5px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">{m.chapter}</span>
                          )}
                          {m.rules && (
                            <span className="text-[8.5px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{m.rules}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-1.5 space-y-0.5">
                      {m.content_items.map((ci, idx) => {
                        const Icon = getContentIcon(ci);
                        const isActive = selectedContentId === ci.id;
                        return (
                          <button
                            key={ci.id}
                            disabled={!ci.is_unlocked}
                            onClick={() => selectContent(m.id, ci.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-md text-[11.5px] flex items-center gap-2 transition-colors ${
                              isActive ? "bg-white shadow-sm font-bold text-slate-800 ring-1 ring-blue-100" :
                              ci.is_unlocked ? "text-slate-600 hover:bg-white" : "text-slate-300 cursor-not-allowed"
                            }`}
                          >
                            <span className={`text-[9.5px] font-bold flex-shrink-0 w-14 whitespace-nowrap ${isActive ? "text-blue-600" : "text-slate-400"}`}>
                              Section {idx + 1}
                            </span>
                            {ci.is_completed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" /> :
                             ci.is_unlocked ? <Circle className="w-3.5 h-3.5 flex-shrink-0" /> :
                             <Lock className="w-3.5 h-3.5 flex-shrink-0" />}
                            <Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                            <span className="leading-snug">{ci.title}</span>
                          </button>
                        );
                      })}
                      {m.assignments.map((a) => {
                        const isActive = activeAssignment?.assignmentId === a.id;
                        const label = a.has_in_progress ? "Continue Assignment" : a.attempt_count > 0 ? "Retake Assignment" : "Take Assignment";
                        return (
                          <div key={a.id} className={`mt-1 rounded-md border px-2.5 py-2 ${isActive ? "border-blue-300 bg-white" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700">
                              <ClipboardList className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                              <span className="flex-1 leading-snug">{a.title}</span>
                              <ScorePill percent={a.latest_score_percent} />
                            </div>
                            <button
                              disabled={!m.is_complete}
                              onClick={() => { setSelectedModuleId(m.id); setActiveAssignment({ assignmentId: a.id, moduleName: `Module ${m.sequence_order} · ${m.module_name}` }); }}
                              className={`mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-md ${
                                m.is_complete ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                              {!m.is_complete && <Lock className="w-3 h-3" />}
                              {m.is_complete ? label : "Complete all sections to unlock"}
                            </button>
                            {a.attempt_count > 0 && <div className="text-[9.5px] text-slate-400 mt-1">{a.attempt_count} {a.attempt_count === 1 ? "attempt" : "attempts"} &middot; latest score shown</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl p-5">
          {activeAssignment ? (
            <AssignmentPlayer
              assignmentId={activeAssignment.assignmentId}
              moduleName={activeAssignment.moduleName}
              onExit={() => { setActiveAssignment(null); load(); }}
              onSubmitted={load}
            />
          ) : (
          <>
          {selectedContent && selectedModule && (
            <div className="text-[11px] font-semibold text-slate-400 mb-3">
              Module {selectedModule.sequence_order} &middot; {selectedModule.module_name}
              <span className="text-slate-300"> &nbsp;/&nbsp; </span>
              <span className="text-slate-500">
                Section {selectedModule.content_items.findIndex((ci) => ci.id === selectedContent.id) + 1}
              </span>
            </div>
          )}
          {!selectedContent ? (
            <div className="text-center text-sm text-slate-400 py-12">Select a section to view.</div>
          ) : (
            <ContentViewer
              content={selectedContent}
              sectionNumber={selectedModule.content_items.findIndex((ci) => ci.id === selectedContent.id) + 1}
              onComplete={() => handleComplete(selectedContent.id)}
              marking={marking}
            />
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

// Browser-native PDF/Office iframe viewers don't expose scroll or page
// position to our JS (they're not a webpage we control), so real
// "reached the last page" detection isn't reliable there. This minimum
// review time is a practical stand-in for that content; video/audio use
// the real "played to the end" event instead, which IS fully reliable.
const MIN_REVIEW_SECONDS = 8;

function ContentViewer({ content, sectionNumber, onComplete, marking }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [mediaEnded, setMediaEnded] = useState(false);
  const [dwellSecondsLeft, setDwellSecondsLeft] = useState(MIN_REVIEW_SECONDS);

  const isMedia = isVideoContent(content) || isAudioContent(content);

  useEffect(() => {
    setBlobUrl(null);
    setLoadError("");
    setMediaEnded(false);
    if (content.source_type !== "upload") return;

    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        objectUrl = await fetchContentBlobUrl(content.id);
        if (!cancelled) setBlobUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [content.id, content.source_type]);

  // Minimum review-time countdown for non-media (PDF/slide/document) content.
  useEffect(() => {
    if (isMedia || content.is_completed) return;
    setDwellSecondsLeft(MIN_REVIEW_SECONDS);
    const interval = setInterval(() => {
      setDwellSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.id, isMedia, content.is_completed]);

  const fileUrl = content.source_type === "upload" ? blobUrl : content.external_url;
  const canComplete = content.is_completed || (isMedia ? mediaEnded : dwellSecondsLeft <= 0);

  const handleMediaEnded = () => {
    setMediaEnded(true);
    if (!content.is_completed) onComplete();
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10.5px] font-bold text-blue-600 uppercase tracking-wide">Section {sectionNumber}</div>
        <div className="font-bold text-base text-slate-800">{content.title}</div>
        {content.description && (
          <div className="text-xs text-slate-500 mt-1 leading-relaxed">{content.description}</div>
        )}
      </div>

      {content.source_type === "upload" && !fileUrl && !loadError ? (
        <div className="flex items-center justify-center h-40 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading content...
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">{loadError}</div>
      ) : isVideoContent(content) && content.source_type === "upload" ? (
        <video
          src={fileUrl}
          controls
          controlsList="nodownload"
          className="w-full rounded-lg bg-black max-h-[80vh] min-h-[420px]"
          onEnded={handleMediaEnded}
        />
      ) : isAudioContent(content) && content.source_type === "upload" ? (
        <audio src={fileUrl} controls controlsList="nodownload" className="w-full" onEnded={handleMediaEnded} />
      ) : (
        <iframe src={fileUrl} title={content.title} className="w-full h-[80vh] rounded-lg border border-slate-200" />
      )}

      {content.is_completed ? (
        <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
          <CheckCircle2 className="w-4 h-4" /> Completed
        </div>
      ) : (
        <div className="space-y-1.5">
          <button
            onClick={onComplete}
            disabled={marking || !canComplete}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {marking && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Mark as Complete
          </button>
          {!canComplete && (
            <div className="text-[11px] text-slate-400">
              {isMedia ? "Play through to the end to unlock this." : `Please review the content - unlocks in ${dwellSecondsLeft}s.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
