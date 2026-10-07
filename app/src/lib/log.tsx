import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// A tiny event log so the "What Convex is doing" panel can narrate the demo.
export type LogKind = "query" | "mutation" | "action" | "scheduled" | "storage" | "cron";

export type LogEntry = {
  id: number;
  at: number;
  kind: LogKind;
  name: string;
  detail?: string;
};

type LogApi = {
  entries: LogEntry[];
  log: (kind: LogKind, name: string, detail?: string) => void;
};

const LogContext = createContext<LogApi | null>(null);

let nextId = 1;

export function LogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const log = useCallback((kind: LogKind, name: string, detail?: string) => {
    setEntries((prev) => [{ id: nextId++, at: Date.now(), kind, name, detail }, ...prev].slice(0, 40));
  }, []);
  const value = useMemo(() => ({ entries, log }), [entries, log]);
  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}

export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLog must be used inside LogProvider");
  return ctx;
}
