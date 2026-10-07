import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLog, type LogKind } from "../lib/log";

const KIND_STYLE: Record<LogKind, string> = {
  query: "bg-ok-soft text-ok",
  mutation: "bg-fire-soft text-fire",
  action: "bg-ink text-surface",
  scheduled: "bg-[#efe6ff] text-[#6b3fd6]",
  storage: "bg-[#e3f0ff] text-[#1f63c8]",
  cron: "bg-line text-ink-2",
};

const PRIMITIVES: { kind: LogKind; name: string; what: string }[] = [
  { kind: "query", name: "Queries", what: "Read-only, cached, subscribed. The deck, the counts and your fires-left. When a write changes what they read, every subscriber gets the new result pushed." },
  { kind: "mutation", name: "Mutations", what: "Transactions. Posting a card and giving a fire read, check and write atomically. Two people cannot both take the last fire." },
  { kind: "action", name: "Actions", what: "Non-transactional, may call the outside world. \"Tidy it up\" runs in Node and calls the Anthropic API." },
  { kind: "storage", name: "File storage", what: "The photo goes to a one-time upload URL, the mutation keeps the file id, the query turns it back into a URL." },
  { kind: "scheduled", name: "Scheduler", what: "ctx.scheduler.runAfter queues an internal mutation. The ping banner is one landing. The room is one that reschedules itself." },
  { kind: "cron", name: "Crons", what: "Declared in convex/crons.ts. Fires reset at 00:00 UTC. Pings are scheduled hourly for everyone whose window opens." },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 border-b border-line grid gap-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

function Chip({ kind, children }: { kind: LogKind; children: React.ReactNode }) {
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold ${KIND_STYLE[kind]}`}>{children}</span>;
}

function RoomToggle() {
  const { log } = useLog();
  const sim = useQuery(api.simulation.get);
  const setRunning = useMutation(api.simulation.setRunning);
  const [interval, setInterval_] = useState<number | null>(null);
  const seconds = interval ?? sim?.intervalSeconds ?? 6;

  useEffect(() => {
    log("query", "simulation.get", "subscribed · the room's switch");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    if (!sim) return;
    const next = !sim.running;
    log("mutation", "simulation.setRunning", next ? `start · every ~${seconds}s · runAfter → internal.simulation.tick` : "stop · scheduler.cancel(jobId)");
    await setRunning({ running: next, intervalSeconds: seconds });
  }

  async function pickInterval(s: number) {
    setInterval_(s);
    if (sim?.running) await setRunning({ running: true, intervalSeconds: s });
  }

  const noPeople = sim !== undefined && sim.seededCount === 0;

  return (
    <div className="rounded-2xl border border-line p-4 grid gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-sm">The room, posting live</p>
          <p className="text-xs text-ink-2">
            {noPeople ? "No seeded people. Run npm run seed." : `${sim?.seededCount ?? 0} seeded people post on the scheduler, not in this tab.`}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={!sim || noPeople}
          role="switch"
          aria-checked={!!sim?.running}
          className={`relative w-12 h-7 rounded-full transition disabled:opacity-40 ${sim?.running ? "bg-ok" : "bg-line"}`}
        >
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-surface shadow transition ${sim?.running ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        {[3, 6, 15].map((s) => (
          <button
            key={s}
            onClick={() => pickInterval(s)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${seconds === s ? "bg-ink text-surface" : "bg-bg text-ink-2 hover:bg-line"}`}
          >
            ~{s}s
          </button>
        ))}
        {sim && (sim.running || sim.posted > 0) && (
          <span className="ml-auto text-xs text-ink-3 tnum">
            {sim.posted} posted · {sim.fired} fires
          </span>
        )}
      </div>
    </div>
  );
}

export function ConvexPanel({ userId }: { userId: Id<"users"> }) {
  const { entries, log } = useLog();
  const demoPing = useMutation(api.pings.demoPing);
  const [pingAt, setPingAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  async function schedule(seconds: number) {
    log("scheduled", "pings.demoPing", `runAfter(${seconds}s, internal.pings.fire)`);
    const { at } = await demoPing({ userId, inSeconds: seconds });
    setPingAt(at);
  }
  const remaining = pingAt ? Math.max(0, Math.ceil((pingAt - now) / 1000)) : null;

  return (
    <div className="text-ink">
      <Section title="Live controls">
        <RoomToggle />
        <div className="rounded-2xl border border-line p-4 grid gap-2">
          <p className="font-bold text-sm">Scheduled function</p>
          <p className="text-xs text-ink-2">Queue a ping for yourself and watch the banner land.</p>
          <div className="flex items-center gap-2">
            <button onClick={() => schedule(10)} className="rounded-full bg-ink text-surface text-xs font-semibold px-3 py-1.5 hover:opacity-90 transition">
              Ping me in 10 s
            </button>
            <button onClick={() => schedule(30)} className="rounded-full bg-bg text-ink-2 text-xs font-semibold px-3 py-1.5 hover:bg-line transition">
              30 s
            </button>
            {remaining !== null && <span className="ml-auto text-xs text-ink-3 tnum">{remaining > 0 ? `lands in ${remaining}s` : "landed"}</span>}
          </div>
        </div>
      </Section>

      <Section title="What's running">
        <ul className="grid gap-2 max-h-56 overflow-auto">
          {entries.length === 0 && <li className="text-xs text-ink-3">Nothing yet.</li>}
          {entries.map((e) => (
            <li key={e.id} className="grid grid-cols-[auto_1fr] gap-2 items-start text-xs fade-up">
              <Chip kind={e.kind}>{e.kind}</Chip>
              <span className="leading-relaxed">
                <span className="font-semibold">{e.name}</span>
                {e.detail && <span className="text-ink-3"> · {e.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="The six primitives">
        <ul className="grid gap-3">
          {PRIMITIVES.map((p) => (
            <li key={p.name} className="grid gap-1">
              <Chip kind={p.kind}>{p.name}</Chip>
              <span className="text-xs text-ink-2 leading-relaxed">{p.what}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
