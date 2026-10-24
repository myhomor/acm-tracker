import { StatTile } from "../StatTile";

export interface Tile {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function TileRow({ tiles, columns = 4 }: { tiles: Tile[]; columns?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}>
      {tiles.map((t) => (
        <StatTile key={t.label} label={t.label} value={t.value} sub={t.sub} accent={t.accent} />
      ))}
    </div>
  );
}
