import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronRight, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { fetchEnrolledActsApi, fetchChaptersForActApi } from "../services/rulesApi";

// The Act a chapter was created under is always mapped by default in Super
// Admin (locked there, can't be removed) - shown here defensively too, in
// case older data saved before that lock existed is missing it.
function withDefaultAct(acts, defaultAct) {
  const list = acts || [];
  return defaultAct && !list.includes(defaultAct) ? [defaultAct, ...list] : list;
}

function RuleCard({ rule, chapterActCode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 text-left"
      >
        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="text-[10.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 flex-shrink-0">
          Rule {rule.rule_order}
        </span>
        {!open && (
          <span className="text-[11.5px] text-slate-400 truncate flex-1 min-w-0">{rule.rule_narrative}</span>
        )}
      </button>

      {open && (
        <div className="px-3 py-3 border-t border-slate-200 space-y-2.5">
          <p className="text-[12px] leading-relaxed text-slate-700">{rule.rule_narrative}</p>

          {rule.sample_policies?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Mapped sample policies</span>
              {rule.sample_policies.map((policy, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5"
                  title="Opens in Resources once that tab is built"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {policy}
                </span>
              ))}
            </div>
          )}

          {rule.sections?.map((section) => (
            <SectionCard key={section.id} section={section} chapterActCode={chapterActCode} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, chapterActCode }) {
  const displayActs = withDefaultAct(section.mapped_acts, chapterActCode);
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="text-[11.5px] font-bold text-slate-800">
          <span className="text-[9px] font-bold uppercase tracking-wide text-blue-600 mr-1.5">Section</span>
          {section.section_title}
        </div>
        {displayActs.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {displayActs.map((act, i) => (
              <span key={i} className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{act}</span>
            ))}
          </div>
        )}
      </div>

      {section.section_explanation && (
        <>
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400 mt-1.5 mb-0.5">Explanation</div>
          <p className="text-[11.5px] text-slate-600 leading-relaxed">{section.section_explanation}</p>
        </>
      )}

      {section.practical_examples && (
        <>
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400 mt-1.5 mb-0.5">Practical example</div>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11.5px] leading-relaxed rounded-md px-2 py-1.5">
            {section.practical_examples}
          </div>
        </>
      )}

      {section.sub_sections?.some((s) => s.title) && (
        <div className="mt-2 border-l-2 border-slate-200 pl-2.5 space-y-1">
          {section.sub_sections.map((sub, si) => (
            !sub.title ? null : (
              <div key={si} className="text-[11.5px]">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-purple-600 mr-1.5">Sub-section</span>
                  {sub.title}
                </div>
                {sub.paragraphs?.map((p, pi) => (
                  !p.text ? null : (
                    <div key={pi} className="ml-3 mt-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-purple-600 mr-1.5">Paragraph</span>
                      {p.text}
                      {p.sub_paragraphs?.filter(Boolean).map((sp, spi) => (
                        <div key={spi} className="ml-3 mt-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-purple-600 mr-1.5">Sub-para</span>
                          {sp}
                        </div>
                      ))}
                    </div>
                  )
                ))}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function ChapterCard({ chapter }) {
  const [open, setOpen] = useState(false);
  const sectionCount = chapter.rules.reduce((n, r) => n + (r.sections?.length || 0), 0);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-900 text-white text-left"
      >
        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="text-[12px] font-semibold flex-1 min-w-0 truncate">{chapter.title}</span>
        <span className="text-[9.5px] font-semibold bg-white/10 rounded-full px-1.5 py-0.5">{chapter.rules.length} rules</span>
        <span className="text-[9.5px] font-semibold bg-white/10 rounded-full px-1.5 py-0.5">{sectionCount} sections</span>
      </button>

      {open && (
        <div className="p-2 space-y-1.5">
          {chapter.rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} chapterActCode={chapter.act_code} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RulesTab() {
  const [acts, setActs] = useState([]);
  const [activeAct, setActiveAct] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loadingActs, setLoadingActs] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEnrolledActsApi()
      .then((data) => {
        setActs(data);
        if (data.length > 0) setActiveAct((prev) => prev || data[0]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingActs(false));
  }, []);

  // `silent` refreshes (focus regain, manual button) keep the current chapter
  // list on screen - including whatever the user has expanded - and only
  // swap it once the new data arrives, instead of dropping into the "loading"
  // branch, which would unmount every open chapter/rule and collapse them.
  const loadChapters = useCallback((act, { silent } = {}) => {
    if (!act) return;
    if (silent) setRefreshing(true); else setLoadingChapters(true);
    setError("");
    fetchChaptersForActApi(act)
      .then(setChapters)
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoadingChapters(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    loadChapters(activeAct);
  }, [activeAct, loadChapters]);

  // Rules are edited from a separate Super Admin session with no push
  // mechanism between the two - refetch quietly whenever this tab regains
  // focus so a change made elsewhere shows up as soon as it's looked at,
  // without a full page reload or a visible loading flash.
  useEffect(() => {
    const onFocus = () => loadChapters(activeAct, { silent: true });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [activeAct, loadChapters]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-4">
        <h1 className="text-[15px] font-bold text-slate-800">Rules &amp; Acts</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">View only &middot; showing acts your account is enrolled in</p>
      </div>

      <div className="px-5 mt-3 border-b border-slate-200 flex items-center gap-1">
        <div className="flex-1 flex gap-1">
        {loadingActs ? (
          <div className="py-2 text-[11px] text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading acts...</div>
        ) : acts.length === 0 ? (
          <div className="py-2 text-[11px] text-slate-400">No acts enrolled for this account yet.</div>
        ) : (
          acts.map((act) => (
            <button
              key={act}
              onClick={() => setActiveAct(act)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border-b-2 -mb-px ${
                activeAct === act ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {act}
            </button>
          ))
        )}
        </div>
        <button
          onClick={() => loadChapters(activeAct, { silent: true })}
          title="Refresh from Super Admin"
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
        {loadingChapters ? (
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading chapters...</div>
        ) : activeAct && chapters.length === 0 && !error ? (
          <div className="text-xs text-slate-400">No visible chapters for this act yet.</div>
        ) : (
          chapters.map((chapter) => <ChapterCard key={chapter.id} chapter={chapter} />)
        )}
      </div>
    </div>
  );
}
