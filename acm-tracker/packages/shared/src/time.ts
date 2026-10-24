const pad = (n: number): string => String(n).padStart(2, "0");

export function localHourMinute(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDayBounds(isoDate: string): { from: Date; to: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const from = new Date(y, m - 1, d);
  if (from.getMonth() !== m - 1 || from.getDate() !== d) return null;
  return { from, to: new Date(y, m - 1, d + 1) };
}
