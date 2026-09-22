import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutDashboard, Building2, GraduationCap, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ChevronsUpDown, Loader2, Circle, PlayCircle, CheckCircle2, Layers
} from "lucide-react";

const STATUS_META = {
  not_started: { label: "Not Started", icon: Circle, badge: "bg-slate-100 text-slate-600 border-slate-200" },
  in_progress: { label: "In Progress", icon: PlayCircle, badge: "bg-[#fff1ec] text-[#c8431f] border-[#ffc7ae]" },
  completed: { label: "Completed", icon: CheckCircle2, badge: "bg-green-50 text-green-700 border-green-200" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.not_started;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badge}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function useSortedList(items, defaultKey, defaultDir = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);
  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
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

function Th({ label, sortKeyName, currentKey, currentDir, onSort, className = "" }) {
  const active = sortKeyName === currentKey;
  return (
    <th onClick={() => onSort(sortKeyName)} className={`py-1.5 font-semibold text-left cursor-pointer select-none hover:text-slate-700 ${className}`}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (currentDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronsUpDown className="w-3 h-3 text-slate-300" />}
      </span>
    </th>
  );
}

function Tile({ label, value, color = "text-slate-800" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10.5px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}

/**
 * Shared between the Super Admin training dashboard (all accounts) and the
 * Account Admin team dashboard (their own account only). Which tabs render
 * and what the API functions actually scope to is entirely controlled by
 * the props the parent passes in - this component has no access-control
 * logic of its own, that's enforced server-side.
 */
export default function TrainingDashboardView({
  scope, // "super_admin" | "account_admin"
  title,
  api, // { fetchSummary, fetchAccounts?, fetchCourses, fetchCourseModules, fetchRecords }
  departmentList = [],
  processList = [],
  roles = [],
}) {
  const [tab, setTab] = useState("overview"); // overview | accounts | courses
  // Screens opened by drilling in, oldest first; Back pops one level at a time.
  const [drillStack, setDrillStack] = useState([]);
  const drill = drillStack[drillStack.length - 1] || null; // { type: 'account'|'course'|'module', ...context }
  const setDrill = (d) => setDrillStack([d]);
  const pushDrill = (d) => setDrillStack((s) => [...s, d]);
  const popDrill = () => setDrillStack((s) => s.slice(0, -1));

  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [actTree, setActTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.fetchSummary(),
      api.fetchAccounts ? api.fetchAccounts() : Promise.resolve([]),
      api.fetchCourses(),
      api.fetchActTree ? api.fetchActTree() : Promise.resolve([]),
    ])
      .then(([s, a, c, t]) => { setSummary(s); setAccounts(a); setCourses(c); setActTree(t); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [api]);

  const accountsSort = useSortedList(accounts, "account_name");
  const coursesSort = useSortedList(courses, "course_name");

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#ff5a36]" /></div>;

  if (drill) {
    return (
      <DrillDown
        drill={drill}
        onBack={popDrill}
        onNavigate={pushDrill}
        api={api}
        scope={scope}
        departmentList={departmentList}
        processList={processList}
        roles={roles}
        setError={setError}
      />
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-5 h-5 text-[#ff5a36]" />
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded">{error}</div>}

      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} label="Overview" />
        {api.fetchAccounts && <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")} label="Accounts" />}
        <TabButton active={tab === "courses"} onClick={() => setTab("courses")} label="Courses & Acts" />
      </div>

      {tab === "overview" && api.fetchActTree && <ActTree acts={actTree} single={scope === "account_admin"} />}

      {tab === "overview" && !api.fetchActTree && summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {scope === "super_admin" && <Tile label="Accounts w/ Training" value={summary.accounts_with_training} />}
            <Tile label="Total Users" value={summary.total_users} />
            <Tile label="Total Account Admins" value={summary.total_account_admins} />
            <Tile label="Courses" value={summary.total_courses} />
            <Tile label="Acts" value={summary.total_acts} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile label="Overall Completion" value={`${summary.overall_completion_percent}%`} color="text-[#ff5a36]" />
            <Tile label="Not Started" value={summary.not_started_count} color="text-slate-600" />
            <Tile label="In Progress" value={summary.in_progress_count} color="text-[#ff5a36]" />
            <Tile label="Completed" value={summary.completed_count} color="text-green-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Mandatory Assignments" value={summary.mandatory_count} color="text-amber-600" />
            <Tile label="Optional Assignments" value={summary.optional_count} color="text-slate-600" />
          </div>
        </div>
      )}

      {tab === "accounts" && api.fetchAccounts && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {accounts.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-12">No accounts have training allocated yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500">
                  <Th label="Account" sortKeyName="account_name" currentKey={accountsSort.sortKey} currentDir={accountsSort.sortDir} onSort={accountsSort.toggleSort} className="pl-4" />
                  <Th label="Courses" sortKeyName="course_count" currentKey={accountsSort.sortKey} currentDir={accountsSort.sortDir} onSort={accountsSort.toggleSort} />
                  <Th label="Acts" sortKeyName="act_count" currentKey={accountsSort.sortKey} currentDir={accountsSort.sortDir} onSort={accountsSort.toggleSort} />
                  <Th label="Users" sortKeyName="user_count" currentKey={accountsSort.sortKey} currentDir={accountsSort.sortDir} onSort={accountsSort.toggleSort} />
                  <Th label="Account Admins" sortKeyName="account_admin_count" currentKey={accountsSort.sortKey} currentDir={accountsSort.sortDir} onSort={accountsSort.toggleSort} />
                  <Th label="Completion" sortKeyName="completion_percent" currentKey={accountsSort.sortKey} currentDir={accountsSort.sortDir} onSort={accountsSort.toggleSort} />
                  <th className="py-1.5 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {accountsSort.sorted.map((a) => (
                  <tr key={a.account_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="py-2.5 pl-4 font-bold text-slate-800">{a.account_name} <span className="text-slate-400 font-normal">({a.account_code})</span></td>
                    <td className="py-2.5">{a.course_count}</td>
                    <td className="py-2.5">{a.act_count}</td>
                    <td className="py-2.5">{a.user_count}</td>
                    <td className="py-2.5">{a.account_admin_count}</td>
                    <td className="py-2.5 font-semibold">{a.completion_percent}%</td>
                    <td className="py-2.5 pr-4 text-right">
                      <button onClick={() => setDrill({ type: "account", accountId: a.account_id, label: a.account_name })} className="text-[#ff5a36] font-bold hover:text-[#9c3417] flex items-center gap-1 ml-auto">
                        View <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "courses" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {courses.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-12">No courses have training allocated yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500">
                  <Th label="Course" sortKeyName="course_name" currentKey={coursesSort.sortKey} currentDir={coursesSort.sortDir} onSort={coursesSort.toggleSort} className="pl-4" />
                  <Th label="Act" sortKeyName="act_code" currentKey={coursesSort.sortKey} currentDir={coursesSort.sortDir} onSort={coursesSort.toggleSort} />
                  {scope === "super_admin" && <Th label="Accounts" sortKeyName="accounts_mapped" currentKey={coursesSort.sortKey} currentDir={coursesSort.sortDir} onSort={coursesSort.toggleSort} />}
                  <th className="py-1.5 font-semibold text-left">Roles</th>
                  <Th label="Learners" sortKeyName="total_learners" currentKey={coursesSort.sortKey} currentDir={coursesSort.sortDir} onSort={coursesSort.toggleSort} />
                  <th className="py-1.5 font-semibold text-left">Status Breakdown</th>
                  <th className="py-1.5 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {coursesSort.sorted.map((c) => (
                  <tr key={c.course_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="py-2.5 pl-4 font-bold text-slate-800">{c.course_name}</td>
                    <td className="py-2.5 text-slate-500">{c.act_code}</td>
                    {scope === "super_admin" && <td className="py-2.5">{c.accounts_mapped}</td>}
                    <td className="py-2.5 text-slate-500">{c.role_types.join(", ")}</td>
                    <td className="py-2.5">{c.total_learners}</td>
                    <td className="py-2.5 text-slate-500">
                      {c.not_started_count} not started &middot; {c.in_progress_count} in progress &middot; {c.completed_count} completed
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <button onClick={() => setDrill({ type: "course", courseId: c.course_id, label: c.course_name })} className="text-[#ff5a36] font-bold hover:text-[#9c3417] flex items-center gap-1 ml-auto">
                        View <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// Above 75 green, 50 to 75 orange, below 50 red (same rule as the learner screens).
function scoreChipClasses(percent) {
  if (percent > 75) return "bg-green-50 text-green-700 border-green-200";
  if (percent >= 50) return "bg-orange-50 text-orange-600 border-orange-200";
  return "bg-red-50 text-red-600 border-red-200";
}

// Timestamps come from the API without a zone marker and are UTC.
function formatTestDate(value) {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return d.toLocaleDateString();
}

const STATUS_BAR = { not_started: "bg-slate-300", in_progress: "bg-[#ff5a36]", completed: "bg-green-600" };

function ProgressBar({ percent, status, className = "" }) {
  return (
    <div className={`bg-slate-100 rounded-full h-1.5 ${className}`}>
      <div className={`h-1.5 rounded-full transition-all ${STATUS_BAR[status] || "bg-[#ff5a36]"}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function initials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function NoTrainingBadge() {
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white text-slate-400 border-slate-200">No training</span>;
}

function ScoreCell({ test, moduleComplete }) {
  if (test.latest_score_percent != null) {
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${scoreChipClasses(test.latest_score_percent)}`}>{test.latest_score_percent}%</span>;
  }
  return <span className="text-[11px] text-slate-400">{moduleComplete ? "Not taken" : "Locked"}</span>;
}

// One row per module; a module with several assignments gets one line per assignment.
function ModuleTable({ modules }) {
  if (modules.length === 0) {
    return <div className="text-xs text-slate-400 px-4 py-3">This course has no modules yet.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="text-[10.5px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
          <tr>
            <th className="py-2 pl-4 pr-4 font-semibold text-left">Module</th>
            <th className="py-2 pr-4 font-semibold text-left">Sections</th>
            <th className="py-2 pr-4 font-semibold text-left">Status</th>
            <th className="py-2 pr-4 font-semibold text-left">Test</th>
            <th className="py-2 pr-4 font-semibold text-left">Score</th>
            <th className="py-2 pr-4 font-semibold text-left">Test Date</th>
            <th className="py-2 pr-4 font-semibold text-left">Attempts</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((mo) => {
            const lines = mo.assignments.length ? mo.assignments : [null];
            return lines.map((t, i) => (
              <tr key={`${mo.module_id}-${t ? t.assignment_id : "none"}`} className={i === lines.length - 1 ? "border-b border-slate-50 last:border-0" : ""}>
                {i === 0 && (
                  <>
                    <td rowSpan={lines.length} className="py-2 pl-4 pr-4 align-top">
                      <span className="text-slate-400 font-semibold mr-1.5">Module {mo.sequence_order} &middot;</span>
                      <span className="font-semibold text-slate-700">{mo.module_name}</span>
                    </td>
                    <td rowSpan={lines.length} className="py-2 pr-4 align-top">
                      <div className="flex items-center gap-2">
                        <ProgressBar percent={mo.progress_percent} status={mo.status} className="w-16" />
                        <span className="text-slate-500 font-semibold">{mo.sections_done}/{mo.sections_total}</span>
                      </div>
                    </td>
                    <td rowSpan={lines.length} className="py-2 pr-4 align-top"><StatusBadge status={mo.status} /></td>
                  </>
                )}
                {t ? (
                  <>
                    <td className="py-1.5 pr-4 text-slate-600">{t.title}</td>
                    <td className="py-1.5 pr-4"><ScoreCell test={t} moduleComplete={mo.is_complete} /></td>
                    <td className="py-1.5 pr-4 text-slate-600">{t.latest_test_at ? formatTestDate(t.latest_test_at) : <span className="text-slate-300">&mdash;</span>}</td>
                    <td className="py-1.5 pr-4 text-slate-600 font-semibold">{t.attempt_count || <span className="text-slate-300 font-normal">&mdash;</span>}</td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-4 text-slate-400 italic">No test</td>
                    <td className="py-2 pr-4 text-slate-300">&mdash;</td>
                    <td className="py-2 pr-4 text-slate-300">&mdash;</td>
                    <td className="py-2 pr-4 text-slate-300">&mdash;</td>
                  </>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function CourseBlock({ course }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GraduationCap className="w-4 h-4 text-[#ff5a36] flex-shrink-0" />
          <span className="font-bold text-[13px] text-slate-800">{course.course_name}</span>
          {course.is_mandatory && <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Mandatory</span>}
          <StatusBadge status={course.status} />
        </div>
        <div className="flex items-center gap-2 min-w-[190px]">
          <ProgressBar percent={course.progress_percent} status={course.status} className="flex-1" />
          <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">{course.sections_done}/{course.sections_total} sections &middot; {course.progress_percent}%</span>
        </div>
        <div className="text-[11px] text-slate-400 whitespace-nowrap">Assigned {course.assigned_at ? formatTestDate(course.assigned_at) : "-"}</div>
      </div>
      <ModuleTable modules={course.modules} />
    </div>
  );
}

// Person -> their courses (with progress) -> each course's modules (with test scores).
function PeopleProgress({ members }) {
  const [open, setOpen] = useState(() => new Set());
  if (members.length === 0) {
    return <div className="text-xs text-slate-400 py-3 px-4">No active Account Admins or Users in this account.</div>;
  }
  const trainable = members.filter((m) => m.has_training).map((m) => m.admin_id);
  const allOpen = trainable.length > 0 && trainable.every((id) => open.has(id));
  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="space-y-2.5">
      {trainable.length > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setOpen(allOpen ? new Set() : new Set(trainable))} className="text-[11px] font-bold text-[#ff5a36] hover:text-[#9c3417]">
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}
      {members.map((m) => {
        const isOpen = open.has(m.admin_id) && m.has_training;
        return (
          <div key={m.admin_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => m.has_training && toggle(m.admin_id)}
              className={`w-full flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left ${m.has_training ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}`}
            >
              {m.has_training
                ? (isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />)
                : <span className="w-4 flex-shrink-0" />}
              <div className="w-8 h-8 rounded-full bg-[#fff1ec] text-[#c8431f] flex items-center justify-center text-[11px] font-bold flex-shrink-0">{initials(m.name)}</div>
              <div className="min-w-[150px] flex-1">
                <div className="font-bold text-[13px] text-slate-800 leading-tight">{m.name}</div>
                <div className="text-[10.5px] text-slate-400">{m.email}</div>
              </div>
              <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 rounded px-2 py-0.5">{m.role_name}</span>
              {m.has_training ? (
                <>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">{m.courses_completed} of {m.courses.length} {m.courses.length === 1 ? "course" : "courses"} completed</span>
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <ProgressBar percent={m.progress_percent} status={m.status} className="flex-1" />
                    <span className="text-[11px] font-bold text-slate-700 w-9 text-right">{m.progress_percent}%</span>
                  </div>
                  <StatusBadge status={m.status} />
                </>
              ) : <NoTrainingBadge />}
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-3">
                {m.courses.map((c) => <CourseBlock key={c.course_id} course={c} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActTree({ acts, single = false }) {
  const [openAccounts, setOpenAccounts] = useState(() => new Set());
  const toggle = (key) => setOpenAccounts((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (acts.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-12 bg-white border border-slate-200 rounded-xl">No accounts are enrolled in any Act yet.</div>;
  }

  return (
    <div className="space-y-5">
      {acts.map((act) => (
        <div key={act.act_code} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">{act.act_code}</h3>
            {single ? (
              <span className="text-[11px] font-semibold text-slate-500">
                {act.accounts[0].member_count} {act.accounts[0].member_count === 1 ? "person" : "people"} &middot; {act.accounts[0].training_count} getting training &middot;{" "}
                <span className="text-slate-600">{act.accounts[0].not_started_count} not started</span> &middot;{" "}
                <span className="text-[#ff5a36]">{act.accounts[0].in_progress_count} in progress</span> &middot;{" "}
                <span className="text-green-600">{act.accounts[0].completed_count} completed</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500">{act.account_count} {act.account_count === 1 ? "account" : "accounts"}</span>
            )}
          </div>

          {single ? (
            <div className="p-3"><PeopleProgress members={act.accounts[0].members} /></div>
          ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2 pl-4 font-semibold text-left">Account</th>
                <th className="py-2 font-semibold text-center">Account Admins</th>
                <th className="py-2 font-semibold text-center">Users</th>
                <th className="py-2 font-semibold text-center">Getting Training</th>
                <th className="py-2 font-semibold text-center">Not Started</th>
                <th className="py-2 font-semibold text-center">In Progress</th>
                <th className="py-2 pr-4 font-semibold text-center">Completed</th>
              </tr>
            </thead>
            <tbody>
              {act.accounts.map((acc) => {
                const key = `${act.act_code}::${acc.account_id}`;
                const open = openAccounts.has(key);
                return (
                  <React.Fragment key={key}>
                    <tr onClick={() => toggle(key)} className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/60">
                      <td className="py-2.5 pl-4 font-bold text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          {acc.account_name} <span className="text-slate-400 font-normal">({acc.account_code})</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-center">{acc.account_admin_count}</td>
                      <td className="py-2.5 text-center">{acc.user_count}</td>
                      <td className="py-2.5 text-center font-semibold">{acc.training_count}</td>
                      <td className="py-2.5 text-center text-slate-600">{acc.not_started_count}</td>
                      <td className="py-2.5 text-center text-[#ff5a36]">{acc.in_progress_count}</td>
                      <td className="py-2.5 pr-4 text-center text-green-600">{acc.completed_count}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-slate-100">
                        <td colSpan={7} className="bg-slate-50/60 pl-10 pr-4 py-3">
                          <PeopleProgress members={acc.members} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-bold border-b-2 ${active ? "border-[#ff5a36] text-[#ff5a36]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
    >
      {label}
    </button>
  );
}

function DrillDown({ drill, onBack, onNavigate, api, scope, departmentList, processList, roles, setError }) {
  if (drill.type === "course") {
    return <CourseModulesDrillDown drill={drill} onBack={onBack} onNavigate={onNavigate} api={api} setError={setError} />;
  }
  return (
    <RecordsDrillDown
      drill={drill}
      onBack={onBack}
      api={api}
      scope={scope}
      departmentList={departmentList}
      processList={processList}
      roles={roles}
      setError={setError}
    />
  );
}

function CourseModulesDrillDown({ drill, onBack, onNavigate, api, setError }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const sort = useSortedList(modules, "sequence_order");

  useEffect(() => {
    setLoading(true);
    api.fetchCourseModules(drill.courseId)
      .then(setModules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [drill.courseId, api, setError]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </button>
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-[#ff5a36]" />
        <h2 className="text-base font-bold text-slate-800">{drill.label} &middot; Modules</h2>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#ff5a36]" /></div>
      ) : modules.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-12 bg-white border border-slate-200 rounded-xl">No modules in this course yet.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500">
                <Th label="Module" sortKeyName="sequence_order" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggleSort} className="pl-4" />
                <th className="py-1.5 font-semibold text-left">Mapping</th>
                <Th label="Assigned" sortKeyName="total_assigned" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggleSort} />
                <Th label="Completed" sortKeyName="completed_count" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggleSort} />
                <Th label="Completion" sortKeyName="completion_percent" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggleSort} />
                <th className="py-1.5 font-semibold text-left">Drop-off</th>
                <th className="py-1.5 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {sort.sorted.map((m) => (
                <tr key={m.module_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="py-2.5 pl-4">
                    <div className="font-bold text-slate-800"><span className="text-slate-400">Module {m.sequence_order} &middot;</span> {m.module_name}</div>
                    <div className="text-slate-400 text-[10px]">{m.short_description}</div>
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {m.department_name && <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{m.department_name}</span>}
                      {m.process_name && <span className="text-[9px] font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">{m.process_name}</span>}
                      {m.chapter && <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">{m.chapter}</span>}
                      {m.rules && <span className="text-[9px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{m.rules}</span>}
                    </div>
                  </td>
                  <td className="py-2.5">{m.total_assigned}</td>
                  <td className="py-2.5">{m.completed_count}</td>
                  <td className="py-2.5 font-semibold">{m.completion_percent}%</td>
                  <td className="py-2.5">
                    {m.drop_off_percent === null ? (
                      <span className="text-slate-300">&mdash;</span>
                    ) : (
                      <span className={`font-bold ${m.drop_off_percent >= 50 ? "text-red-600" : m.drop_off_percent > 0 ? "text-amber-600" : "text-green-600"}`}>
                        {m.drop_off_percent}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <button onClick={() => onNavigate({ type: "module", courseId: drill.courseId, moduleId: m.module_id, label: `${drill.label} – ${m.module_name}` })} className="text-[#ff5a36] font-bold hover:text-[#9c3417] flex items-center gap-1 ml-auto">
                      Learners <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordsDrillDown({ drill, onBack, api, scope, departmentList, processList, roles, setError }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role_id: "", department_item_id: "", process_item_id: "", status: "" });
  const sort = useSortedList(records, "admin_name");

  const baseParams = useMemo(() => {
    if (drill.type === "account") return { account_id: drill.accountId };
    if (drill.type === "module") return { course_id: drill.courseId, module_id: drill.moduleId };
    return {};
  }, [drill]);

  useEffect(() => {
    setLoading(true);
    api.fetchRecords({ ...baseParams, ...filters })
      .then(setRecords)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [baseParams, filters, api, setError]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </button>
      <div className="flex items-center gap-2">
        {drill.type === "account" ? <Building2 className="w-5 h-5 text-[#ff5a36]" /> : <GraduationCap className="w-5 h-5 text-[#ff5a36]" />}
        <h2 className="text-base font-bold text-slate-800">{drill.label}</h2>
      </div>

      <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-xl p-3">
        <select value={filters.role_id} onChange={(e) => setFilters((f) => ({ ...f, role_id: e.target.value }))} className="border border-slate-300 rounded-lg text-xs px-2.5 py-1.5">
          <option value="">All User Types</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
        </select>
        <select value={filters.department_item_id} onChange={(e) => setFilters((f) => ({ ...f, department_item_id: e.target.value }))} className="border border-slate-300 rounded-lg text-xs px-2.5 py-1.5">
          <option value="">All Departments</option>
          {departmentList.map((d) => <option key={d.id} value={d.id}>{d.item_name}</option>)}
        </select>
        <select value={filters.process_item_id} onChange={(e) => setFilters((f) => ({ ...f, process_item_id: e.target.value }))} className="border border-slate-300 rounded-lg text-xs px-2.5 py-1.5">
          <option value="">All Processes</option>
          {processList.map((p) => <option key={p.id} value={p.id}>{p.item_name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="border border-slate-300 rounded-lg text-xs px-2.5 py-1.5">
          <option value="">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#ff5a36]" /></div>
      ) : records.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-12 bg-white border border-slate-200 rounded-xl">No matching records.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500">
                <Th label="Learner" sortKeyName="admin_name" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggleSort} className="pl-4" />
                <th className="py-1.5 font-semibold text-left">Role</th>
                {scope === "super_admin" && drill.type !== "account" && <th className="py-1.5 font-semibold text-left">Account</th>}
                <th className="py-1.5 font-semibold text-left">Course</th>
                <th className="py-1.5 font-semibold text-left">Status</th>
                <Th label="Progress" sortKeyName="progress_percent" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggleSort} />
                <th className="py-1.5 font-semibold text-left">Mandatory</th>
                <th className="py-1.5 font-semibold text-left pr-4">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {sort.sorted.map((r, idx) => (
                <tr key={`${r.admin_id}-${r.course_id}-${r.module_id || "c"}-${idx}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="py-2.5 pl-4 font-bold text-slate-800">{r.admin_name}</td>
                  <td className="py-2.5 text-slate-500">{r.role_name}</td>
                  {scope === "super_admin" && drill.type !== "account" && <td className="py-2.5 text-slate-500">{r.account_name}</td>}
                  <td className="py-2.5 text-slate-500">{r.course_name}</td>
                  <td className="py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="py-2.5 font-semibold">{r.progress_percent}%</td>
                  <td className="py-2.5 text-slate-500">{r.is_mandatory ? "Yes" : "No"}</td>
                  <td className="py-2.5 text-slate-400 pr-4">{r.assigned_at ? new Date(r.assigned_at).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
