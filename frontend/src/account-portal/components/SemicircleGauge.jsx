import React from "react";

// score: 0-100, or null when there's no Yes/No data to compute a ratio from.
export default function SemicircleGauge({ score, size = 160, strokeWidth = 16 }) {
  const radius = size / 2 - strokeWidth;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius;
  const pct = score ?? 0;
  const dash = (pct / 100) * circumference;

  const color =
    score == null ? "#94a3b8" : score >= 80 ? "#059669" : score >= 50 ? "#d97706" : "#dc2626";

  const arcPath = `M ${strokeWidth} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${cy}`;

  return (
    <svg width={size} height={size / 2 + strokeWidth / 2} viewBox={`0 0 ${size} ${size / 2 + strokeWidth / 2}`}>
      <path d={arcPath} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path
        d={arcPath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
      />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="font-bold"
        style={{ fontSize: size * 0.16 }}
        fill="#1e293b"
      >
        {score == null ? "—" : `${score}%`}
      </text>
    </svg>
  );
}
