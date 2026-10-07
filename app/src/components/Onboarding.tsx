import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLog } from "../lib/log";
import { Flame } from "./Icons";

const field =
  "w-full bg-surface border border-line rounded-2xl px-4 py-3.5 text-[16px] outline-none focus:border-ink transition placeholder:text-ink-3";

export function Onboarding({ onDone }: { onDone: (id: Id<"users">) => void }) {
  const create = useMutation(api.users.create);
  const { log } = useLog();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [windowStart, setWindowStart] = useState(18);
  const [windowEnd, setWindowEnd] = useState(22);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      log("mutation", "users.create", `${name.trim()} · ${city.trim()}`);
      onDone(await create({ name, city, windowStart, windowEnd }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+40px)] pb-8 gap-6">
      <div className="flex items-center gap-2 text-fire">
        <span className="w-9 h-9 rounded-xl bg-fire text-white grid place-items-center">
          <Flame className="w-5 h-5" />
        </span>
        <span className="font-extrabold tracking-tight">same excuse</span>
      </div>

      <div>
        <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-tight text-balance">
          People beating the excuse you're about to use.
        </h1>
        <p className="text-ink-2 mt-3 leading-relaxed">Thirty seconds, your face, one line. No account, no feed, five fires a day.</p>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Name</span>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required autoFocus placeholder="Marta" className={field} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-ink-2">City</span>
          <input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={32} placeholder="Gdańsk" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink-2">Ping me from</span>
            <select id="windowStart" value={windowStart} onChange={(e) => setWindowStart(Number(e.target.value))} className={field}>
              {hours.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink-2">until</span>
            <select id="windowEnd" value={windowEnd} onChange={(e) => setWindowEnd(Number(e.target.value))} className={field}>
              {hours.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-ink-3">One ping a day at a random moment in that window. UTC for now.</p>
      </div>

      {error && <p className="text-fire text-sm font-medium">{error}</p>}

      <div className="mt-auto">
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ink text-surface font-bold rounded-2xl py-4 text-[16px] hover:opacity-90 active:scale-[0.99] disabled:opacity-60 transition"
        >
          {busy ? "One sec…" : "Let's go"}
        </button>
      </div>
    </form>
  );
}
