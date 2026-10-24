import { colors } from "../../theme/tokens";

interface GaugeProps {
  value: number;
  target: number;
  label: string;
}

export function Gauge({ value, target, label }: GaugeProps) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const r = 80;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={200} height={200} viewBox="0 0 200 200" role="img" aria-label={`${label}: ${value} of ${target}`}>
      <circle cx={100} cy={100} r={r} fill="none" stroke={colors.surface2} strokeWidth={14} />
      <circle
        cx={100}
        cy={100}
        r={r}
        fill="none"
        stroke={colors.coral}
        strokeWidth={14}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
      />
      <text x={100} y={96} textAnchor="middle" className="mono" fill={colors.text} fontSize={28} fontWeight={700}>
        {`$${value.toLocaleString()}`}
      </text>
      <text x={100} y={120} textAnchor="middle" className="mono" fill={colors.muted} fontSize={12}>
        {label}
      </text>
    </svg>
  );
}
