import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  PlusCircle,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Save,
  Loader2,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Lock,
  X,
  Layers
} from "lucide-react";
import { fetchTab1BootstrapApi } from "../../services/tab1Api";
import {
  fetchChaptersByActApi,
  saveChapterTreeApi,
  updateSingleRuleApi,
  addRuleToChapterApi,
  toggleRuleHideApi
} from "../../services/tab2Api";

export default function TabTwoRules() {
  const [masterActs, setMasterActs] = useState([]);
  const [selectedAct, setSelectedAct] = useState("");
  const [samplePoliciesList, setSamplePoliciesList] = useState([]);
  const [industriesList, setIndustriesList] = useState([]);
  const [industryProcessesList, setIndustryProcessesList] = useState([]);
  const [orgTypesList, setOrgTypesList] = useState([]);
  const [departmentLabel, setDepartmentLabel] = useState("Department");
  const [processLabel, setProcessLabel] = useState("Process");
  const [orgTypeLabel, setOrgTypeLabel] = useState("Organization Type");
  const [tasksList, setTasksList] = useState([]);

  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dedicated In-App Modal for Adding a Rule to Existing Chapter
  const [addRuleModal, setAddRuleModal] = useState({
    open: false,
    chapterId: null,
    chapterTitle: "",
    ruleNarrative: "",
    samplePolicies: [],
    orgTypes: []
  });

  // Editing Context for In-Place Updates
  const [editingContext, setEditingContext] = useState({
    isEditingSingleRule: false,
    chapterId: null,
    chapterTitle: "",
    ruleId: null
  });

  // Collapsible Accordion States (Default Collapsed)
  const [expandedChapters, setExpandedChapters] = useState({});
  const [expandedRules, setExpandedRules] = useState({});

  // --- Initial Blank Helper Factories ---
  const getBlankProcess = () => ({
    action: "",
    task_name: "None",
    schedule: "None",
    auto_tracking: false
  });

  const getBlankAssessment = (currentAct = selectedAct) => ({
    question: "",
    mapped_acts: currentAct ? [currentAct] : [],
    industries: [],
    industry_process: "",
    mapped_org_types: [],
    sop_name: "",
    sop_details: "",
    processes: [getBlankProcess()]
  });

  const getBlankSection = (currentAct = selectedAct) => ({
    section_title: "",
    section_explanation: "",
    practical_examples: "",
    mapped_acts: currentAct ? [currentAct] : [],
    sub_sections: [
      {
        title: "",
        paragraphs: [{ text: "", sub_paragraphs: [""] }]
      }
    ],
    assessments: [getBlankAssessment(currentAct)]
  });

  const getBlankRule = (order = 1, currentAct = selectedAct) => ({
    rule_order: order,
    rule_narrative: "",
    sample_policies: [],
    is_hidden: false,
    sections: [getBlankSection(currentAct)]
  });

  const [builderChapterTitle, setBuilderChapterTitle] = useState("");
  const [builderRules, setBuilderRules] = useState([getBlankRule(1, selectedAct)]);

  const resetBuilderForm = useCallback((targetAct = selectedAct) => {
    setBuilderChapterTitle("");
    setBuilderRules([getBlankRule(1, targetAct)]);
    setEditingContext({ isEditingSingleRule: false, chapterId: null, chapterTitle: "", ruleId: null });
  }, [selectedAct]);

  const loadChapters = async (actCode) => {
    try {
      setLoading(true);
      const chaps = await fetchChaptersByActApi(actCode);
      setChapters(chaps);
      setExpandedChapters({});
      setExpandedRules({});
    } catch (err) {
      console.error("Error loading chapters:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    try {
      setLoading(true);
      const bData = await fetchTab1BootstrapApi();
      const acts = bData.registries?.find(r => r.registry_key === "acts")?.items || [];
      const policies = bData.registries?.find(r => r.registry_key === "sample_policies")?.items || [];
      const industriesRegistry = bData.registries?.find(r => r.registry_key === "industries");
      const processesRegistry = bData.registries?.find(r => r.registry_key === "industry_processes");
      const orgTypesRegistry = bData.registries?.find(r => r.registry_key === "organization_types");
      const industries = industriesRegistry?.items || [];
      const procs = processesRegistry?.items || [];
      const orgTypes = orgTypesRegistry?.items || [];
      const tasks = bData.registries?.find(r => r.registry_key === "tasks")?.items || [];

      setMasterActs(acts);
      setSamplePoliciesList(policies);
      setIndustriesList(industries);
      setIndustryProcessesList(procs);
      setOrgTypesList(orgTypes);
      setTasksList(tasks);
      setDepartmentLabel(industriesRegistry?.display_name || "Department");
      setProcessLabel(processesRegistry?.display_name || "Process");
      setOrgTypeLabel(orgTypesRegistry?.display_name || "Organization Type");

      if (acts.length > 0) {
        const initialAct = acts[0].item_name;
        setSelectedAct(initialAct);
        setBuilderRules([getBlankRule(1, initialAct)]);
        await loadChapters(initialAct);
      }
    } catch (err) {
      console.error("Error bootstrapping Tab 2:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const handleSelectAct = async (actName) => {
    if (!actName || selectedAct === actName) return;
    setSelectedAct(actName);
    resetBuilderForm(actName);
    await loadChapters(actName);
  };

  const toggleChapterAccordion = (chapId) => {
    setExpandedChapters(prev => ({ ...prev, [chapId]: !prev[chapId] }));
  };

  const toggleRuleAccordion = (ruleId) => {
    setExpandedRules(prev => ({ ...prev, [ruleId]: !prev[ruleId] }));
  };

  const cloneRules = () => JSON.parse(JSON.stringify(builderRules));

  // The Act a chapter is created under must always be part of a section's
  // mapped_acts - it's locked in the UI, so it must also be locked in on
  // save/load, not just used as a fallback when the list happens to be empty.
  const withDefaultAct = (acts, defaultAct) => {
    const list = acts || [];
    return defaultAct && !list.includes(defaultAct) ? [defaultAct, ...list] : list;
  };

  const handleToggleRulePolicy = (rIdx, policyName) => {
    const copy = cloneRules();
    const cur = copy[rIdx].sample_policies || [];
    copy[rIdx].sample_policies = cur.includes(policyName)
      ? cur.filter(p => p !== policyName)
      : [...cur, policyName];
    setBuilderRules(copy);
  };

  const handleToggleSectionAct = (rIdx, sIdx, actName) => {
    if (actName === selectedAct) return; // the Act the chapter was created under is locked, not editable
    const copy = cloneRules();
    const cur = copy[rIdx].sections[sIdx].mapped_acts || [];
    copy[rIdx].sections[sIdx].mapped_acts = cur.includes(actName)
      ? cur.filter(a => a !== actName)
      : [...cur, actName];
    setBuilderRules(copy);
  };

  const handleToggleAssessmentAct = (rIdx, sIdx, aIdx, actName) => {
    const copy = cloneRules();
    const cur = copy[rIdx].sections[sIdx].assessments[aIdx].mapped_acts || [];
    copy[rIdx].sections[sIdx].assessments[aIdx].mapped_acts = cur.includes(actName)
      ? cur.filter(a => a !== actName)
      : [...cur, actName];
    setBuilderRules(copy);
  };

  const handleToggleAssessmentIndustry = (rIdx, sIdx, aIdx, indName) => {
    const copy = cloneRules();
    const cur = copy[rIdx].sections[sIdx].assessments[aIdx].industries || [];
    copy[rIdx].sections[sIdx].assessments[aIdx].industries = cur.includes(indName)
      ? cur.filter(i => i !== indName)
      : [...cur, indName];
    setBuilderRules(copy);
  };

  const handleToggleAssessmentOrgType = (rIdx, sIdx, aIdx, orgTypeName) => {
    const copy = cloneRules();
    const cur = copy[rIdx].sections[sIdx].assessments[aIdx].mapped_org_types || [];
    copy[rIdx].sections[sIdx].assessments[aIdx].mapped_org_types = cur.includes(orgTypeName)
      ? cur.filter(o => o !== orgTypeName)
      : [...cur, orgTypeName];
    setBuilderRules(copy);
  };

  const handleAddRule = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBuilderRules(prev => [...prev, getBlankRule(prev.length + 1, selectedAct)]);
  };

  const handleRemoveRule = (rIdx) => {
    if (builderRules.length === 1) {
      alert("At least one rule is required.");
      return;
    }
    setBuilderRules(prev => prev.filter((_, idx) => idx !== rIdx));
  };

  const handleAddSection = (e, rIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const copy = cloneRules();
    copy[rIdx].sections.push(getBlankSection(selectedAct));
    setBuilderRules(copy);
  };

  const handleRemoveSection = (rIdx, sIdx) => {
    const copy = cloneRules();
    if (copy[rIdx].sections.length === 1) {
      alert("At least one section is required per rule.");
      return;
    }
    copy[rIdx].sections.splice(sIdx, 1);
    setBuilderRules(copy);
  };

  const handleAddSubSection = (e, rIdx, sIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const copy = cloneRules();
    copy[rIdx].sections[sIdx].sub_sections.push({
      title: "",
      paragraphs: [{ text: "", sub_paragraphs: [""] }]
    });
    setBuilderRules(copy);
  };

  const handleRemoveSubSection = (rIdx, sIdx, subIdx) => {
    const copy = cloneRules();
    copy[rIdx].sections[sIdx].sub_sections.splice(subIdx, 1);
    setBuilderRules(copy);
  };

  const handleAddPara = (e, rIdx, sIdx, subIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const copy = cloneRules();
    copy[rIdx].sections[sIdx].sub_sections[subIdx].paragraphs.push({ text: "", sub_paragraphs: [""] });
    setBuilderRules(copy);
  };

  const handleRemovePara = (rIdx, sIdx, subIdx, pIdx) => {
    const copy = cloneRules();
    copy[rIdx].sections[sIdx].sub_sections[subIdx].paragraphs.splice(pIdx, 1);
    setBuilderRules(copy);
  };

  const handleAddSubPara = (e, rIdx, sIdx, subIdx, pIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const copy = cloneRules();
    copy[rIdx].sections[sIdx].sub_sections[subIdx].paragraphs[pIdx].sub_paragraphs.push("");
    setBuilderRules(copy);
  };

  const handleRemoveSubPara = (rIdx, sIdx, subIdx, pIdx, spIdx) => {
    const copy = cloneRules();
    copy[rIdx].sections[sIdx].sub_sections[subIdx].paragraphs[pIdx].sub_paragraphs.splice(spIdx, 1);
    setBuilderRules(copy);
  };

  const handleAddAssessment = (e, rIdx, sIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const copy = cloneRules();
    copy[rIdx].sections[sIdx].assessments.push(getBlankAssessment(selectedAct));
    setBuilderRules(copy);
  };

  const handleRemoveAssessment = (rIdx, sIdx, aIdx) => {
    const copy = cloneRules();
    if (copy[rIdx].sections[sIdx].assessments.length === 1) {
      alert("At least one Assessment & SOP box is required.");
      return;
    }
    copy[rIdx].sections[sIdx].assessments.splice(aIdx, 1);
    setBuilderRules(copy);
  };

  const handleAddProcess = (e, rIdx, sIdx, aIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const copy = cloneRules();
    copy[rIdx].sections[sIdx].assessments[aIdx].processes.push(getBlankProcess());
    setBuilderRules(copy);
  };

  const handleRemoveProcess = (rIdx, sIdx, aIdx, pIdx) => {
    const copy = cloneRules();
    if (copy[rIdx].sections[sIdx].assessments[aIdx].processes.length === 1) {
      alert("At least one process row is required.");
      return;
    }
    copy[rIdx].sections[sIdx].assessments[aIdx].processes.splice(pIdx, 1);
    setBuilderRules(copy);
  };

  const handleSaveTree = async () => {
    if (!builderChapterTitle.trim()) {
      alert("Please enter a Chapter / Part Title.");
      return;
    }

    const cleanedRules = builderRules
      .filter(rule => rule.rule_narrative.trim())
      .map((rule, rIdx) => ({
        ...rule,
        rule_order: rule.rule_order || (rIdx + 1),
        sections: rule.sections
          .filter(sec => sec.section_title.trim() || sec.section_explanation.trim())
          .map(sec => ({
            ...sec,
            mapped_acts: withDefaultAct(sec.mapped_acts, selectedAct),
            sub_sections: (sec.sub_sections || [])
              .filter(sub => sub.title?.trim())
              .map(sub => ({
                title: sub.title.trim(),
                paragraphs: (sub.paragraphs || [])
                  .filter(p => p.text?.trim())
                  .map(p => ({
                    text: p.text.trim(),
                    sub_paragraphs: (p.sub_paragraphs || []).filter(sp => sp && sp.trim())
                  }))
              })),
            assessments: (sec.assessments || [])
              .filter(ass => ass.question.trim() || ass.sop_name.trim())
              .map(ass => ({
                ...ass,
                mapped_acts: ass.mapped_acts?.length > 0 ? ass.mapped_acts : [selectedAct],
                processes: (ass.processes || []).filter(p => p.action.trim() || (p.task_name && p.task_name !== "None"))
              }))
          }))
      }));

    if (cleanedRules.length === 0) {
      alert("Please provide content for at least one rule.");
      return;
    }

    for (const rule of cleanedRules) {
      for (const sec of rule.sections) {
        for (const ass of sec.assessments) {
          if (!ass.mapped_org_types || ass.mapped_org_types.length === 0) {
            alert(`Question "${(ass.question || ass.sop_name).slice(0, 80)}" must have at least one value selected under "${orgTypeLabel}".`);
            return;
          }
        }
      }
    }

    try {
      setSaving(true);
      if (editingContext.isEditingSingleRule && editingContext.ruleId && editingContext.chapterId) {
        await updateSingleRuleApi(editingContext.ruleId, editingContext.chapterId, cleanedRules[0]);
        alert("Rule node updated successfully!");
      } else {
        await saveChapterTreeApi({
          act_code: selectedAct,
          title: builderChapterTitle.trim(),
          rules: cleanedRules
        });
        alert("Hierarchical Chapter and Rules saved successfully to PostgreSQL!");
      }
      resetBuilderForm(selectedAct);
      await loadChapters(selectedAct);
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- In-App Modal Handlers: Open Styled Pop-up ---
  const handleOpenAddRuleModal = (chap) => {
    setAddRuleModal({
      open: true,
      chapterId: chap.id,
      chapterTitle: chap.title,
      ruleNarrative: "",
      samplePolicies: [],
      orgTypes: []
    });
  };

  const handleToggleModalPolicy = (policyName) => {
    setAddRuleModal(prev => {
      const cur = prev.samplePolicies || [];
      const updated = cur.includes(policyName)
        ? cur.filter(p => p !== policyName)
        : [...cur, policyName];
      return { ...prev, samplePolicies: updated };
    });
  };

  const handleToggleModalOrgType = (orgTypeName) => {
    setAddRuleModal(prev => {
      const cur = prev.orgTypes || [];
      const updated = cur.includes(orgTypeName)
        ? cur.filter(o => o !== orgTypeName)
        : [...cur, orgTypeName];
      return { ...prev, orgTypes: updated };
    });
  };

  const handleConfirmAddRuleToChapter = async (e) => {
    e.preventDefault();
    if (!addRuleModal.ruleNarrative.trim()) {
      alert("Please enter the rule narrative content.");
      return;
    }
    if (!addRuleModal.orgTypes || addRuleModal.orgTypes.length === 0) {
      alert(`Please select at least one value under "${orgTypeLabel}".`);
      return;
    }

    try {
      setSaving(true);
      const newRulePayload = getBlankRule(1, selectedAct);
      newRulePayload.rule_narrative = addRuleModal.ruleNarrative.trim();
      newRulePayload.sample_policies = addRuleModal.samplePolicies;
      newRulePayload.sections[0].section_title = "Section 1 - Operational Standard";
      newRulePayload.sections[0].section_explanation = "Mandatory operational execution standard.";
      newRulePayload.sections[0].mapped_acts = [selectedAct];
      newRulePayload.sections[0].assessments[0].question = "Is the rule requirement fully implemented?";
      newRulePayload.sections[0].assessments[0].sop_name = "SOP-01 Standard Verification";
      newRulePayload.sections[0].assessments[0].sop_details = "Operational standard procedure for verifying execution.";
      newRulePayload.sections[0].assessments[0].mapped_org_types = addRuleModal.orgTypes;

      await addRuleToChapterApi(addRuleModal.chapterId, newRulePayload);
      setAddRuleModal({ open: false, chapterId: null, chapterTitle: "", ruleNarrative: "", samplePolicies: [], orgTypes: [] });
      await loadChapters(selectedAct);
    } catch (err) {
      alert("Error adding rule: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditRule = (chap, rule) => {
    setEditingContext({
      isEditingSingleRule: true,
      chapterId: chap.id,
      chapterTitle: chap.title,
      ruleId: rule.id
    });
    setBuilderChapterTitle(chap.title);
    setBuilderRules([{
      ...rule,
      sections: rule.sections?.length > 0 ? rule.sections.map(s => ({
        ...s,
        mapped_acts: withDefaultAct(s.mapped_acts, selectedAct),
        assessments: s.assessments?.length > 0 ? s.assessments.map(a => ({
          ...a,
          mapped_acts: a.mapped_acts?.length > 0 ? a.mapped_acts : [selectedAct]
        })) : [getBlankAssessment(selectedAct)]
      })) : [getBlankSection(selectedAct)]
    }]);
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const handleToggleHide = async (ruleId) => {
    try {
      await toggleRuleHideApi(ruleId);
      await loadChapters(selectedAct);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading && chapters.length === 0) {
    return (
      <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Synchronizing Rules Engine with Master Acts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ========================================================================= */}
      {/* 1. TOP ACT SELECTOR & CONTROLS                                            */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-600" /> Selected Master Act:
          </label>
          <select
            value={selectedAct}
            onChange={(e) => handleSelectAct(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden min-w-[280px]"
          >
            {masterActs.map((a) => (
              <option key={a.id} value={a.item_name}>
                {a.item_code ? `${a.item_code} - ${a.item_name}` : a.item_name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => resetBuilderForm(selectedAct)}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 self-end sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Clear / New Form
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. HIERARCHICAL LEGAL NODE BUILDER                                        */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="border-b border-slate-100 pb-3 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              {editingContext.isEditingSingleRule ? "Edit Rule Node" : "Hierarchical Legal Node Builder"}
            </h2>
            <p className="text-[11px] text-slate-500">Configured for Act: <strong>{selectedAct}</strong></p>
          </div>
          {editingContext.isEditingSingleRule && (
            <span className="bg-amber-50 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded border border-amber-200">
              Editing Rule in: {editingContext.chapterTitle} (Other rules preserved)
            </span>
          )}
        </div>

        {/* Assigned Act Banner & Chapter Title */}
        <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-800 block">Chapter / Part Title *</label>
            <span className="text-[11px] font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200">
              Assigned Act: {selectedAct}
            </span>
          </div>
          <input
            type="text"
            required
            disabled={editingContext.isEditingSingleRule}
            placeholder="e.g. Chapter II: Obligations of Data Fiduciary"
            value={builderChapterTitle}
            onChange={(e) => setBuilderChapterTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white font-semibold text-slate-800 disabled:bg-slate-100"
          />
        </div>

        {/* Rules Loop */}
        <div className="space-y-6">
          {builderRules.map((rule, rIdx) => (
            <div key={rIdx} className="bg-white rounded-xl border-2 border-blue-100 p-5 space-y-5 shadow-2xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="bg-blue-50 text-blue-700 font-extrabold text-[11px] px-2.5 py-1 rounded border border-blue-200">
                  RULE NO. {rule.rule_order || (rIdx + 1)}
                </span>
                {!editingContext.isEditingSingleRule && builderRules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(rIdx)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Rule
                  </button>
                )}
              </div>

              {/* Rule Narrative & Multi-Select Policies */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Rule Narrative Content *</label>
                  <textarea
                    rows={4}
                    placeholder="Write the complete rule paragraph here..."
                    value={rule.rule_narrative}
                    onChange={(e) => {
                      const copy = cloneRules();
                      copy[rIdx].rule_narrative = e.target.value;
                      setBuilderRules(copy);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs resize-y"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Sample Policies (Multi-Select) *</label>
                  <div className="p-3 border border-slate-300 rounded-lg space-y-2 max-h-32 overflow-y-auto bg-slate-50">
                    {samplePoliciesList.map((pol) => {
                      const isChecked = rule.sample_policies?.includes(pol.item_name);
                      return (
                        <label key={pol.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!isChecked}
                            onChange={() => handleToggleRulePolicy(rIdx, pol.item_name)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate">{pol.item_name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sections Under Rule */}
              <div className="space-y-4 pl-3 border-l-2 border-blue-400">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Sections Under Rule No. {rule.rule_order || (rIdx + 1)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleAddSection(e, rIdx)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded border border-blue-200"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Section
                  </button>
                </div>

                {rule.sections.map((sec, sIdx) => (
                  <div key={sIdx} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center pb-1">
                      <span className="text-xs font-bold text-blue-900 uppercase">Section #{sIdx + 1}</span>
                      {rule.sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSection(rIdx, sIdx)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" /> Remove Section
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Section Title / Number *</label>
                        <input
                          type="text"
                          placeholder="e.g. Section 5(1) - Notice of Collection"
                          value={sec.section_title}
                          onChange={(e) => {
                            const copy = cloneRules();
                            copy[rIdx].sections[sIdx].section_title = e.target.value;
                            setBuilderRules(copy);
                          }}
                          className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Section Act Mapping (Multi-Select)</label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-300 rounded-lg max-h-24 overflow-y-auto">
                          {masterActs.map((act) => {
                            const isDefaultAct = act.item_name === selectedAct;
                            const isActChecked = isDefaultAct || sec.mapped_acts?.includes(act.item_name);
                            return (
                              <button
                                type="button"
                                key={act.id}
                                disabled={isDefaultAct}
                                title={isDefaultAct ? "This is the Act the chapter was created under - always mapped" : undefined}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleToggleSectionAct(rIdx, sIdx, act.item_name);
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                                  isDefaultAct
                                    ? "bg-blue-600 text-white cursor-not-allowed opacity-90"
                                    : isActChecked
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {act.item_name}{isDefaultAct ? " (default)" : ""}
                              </button>
                            );
                          })}
                          {(sec.mapped_acts || [])
                            .filter(ma => !masterActs.some(act => act.item_name === ma))
                            .map((staleAct, sIdx2) => (
                              <button
                                type="button"
                                key={`stale-${sIdx2}`}
                                title="This value no longer matches any current Act - click to remove"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleToggleSectionAct(rIdx, sIdx, staleAct);
                                }}
                                className="text-[10px] font-bold px-2 py-0.5 rounded transition bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center gap-1"
                              >
                                {staleAct}
                                <X className="w-2.5 h-2.5" />
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Section Explanation *</label>
                      <textarea
                        rows={2}
                        placeholder="Detailed interpretation and obligations..."
                        value={sec.section_explanation}
                        onChange={(e) => {
                          const copy = cloneRules();
                          copy[rIdx].sections[sIdx].section_explanation = e.target.value;
                          setBuilderRules(copy);
                        }}
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white resize-y"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Practical Examples</label>
                      <textarea
                        rows={2}
                        placeholder="Real world implementation scenarios..."
                        value={sec.practical_examples}
                        onChange={(e) => {
                          const copy = cloneRules();
                          copy[rIdx].sections[sIdx].practical_examples = e.target.value;
                          setBuilderRules(copy);
                        }}
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white resize-y"
                      />
                    </div>

                    {/* Sub-sections, Paras, Sub-paras */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Sub-sections, Paragraphs &amp; Sub-paragraphs</span>
                        <button
                          type="button"
                          onClick={(e) => handleAddSubSection(e, rIdx, sIdx)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-0.5"
                        >
                          <PlusCircle className="w-3 h-3" /> Add Sub-section
                        </button>
                      </div>

                      {sec.sub_sections.map((sub, subIdx) => (
                        <div key={subIdx} className="space-y-2 border-l-2 border-slate-300 pl-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Sub-section..."
                              value={sub.title}
                              onChange={(e) => {
                                const copy = cloneRules();
                                copy[rIdx].sections[sIdx].sub_sections[subIdx].title = e.target.value;
                                setBuilderRules(copy);
                              }}
                              className="w-full border border-slate-300 rounded p-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleAddPara(e, rIdx, sIdx, subIdx)}
                              className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200 whitespace-nowrap"
                            >
                              + Para
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubSection(rIdx, sIdx, subIdx)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Delete Sub-section"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {sub.paragraphs?.map((p, pIdx) => (
                            <div key={pIdx} className="space-y-1.5 pl-3 border-l-2 border-slate-200">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Paragraph text..."
                                  value={p.text}
                                  onChange={(e) => {
                                    const copy = cloneRules();
                                    copy[rIdx].sections[sIdx].sub_sections[subIdx].paragraphs[pIdx].text = e.target.value;
                                    setBuilderRules(copy);
                                  }}
                                  className="w-full border border-slate-300 rounded p-1.5 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => handleAddSubPara(e, rIdx, sIdx, subIdx, pIdx)}
                                  className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-1 rounded border border-purple-200 whitespace-nowrap"
                                >
                                  + Sub-Para
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePara(rIdx, sIdx, subIdx, pIdx)}
                                  className="text-slate-400 hover:text-red-600 p-1"
                                  title="Delete Paragraph"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>

                              {p.sub_paragraphs?.map((sp, spIdx) => (
                                <div key={spIdx} className="pl-3 flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="Sub-paragraph text..."
                                    value={sp}
                                    onChange={(e) => {
                                      const copy = cloneRules();
                                      copy[rIdx].sections[sIdx].sub_sections[subIdx].paragraphs[pIdx].sub_paragraphs[spIdx] = e.target.value;
                                      setBuilderRules(copy);
                                    }}
                                    className="w-full border border-slate-300 rounded p-1 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSubPara(rIdx, sIdx, subIdx, pIdx, spIdx)}
                                    className="text-slate-400 hover:text-red-600 p-1"
                                    title="Delete Sub-paragraph"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Assessment & SOP Management */}
                    <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-4">
                      <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
                        <div>
                          <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide">
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Assessment &amp; SOP Management
                          </span>
                          <span className="text-[10px] text-emerald-600">Questions mapped to section → SOP details → Scheduled process rows</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleAddAssessment(e, rIdx, sIdx)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1 rounded flex items-center gap-1"
                        >
                          <PlusCircle className="w-3 h-3" /> Add Question / SOP
                        </button>
                      </div>

                      {sec.assessments?.map((ass, aIdx) => (
                        <div key={aIdx} className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-extrabold text-emerald-900 block">
                              {aIdx + 1}. ASSESSMENTS, SOPS &amp; PROCESSES
                            </span>
                            {sec.assessments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAssessment(rIdx, sIdx, aIdx)}
                                className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-0.5"
                              >
                                <Trash2 className="w-3 h-3" /> Remove Assessment
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Assessment Question *</label>
                            <textarea
                              rows={2}
                              placeholder="Write assessment checklist question..."
                              value={ass.question}
                              onChange={(e) => {
                                const copy = cloneRules();
                                copy[rIdx].sections[sIdx].assessments[aIdx].question = e.target.value;
                                setBuilderRules(copy);
                              }}
                              className="w-full border border-slate-300 rounded-lg p-2 text-xs resize-y"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">Mapped Acts (Multi-Select)</label>
                              <div className="flex flex-wrap gap-1 p-2 border border-slate-300 rounded bg-slate-50 max-h-24 overflow-y-auto">
                                {masterActs.map((act) => {
                                  const isChecked = ass.mapped_acts?.includes(act.item_name);
                                  return (
                                    <button
                                      type="button"
                                      key={act.id}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleToggleAssessmentAct(rIdx, sIdx, aIdx, act.item_name);
                                      }}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        isChecked ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                                      }`}
                                    >
                                      {act.item_name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">{departmentLabel} (Multi-Select)</label>
                              <div className="p-2 border border-slate-300 rounded bg-slate-50 space-y-1 max-h-24 overflow-y-auto">
                                {industriesList.map((ind) => {
                                  const isIndChecked = ass.industries?.includes(ind.item_name);
                                  return (
                                    <label key={ind.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!isIndChecked}
                                        onChange={() => handleToggleAssessmentIndustry(rIdx, sIdx, aIdx, ind.item_name)}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span className="truncate">{ind.item_name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">{processLabel}</label>
                              <select
                                value={ass.industry_process}
                                onChange={(e) => {
                                  const copy = cloneRules();
                                  copy[rIdx].sections[sIdx].assessments[aIdx].industry_process = e.target.value;
                                  setBuilderRules(copy);
                                }}
                                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                              >
                                <option value="">Select {processLabel}...</option>
                                {industryProcessesList.map((proc) => (
                                  <option key={proc.id} value={proc.item_name}>{proc.item_name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">{orgTypeLabel} (Multi-Select) *</label>
                            <div className="flex flex-wrap gap-1 p-2 border border-slate-300 rounded bg-slate-50 max-h-24 overflow-y-auto">
                              {orgTypesList.map((org) => {
                                const isOrgChecked = ass.mapped_org_types?.includes(org.item_name);
                                return (
                                  <button
                                    type="button"
                                    key={org.id}
                                    onClick={() => handleToggleAssessmentOrgType(rIdx, sIdx, aIdx, org.item_name)}
                                    className={`px-2 py-1 rounded text-[11px] font-semibold border transition ${
                                      isOrgChecked
                                        ? "bg-amber-600 text-white border-amber-600"
                                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                                    }`}
                                  >
                                    {org.item_name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">SOP Name *</label>
                            <input
                              type="text"
                              placeholder="e.g. SOP-01: Multi-Lingual Notice Verification"
                              value={ass.sop_name}
                              onChange={(e) => {
                                const copy = cloneRules();
                                copy[rIdx].sections[sIdx].assessments[aIdx].sop_name = e.target.value;
                                setBuilderRules(copy);
                              }}
                              className="w-full border border-slate-300 rounded p-1.5 text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">SOP Details &amp; Guidelines *</label>
                            <textarea
                              rows={2}
                              placeholder="Detailed step-by-step operating instructions..."
                              value={ass.sop_details}
                              onChange={(e) => {
                                const copy = cloneRules();
                                copy[rIdx].sections[sIdx].assessments[aIdx].sop_details = e.target.value;
                                setBuilderRules(copy);
                              }}
                              className="w-full border border-slate-300 rounded p-1.5 text-xs resize-y"
                            />
                          </div>

                          {/* Process Rows */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-bold text-slate-700 uppercase">Scheduled Execution Processes</span>
                              <button
                                type="button"
                                onClick={(e) => handleAddProcess(e, rIdx, sIdx, aIdx)}
                                className="text-emerald-700 text-xs font-bold flex items-center gap-0.5"
                              >
                                <PlusCircle className="w-3 h-3" /> Add Process
                              </button>
                            </div>

                            {ass.processes?.map((proc, pIdx) => (
                              <div key={pIdx} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-white p-2 rounded border border-slate-200 items-center">
                                <div className="md:col-span-5">
                                  <label className="text-[10px] font-bold text-slate-500 block">Process No. {pIdx + 1} Action</label>
                                  <input
                                    type="text"
                                    placeholder="Process narrative..."
                                    value={proc.action}
                                    onChange={(e) => {
                                      const copy = cloneRules();
                                      copy[rIdx].sections[sIdx].assessments[aIdx].processes[pIdx].action = e.target.value;
                                      setBuilderRules(copy);
                                    }}
                                    className="w-full border border-slate-300 rounded p-1 text-xs"
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <label className="text-[10px] font-bold text-slate-500 block">Task Name</label>
                                  <select
                                    value={proc.task_name}
                                    onChange={(e) => {
                                      const copy = cloneRules();
                                      const val = e.target.value;
                                      copy[rIdx].sections[sIdx].assessments[aIdx].processes[pIdx].task_name = val;
                                      if (val === "None") {
                                        copy[rIdx].sections[sIdx].assessments[aIdx].processes[pIdx].schedule = "None";
                                        copy[rIdx].sections[sIdx].assessments[aIdx].processes[pIdx].auto_tracking = false;
                                      }
                                      setBuilderRules(copy);
                                    }}
                                    className="w-full border border-slate-300 rounded p-1 text-xs bg-white"
                                  >
                                    <option value="None">None (No Task)</option>
                                    {tasksList.map((t) => (
                                      <option key={t.id} value={t.item_name}>{t.item_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="md:col-span-3 flex items-center gap-2">
                                  <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 block">Schedule</label>
                                    <select
                                      disabled={proc.task_name === "None"}
                                      value={proc.schedule}
                                      onChange={(e) => {
                                        const copy = cloneRules();
                                        copy[rIdx].sections[sIdx].assessments[aIdx].processes[pIdx].schedule = e.target.value;
                                        setBuilderRules(copy);
                                      }}
                                      className="w-full border border-slate-300 rounded p-1 text-xs bg-white disabled:bg-slate-100"
                                    >
                                      <option value="None">None</option>
                                      <option value="Daily">Daily</option>
                                      <option value="Weekly">Weekly</option>
                                      <option value="In 2 weeks">In 2 weeks</option>
                                      <option value="Monthly">Monthly</option>
                                      <option value="Every 3 months">Every 3 months</option>
                                      <option value="Quarterly">Quarterly</option>
                                      <option value="Yearly">Yearly</option>
                                    </select>
                                  </div>
                                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 pt-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      disabled={proc.task_name === "None"}
                                      checked={proc.auto_tracking}
                                      onChange={(e) => {
                                        const copy = cloneRules();
                                        copy[rIdx].sections[sIdx].assessments[aIdx].processes[pIdx].auto_tracking = e.target.checked;
                                        setBuilderRules(copy);
                                      }}
                                      className="rounded text-emerald-600"
                                    />
                                    <span>Auto</span>
                                  </label>
                                </div>
                                <div className="md:col-span-1 flex justify-end pt-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProcess(rIdx, sIdx, aIdx, pIdx)}
                                    className="text-slate-400 hover:text-red-600 p-1"
                                    title="Delete Process"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-3 border-t border-slate-100">
          {!editingContext.isEditingSingleRule ? (
            <button
              type="button"
              onClick={handleAddRule}
              className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1.5 bg-blue-50 px-3.5 py-2 rounded-lg border border-blue-200"
            >
              <PlusCircle className="w-4 h-4" /> Add Another Rule under this Chapter
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={handleSaveTree}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editingContext.isEditingSingleRule ? "Update Single Rule Node" : "Save Hierarchical Chapter & Rules"}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. LEGAL STRUCTURE EXPLORER                                               */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" /> Legal Structure Explorer
          </h2>
          <p className="text-[11px] text-slate-500">Chapters → Numbered Rules &amp; Sample Policies → Sections with Headings → SOP Workflows</p>
        </div>

        {/* Dynamic Master Act Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {masterActs.map((act) => (
            <button
              key={act.id}
              onClick={() => handleSelectAct(act.item_name)}
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

        {chapters.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic text-xs">
            No legal chapters found for <strong>{selectedAct}</strong>. Use the builder above to create and save one under this Act.
          </div>
        ) : (
          chapters.map((chap) => {
            const isChapExpanded = !!expandedChapters[chap.id];
            const rulesCount = chap.rules?.length || 0;
            let sectionsCount = 0;
            let subSectionsCount = 0;

            chap.rules?.forEach(r => {
              r.sections?.forEach(s => {
                if (s.section_title?.trim()) sectionsCount++;
                s.sub_sections?.forEach(sub => {
                  if (sub.title?.trim()) subSectionsCount++;
                });
              });
            });

            return (
              <div key={chap.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                {/* 1) Chapter Level Collapsible Banner */}
                <div
                  onClick={() => toggleChapterAccordion(chap.id)}
                  className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 cursor-pointer hover:bg-slate-800 transition select-none"
                >
                  <div className="flex items-center gap-2">
                    {isChapExpanded ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <h3 className="font-bold text-sm tracking-wide">{chap.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold" onClick={(e) => e.stopPropagation()}>
                    <span className="bg-slate-800 px-2.5 py-0.5 rounded text-slate-300">{rulesCount} Rules</span>
                    <span className="bg-blue-950 text-blue-300 px-2.5 py-0.5 rounded">{sectionsCount} Sections</span>
                    <span className="bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded">{subSectionsCount} Sub-sections</span>
                    <button
                      type="button"
                      onClick={() => handleOpenAddRuleModal(chap)}
                      className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-xs transition"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Add Rule to Chapter
                    </button>
                  </div>
                </div>

                {/* Chapter Rules */}
                {isChapExpanded && (
                  <div className="p-4 bg-slate-50/50 space-y-4">
                    {chap.rules?.map((rule, rIdx) => {
                      const isRuleExpanded = !!expandedRules[rule.id];
                      return (
                        <div
                          key={rule.id}
                          className={`bg-white rounded-xl border transition ${
                            rule.is_hidden ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
                          }`}
                        >
                          {/* 2) Rule Level Collapsible Header */}
                          <div
                            onClick={() => toggleRuleAccordion(rule.id)}
                            className="p-3.5 flex flex-wrap justify-between items-center gap-2 cursor-pointer hover:bg-slate-50 transition border-b border-slate-100 select-none"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {isRuleExpanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                              <span className="bg-blue-50 text-blue-700 font-extrabold text-xs px-2.5 py-0.5 rounded border border-blue-200">
                                RULE NO. {rule.rule_order || (rIdx + 1)}
                              </span>
                              <span className="font-bold text-xs text-slate-800">{chap.act_code}</span>

                              {rule.sample_policies?.map((pol, pIdx) => (
                                <span key={pIdx} className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  Policy: {pol}
                                </span>
                              ))}

                              {rule.is_hidden && (
                                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded">
                                  Hidden Rule
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleToggleHide(rule.id)}
                                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 border transition ${
                                  rule.is_hidden ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {rule.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                {rule.is_hidden ? "Unhide" : "Hide"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditRule(chap, rule)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Edit Rule
                              </button>
                            </div>
                          </div>

                          {/* Rule Body */}
                          {isRuleExpanded && (
                            <div className="p-4 space-y-4">
                              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                {rule.rule_narrative}
                              </p>

                              <div className="space-y-4 pt-1">
                                {rule.sections?.map((sec, sIdx) => (
                                  <div key={sec.id || sIdx} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                                    <div className="flex flex-wrap justify-between items-center gap-2">
                                      <h4 className="font-bold text-xs text-blue-800">
                                        SECTION: {sec.section_title}
                                      </h4>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Mapped Acts:</span>
                                        {withDefaultAct(sec.mapped_acts, chap.act_code).map((ma, mIdx) => (
                                          <span key={mIdx} className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            {ma}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    <div>
                                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">SECTION EXPLANATION</span>
                                      <p className="text-xs text-slate-700">{sec.section_explanation}</p>
                                    </div>

                                    {sec.practical_examples && (
                                      <div className="bg-amber-50/70 border-l-4 border-amber-400 p-2.5 rounded-r-lg">
                                        <span className="text-[11px] font-bold text-amber-900 block mb-0.5">Practical Examples:</span>
                                        <p className="text-xs text-amber-950">{sec.practical_examples}</p>
                                      </div>
                                    )}

                                    {/* Sub-sections View */}
                                    {sec.sub_sections?.map((sub, subIdx) => (
                                      sub.title ? (
                                        <div key={subIdx} className="space-y-1 pl-3 border-l-2 border-slate-300">
                                          <span className="text-[11px] font-bold text-purple-900 block">
                                            SUB SECTION: {sub.title}
                                          </span>
                                          {sub.paragraphs?.map((p, pIdx) => (
                                            p.text ? (
                                              <div key={pIdx} className="pl-3 space-y-0.5 text-xs text-slate-600">
                                                <div><strong className="text-slate-700">PARAGRAPH:</strong> {p.text}</div>
                                                {p.sub_paragraphs?.map((sp, spIdx) => (
                                                  sp ? <div key={spIdx} className="pl-3 text-[11px] text-slate-500"><strong className="text-slate-600">SUB PARAGRAPH:</strong> {sp}</div> : null
                                                ))}
                                              </div>
                                            ) : null
                                          ))}
                                        </div>
                                      ) : null
                                    ))}

                                    {/* Assessments, SOPs & Processes View */}
                                    {sec.assessments?.map((ass, aIdx) => (
                                      <div key={ass.id || aIdx} className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3 mt-3">
                                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-emerald-100 pb-2">
                                          <span className="text-xs font-extrabold text-emerald-900">
                                            {aIdx + 1}. ASSESSMENT, SOP, &amp; PROCESS
                                          </span>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {ass.industries?.map((ind, iIdx) => (
                                              <span key={iIdx} className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 uppercase">
                                                {departmentLabel.toUpperCase()}: {ind}
                                              </span>
                                            ))}
                                            {ass.industry_process && (
                                              <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase">
                                                {processLabel.toUpperCase()}: {ass.industry_process}
                                              </span>
                                            )}
                                            {ass.mapped_org_types?.map((org, oIdx) => (
                                              <span key={oIdx} className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 uppercase">
                                                {orgTypeLabel.toUpperCase()}: {org}
                                              </span>
                                            ))}
                                          </div>
                                        </div>

                                        <div>
                                          <span className="font-bold text-slate-800 text-xs">Question: </span>
                                          <span className="text-xs text-slate-700">{ass.question}</span>
                                        </div>

                                        <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 space-y-1">
                                          <div className="font-bold text-xs text-emerald-900">
                                            SOP: {ass.sop_name}
                                          </div>
                                          <p className="text-xs text-emerald-950 leading-relaxed">
                                            {ass.sop_details}
                                          </p>
                                        </div>

                                        {ass.processes && ass.processes.length > 0 && (
                                          <div className="space-y-1.5 pt-1">
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px] font-bold text-slate-500 uppercase px-2">
                                              <span className="md:col-span-2">Process Action</span>
                                              <span>Task Name</span>
                                              <span>Schedule / Auto-Tracking</span>
                                            </div>
                                            {ass.processes.map((proc, pIdx) => (
                                              <div key={pIdx} className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs items-center">
                                                <div className="md:col-span-2">
                                                  <span className="font-bold text-blue-700 block text-[11px]">Process No. {pIdx + 1}</span>
                                                  <span className="text-slate-700">{proc.action || "N/A"}</span>
                                                </div>
                                                <span className="text-slate-700 font-medium">{proc.task_name}</span>
                                                <div className="flex items-center justify-between pr-2">
                                                  <span className="font-bold text-slate-800">{proc.schedule}</span>
                                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    proc.auto_tracking ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                                                  }`}>
                                                    {proc.auto_tracking ? "Enabled" : "Disabled"}
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. STYLED IN-APP MODAL: ADD NEW RULE TO EXISTING CHAPTER                  */}
      {/* ========================================================================= */}
      {addRuleModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Add New Rule to Chapter</h3>
                  <span className="text-[11px] text-blue-600 font-medium block">
                    Under "{addRuleModal.chapterTitle}"
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddRuleModal({ open: false, chapterId: null, chapterTitle: "", ruleNarrative: "", samplePolicies: [], orgTypes: [] })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmAddRuleToChapter} className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Rule Narrative Content *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write the complete rule narrative paragraph here..."
                  value={addRuleModal.ruleNarrative}
                  onChange={(e) => setAddRuleModal({ ...addRuleModal, ruleNarrative: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden resize-y"
                />
              </div>

              {/* Multi-Select Policies */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Sample Policies (Multi-Select)
                </label>
                <div className="p-2.5 border border-slate-300 rounded-lg space-y-1.5 max-h-28 overflow-y-auto bg-slate-50">
                  {samplePoliciesList.map((pol) => {
                    const isChecked = addRuleModal.samplePolicies.includes(pol.item_name);
                    return (
                      <label key={pol.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleModalPolicy(pol.item_name)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{pol.item_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Select Organization Types */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {orgTypeLabel} (Multi-Select) *
                </label>
                <div className="p-2.5 border border-slate-300 rounded-lg space-y-1.5 max-h-28 overflow-y-auto bg-slate-50">
                  {orgTypesList.map((org) => {
                    const isChecked = addRuleModal.orgTypes.includes(org.item_name);
                    return (
                      <label key={org.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleModalOrgType(org.item_name)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="truncate">{org.item_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddRuleModal({ open: false, chapterId: null, chapterTitle: "", ruleNarrative: "", samplePolicies: [], orgTypes: [] })}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Rule to Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}