import { colors } from "../../theme/tokens";

interface RingGaugeProps {
  total: number;
  target: number;
  aiFraction: number;
  caption: string;
  size?: number;
}

export function RingGauge({ total, target, aiFraction, caption, size = 260 }: RingGaugeProps) {
  const pct = target > 0 ? Math.min(total / target, 1) : 0;
  const rOuter = 86;
  const rInner = 64;
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;
  return (
    <svg width={size} height={size} viewBox="0 0 260 260" role="img" aria-label={`${caption}: ${total} of ${target}`}>
      <circle cx={130} cy={130} r={rOuter} fill="none" stroke={colors.surface2} strokeWidth={16} />
      <circle cx={130} cy={130} r={rOuter} fill="none" stroke={colors.coral} strokeWidth={16}
        strokeDasharray={cOuter} strokeDashoffset={cOuter * (1 - pct)} strokeLinecap="round" transform="rotate(-90 130 130)" />
      <circle cx={130} cy={130} r={rInner} fill="none" stroke={colors.surface2} strokeWidth={8} />
      <circle cx={130} cy={130} r={rInner} fill="none" stroke={colors.blue} strokeWidth={8}
        strokeDasharray={cInner} strokeDashoffset={cInner * (1 - Math.min(aiFraction, 1))} strokeLinecap="round" transform="rotate(-90 130 130)" />
      <text x={130} y={126} textAnchor="middle" className="mono" fill={colors.text} fontSize={44} fontWeight={700}>
        {`$${total.toLocaleString("en-US")}`}
      </text>
      <text x={130} y={152} textAnchor="middle" className="mono" fill={colors.coral} fontSize={14}>
        {`${Math.round(pct * 100)}%`}
      </text>
      <text x={130} y={172} textAnchor="middle" fill={colors.dim} fontSize={11}>{caption}</text>
    </svg>
  );
}
