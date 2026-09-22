import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Circle, ClipboardList, RotateCcw } from "lucide-react";
import { startAssignmentAttemptApi, saveAttemptAnswerApi, submitAttemptApi } from "../../services/trainingApi";
import { scoreColors, formatDateTime } from "./assignmentUtils.jsx";

// One question per page, then a review page listing every question with
// Back and Submit. Answers save as the learner picks them, so they can leave
// and come back; Submit stays disabled until every question is answered.
export default function AssignmentPlayer({ assignmentId, moduleName, onExit, onSubmitted }) {
  const [state, setState] = useState(null); // { attemptId, attemptNumber, assignment }
  const [answers, setAnswers] = useState({}); // { [questionId]: [optionId] }
  const [index, setIndex] = useState(0); // 0..n-1 = questions, n = review page
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await startAssignmentAttemptApi(assignmentId);
      setState({ attemptId: data.attempt_id, attemptNumber: data.attempt_number, assignment: data.assignment });
      const restored = {};
      Object.entries(data.answers || {}).forEach(([qid, opts]) => { restored[Number(qid)] = opts; });
      setAnswers(restored);
      const firstUnanswered = data.assignment.questions.findIndex((q) => !(restored[q.id] || []).length);
      setIndex(firstUnanswered === -1 ? data.assignment.questions.length : firstUnanswered);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Dev-mode double-mounting would otherwise call start twice at once.
  const startedFor = useRef(null);
  useEffect(() => {
    if (startedFor.current === assignmentId) return;
    startedFor.current = assignmentId;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#ff5a36]" /></div>;

  if (error && !state) {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded">{error}</div>
        <button onClick={onExit} className="text-xs font-bold text-[#ff5a36]">Back to course</button>
      </div>
    );
  }

  if (result) return <ResultCard result={result} onExit={onExit} onRetake={start} />;

  const { assignment, attemptId, attemptNumber } = state;
  const questions = assignment.questions;
  const total = questions.length;
  const onReview = index >= total;
  const answeredCount = questions.filter((q) => (answers[q.id] || []).length > 0).length;
  const allAnswered = answeredCount === total;

  const pick = async (question, optionId) => {
    const current = answers[question.id] || [];
    const next = question.question_type === "single"
      ? [optionId]
      : current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
    setAnswers((prev) => ({ ...prev, [question.id]: next }));
    setError("");
    try {
      await saveAttemptAnswerApi(attemptId, question.id, next);
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      setResult(await submitAttemptApi(attemptId));
      if (onSubmitted) onSubmitted();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-400 truncate">{moduleName}</div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#ff5a36] flex-shrink-0" />
            <h3 className="text-base font-bold text-slate-800 leading-snug">{assignment.title}</h3>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Attempt {attemptNumber}</div>
        </div>
        <button onClick={onExit} className="text-[11px] font-bold text-slate-400 hover:text-slate-700 flex-shrink-0">Save &amp; exit</button>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
          <span>{onReview ? "Review" : `Question ${index + 1} of ${total}`}</span>
          <span>{answeredCount}/{total} answered</span>
        </div>
        <div className="bg-slate-100 rounded-full h-1.5">
          <div className="bg-[#ff5a36] h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded mb-3">{error}</div>}

      {!onReview ? (
        <QuestionPage
          question={questions[index]}
          number={index + 1}
          selected={answers[questions[index].id] || []}
          onPick={(optionId) => pick(questions[index], optionId)}
        />
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-800 mb-1">Your answers</div>
          {questions.map((q, i) => {
            const done = (answers[q.id] || []).length > 0;
            return (
              <button
                key={q.id}
                onClick={() => setIndex(i)}
                className="w-full text-left flex items-start gap-2.5 border border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50"
              >
                {done ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700">{i + 1}. {q.question_text}</div>
                  <div className={`text-[11px] mt-0.5 ${done ? "text-slate-500" : "text-red-500 font-semibold"}`}>
                    {done
                      ? q.options.filter((o) => (answers[q.id] || []).includes(o.id)).map((o) => o.option_text).join(", ")
                      : "Not answered yet"}
                  </div>
                </div>
              </button>
            );
          })}
          {!allAnswered && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Every question must be answered before you can submit. Tap a question above to answer it.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex items-center gap-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {!onReview ? (
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="flex items-center gap-1 px-5 py-2.5 rounded-lg bg-[#ff5a36] text-white text-sm font-bold hover:bg-[#c8431f]"
          >
            {index === total - 1 ? "Review answers" : "Next"} <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionPage({ question, number, selected, onPick }) {
  const isMulti = question.question_type === "multi";
  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-bold text-slate-800 leading-snug">{number}. {question.question_text}</div>
        <div className="text-[11px] font-semibold text-slate-400 mt-1">{isMulti ? "Select all that apply" : "Select one answer"}</div>
      </div>
      <div className="space-y-2.5">
        {question.options.map((o) => {
          const checked = selected.includes(o.id);
          return (
            <label
              key={o.id}
              className={`flex items-center gap-3 border rounded-xl px-4 py-3.5 cursor-pointer transition-colors ${
                checked ? "border-[#ff5a36] bg-[#fff1ec] ring-1 ring-[#ffc7ae]" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type={isMulti ? "checkbox" : "radio"}
                name={`q-${question.id}`}
                checked={checked}
                onChange={() => onPick(o.id)}
                className="w-4 h-4 flex-shrink-0"
              />
              <span className="text-sm text-slate-700">{o.option_text}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({ result, onExit, onRetake }) {
  const c = scoreColors(result.score_percent);
  return (
    <div className="max-w-md mx-auto text-center py-6">
      <div className={`mx-auto w-40 h-40 rounded-full border-4 ${c.border} ${c.bg} flex flex-col items-center justify-center`}>
        <div className={`text-5xl font-bold ${c.text}`}>{result.score_percent}%</div>
      </div>
      <div className="mt-5 space-y-1 text-sm text-slate-600">
        <div><span className="text-slate-400">Submitted:</span> <span className="font-semibold">{formatDateTime(result.submitted_at)}</span></div>
        <div><span className="text-slate-400">Attempt:</span> <span className="font-semibold">{result.attempt_number}</span></div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-7">
        <button onClick={onExit} className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50">Back to course</button>
        <button onClick={onRetake} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#ff5a36] text-white text-sm font-bold hover:bg-[#c8431f]">
          <RotateCcw className="w-4 h-4" /> Retake
        </button>
      </div>
    </div>
  );
}
