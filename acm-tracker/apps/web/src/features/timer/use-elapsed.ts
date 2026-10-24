import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

export function useElapsed(startedAt: string | null | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "00:00:00";
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
