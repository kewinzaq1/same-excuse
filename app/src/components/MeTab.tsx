import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { excuseLabel } from "../../convex/excuses";
import { ago, useNow } from "../lib/time";
import { Flame } from "./Icons";

type Props = { userId: Id<"users">; user: Doc<"users">; signOut: () => void };

export function MeTab({ userId, user, signOut }: Props) {
  const mine = useQuery(api.cards.mine, { userId });
  const now = useNow();
  const pad = (h: number) => String(h).padStart(2, "0");

  return (
    <div className="px-5 pb-6 flex flex-col gap-5">
      <div className="flex items-center gap-4 pt-1">
        <div className="w-16 h-16 rounded-full bg-ink text-surface grid place-items-center text-2xl font-extrabold">{user.name.charAt(0)}</div>
        <div>
          <p className="text-xl font-extrabold tracking-tight">{user.name}</p>
          <p className="text-ink-2 text-sm">{user.city || "Somewhere"}</p>
        </div>
      </div>

      <div className="rounded-3xl bg-surface border border-line p-4 grid gap-3">
        <div className="flex items-center justify-between">
          <p className="font-bold">Fires today</p>
          <span className="text-sm text-ink-2 tnum">{user.firesLeft} of 5 left</span>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`flex-1 h-10 rounded-xl grid place-items-center transition ${i < user.firesLeft ? "bg-fire text-white" : "bg-bg text-ink-3"}`}
            >
              <Flame className="w-5 h-5" />
            </span>
          ))}
        </div>
        <p className="text-xs text-ink-3">They come back at midnight. Five is on purpose: one has to mean something.</p>
      </div>

      <div className="rounded-3xl bg-surface border border-line p-4 flex items-center justify-between">
        <div>
          <p className="font-bold">Daily ping</p>
          <p className="text-sm text-ink-2">
            Some moment between {pad(user.windowStart)}:00 and {pad(user.windowEnd)}:00
          </p>
        </div>
        <span className="text-xs font-semibold rounded-full bg-ok-soft text-ok px-2.5 py-1">on</span>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-bold">Your cards</p>
          <span className="text-sm text-ink-2 tnum">{mine?.length ?? 0}</span>
        </div>
        {mine === undefined && <div className="h-16 rounded-2xl bg-surface border border-line animate-pulse" />}
        {mine && mine.length === 0 && (
          <div className="rounded-2xl bg-surface border border-line p-4 text-sm text-ink-2">Nothing yet. Post your first thirty seconds.</div>
        )}
        <ul className="grid gap-2">
          {mine?.map((c) => (
            <li key={c._id} className="rounded-2xl bg-surface border border-line p-4 flex items-start gap-3">
              {c.imageUrl ? (
                <img src={c.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <span className="w-12 h-12 rounded-xl bg-bg shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{c.sentence}</p>
                <p className="text-xs text-ink-3 mt-1">
                  beat: {excuseLabel(c.excuse).toLowerCase()} · {ago(c.createdAt, now)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-fire tnum shrink-0">
                <Flame className="w-4 h-4" /> {c.fireCount}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button onClick={signOut} className="text-sm text-ink-3 hover:text-ink underline underline-offset-4 self-start">
        Leave this device
      </button>
    </div>
  );
}
