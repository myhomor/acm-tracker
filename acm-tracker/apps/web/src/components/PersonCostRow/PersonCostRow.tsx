import { Avatar } from "../Avatar";
import { colors } from "../../theme/tokens";

interface PersonCostRowProps {
  initials: string;
  index: number;
  name: string;
  meta: string;
  cost: string;
}

export function PersonCostRow({ initials, index, name, meta, cost }: PersonCostRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${colors.border}` }}>
      <Avatar initials={initials} index={index} />
      <div style={{ marginLeft: 12, flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{name}</div>
        <div className="mono" style={{ fontSize: 11, color: colors.muted }}>{meta}</div>
      </div>
      <span className="mono" style={{ fontWeight: 700 }}>{cost}</span>
    </div>
  );
}
