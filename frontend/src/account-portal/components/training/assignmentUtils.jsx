// Above 75 = green, 50 to 75 = orange, below 50 = red. Score only, no result label.
export function scoreColors(percent) {
  if (percent > 75) return { text: "text-green-700", bg: "bg-green-50", border: "border-green-200", ring: "ring-green-200", bar: "bg-green-500" };
  if (percent >= 50) return { text: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", ring: "ring-orange-200", bar: "bg-orange-500" };
  return { text: "text-red-600", bg: "bg-red-50", border: "border-red-200", ring: "ring-red-200", bar: "bg-red-500" };
}

// The API returns UTC timestamps without a zone marker; treat them as UTC so
// the browser shows the learner's local date and time.
export function parseUtc(value) {
  if (!value) return null;
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

export function formatDateTime(value) {
  const d = parseUtc(value);
  return d ? d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
}

export function ScorePill({ percent, className = "" }) {
  if (percent === null || percent === undefined) return <span className="text-slate-300">&mdash;</span>;
  const c = scoreColors(percent);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border} ${className}`}>
      {percent}%
    </span>
  );
}
