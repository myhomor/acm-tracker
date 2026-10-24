import { colors } from "../../theme/tokens";

export interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

interface DonutGaugeProps {
  segments: DonutSegment[];
  centerLabel: string;
}

export function DonutGauge({ segments, centerLabel }: DonutGaugeProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 80;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={200} height={200} viewBox="0 0 200 200" role="img" aria-label={centerLabel}>
      <circle cx={100} cy={100} r={r} fill="none" stroke={colors.surface2} strokeWidth={16} />
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        const dash = `${circumference * frac} ${circumference * (1 - frac)}`;
        const node = (
          <circle
            key={i}
            cx={100}
            cy={100}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={16}
            strokeDasharray={dash}
            strokeDashoffset={-circumference * offset}
            transform="rotate(-90 100 100)"
          />
        );
        offset += frac;
        return node;
      })}
      <text x={100} y={104} textAnchor="middle" className="mono" fill={colors.text} fontSize={24} fontWeight={700}>
        {centerLabel}
      </text>
    </svg>
  );
}
