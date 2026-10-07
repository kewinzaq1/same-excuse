import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EXCUSES, excuseLabel } from "../../convex/excuses";
import { ago, useNow } from "../lib/time";
import { useLog } from "../lib/log";
import { Cross, Flame } from "./Icons";

type Props = { excuse: string; userId: Id<"users">; counts: Record<string, number> | undefined; onPick: (key: string) => void };

const HUES = [14, 32, 152, 200, 262, 320, 42, 180];
function hueFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function Deck({ excuse, userId, counts, onPick }: Props) {
  const { log } = useLog();
  const now = useNow();
  const cards = useQuery(api.cards.list, { excuse, viewerId: userId });

  // Optimistic update: fire count and my fires-left move before the server answers.
  const give = useMutation(api.fires.give).withOptimisticUpdate((store, { cardId }) => {
    const list = store.getQuery(api.cards.list, { excuse, viewerId: userId });
    if (list) {
      store.setQuery(
        api.cards.list,
        { excuse, viewerId: userId },
        list.map((c) => (c._id === cardId ? { ...c, fireCount: c.fireCount + 1, firedByMe: true } : c)),
      );
    }
    const me = store.getQuery(api.users.get, { userId });
    if (me) store.setQuery(api.users.get, { userId }, { ...me, firesLeft: Math.max(0, me.firesLeft - 1) });
  });

  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    log("query", "cards.list", `subscribed · excuse=${excuse}`);
    setSkipped(new Set());
    seen.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excuse]);

  useEffect(() => {
    if (!cards) return;
    const first = seen.current.size === 0;
    for (const c of cards) {
      if (!seen.current.has(c._id)) {
        seen.current.add(c._id);
        if (!first) {
          log("query", "cards.list", `pushed a new card from ${c.who}`);
          setFresh(c._id);
          setTimeout(() => setFresh(null), 900);
        }
      }
    }
  }, [cards, log]);

  // Drag on the top card.
  const [drag, setDrag] = useState<{ dx: number; active: boolean }>({ dx: 0, active: false });
  const start = useRef(0);

  const visible = (cards ?? []).filter((c) => !skipped.has(c._id));
  const top = visible[0];

  function skip() {
    if (!top) return;
    setSkipped((s) => new Set(s).add(top._id));
    setDrag({ dx: 0, active: false });
  }

  async function fire() {
    if (!top || top.isMine || top.firedByMe) return;
    setError(null);
    setPopping(true);
    setTimeout(() => setPopping(false), 400);
    try {
      log("mutation", "fires.give", `card by ${top.who} · optimistic`);
      await give({ userId, cardId: top._id });
      setTimeout(() => setSkipped((s) => new Set(s).add(top._id)), 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setError(null), 2600);
    }
    setDrag({ dx: 0, active: false });
  }

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    start.current = e.clientX;
    setDrag({ dx: 0, active: true });
  }
  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.active) return;
    setDrag({ dx: e.clientX - start.current, active: true });
  }
  function onUp() {
    if (!drag.active) return;
    if (drag.dx > 90) void fire();
    else if (drag.dx < -90) skip();
    else setDrag({ dx: 0, active: false });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Excuse picker */}
      <div className="px-5 pt-1 pb-3">
        <p className="text-xs font-semibold text-ink-2 mb-2">Which one is talking right now?</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {EXCUSES.map((e) => {
            const active = e.key === excuse;
            const n = counts?.[e.key] ?? 0;
            return (
              <button
                key={e.key}
                onClick={() => onPick(e.key)}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active ? "bg-ink text-surface" : "bg-surface border border-line text-ink hover:border-ink-3"
                }`}
              >
                {e.label}
                <span className={`tnum text-xs ${active ? "text-surface/70" : "text-ink-3"}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Card stack */}
      <div className="flex-1 min-h-0 px-5 pb-2">
        <div className="relative h-full min-h-[420px]">
          {cards === undefined && <div className="absolute inset-0 rounded-[28px] bg-surface border border-line animate-pulse" />}
          {cards && visible.length === 0 && (
            <div className="absolute inset-0 rounded-[28px] bg-surface border border-line grid place-items-center text-center p-8">
              <div>
                <p className="font-bold text-lg">{cards.length === 0 ? "Nobody yet today" : "You've seen everyone"}</p>
                <p className="text-ink-2 text-sm mt-1">
                  {cards.length === 0
                    ? `Be the first to beat “${excuseLabel(excuse)}”.`
                    : "New cards land here the moment they're posted."}
                </p>
              </div>
            </div>
          )}
          {visible
            .slice(0, 3)
            .map((c, i) => {
              const isTop = i === 0;
              const dx = isTop ? drag.dx : 0;
              const rot = dx / 20;
              return (
                <div
                  key={c._id}
                  onPointerDown={isTop ? onDown : undefined}
                  onPointerMove={isTop ? onMove : undefined}
                  onPointerUp={isTop ? onUp : undefined}
                  onPointerCancel={isTop ? onUp : undefined}
                  style={{
                    transform: `translate(${dx}px, ${i * 10}px) rotate(${rot}deg) scale(${1 - i * 0.04})`,
                    zIndex: 10 - i,
                    transition: drag.active && isTop ? "none" : "transform .35s cubic-bezier(.2,.8,.2,1)",
                    touchAction: "pan-y",
                  }}
                  className={`absolute inset-0 rounded-[28px] overflow-hidden bg-surface shadow-card select-none ${isTop ? "cursor-grab active:cursor-grabbing" : ""} ${
                    fresh === c._id ? "card-in" : ""
                  }`}
                >
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div
                      className="absolute inset-0 grid place-items-center"
                      style={{ background: `linear-gradient(160deg, hsl(${hueFor(c.who)} 70% 82%), hsl(${hueFor(c.who) + 30} 60% 62%))` }}
                    >
                      <span className="text-[120px] font-extrabold text-white/70 leading-none">{c.who.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 top-0 p-4 flex items-start justify-between">
                    <span className="rounded-full bg-black/35 backdrop-blur text-white text-xs font-semibold px-2.5 py-1">
                      {c.who}
                      {c.where ? ` · ${c.where}` : ""}
                    </span>
                    <span className={`rounded-full backdrop-blur text-xs font-semibold px-2.5 py-1 tnum ${ago(c.createdAt, now) === "just now" ? "bg-fire text-white" : "bg-black/35 text-white"}`}>
                      {ago(c.createdAt, now)}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5 pt-16 bg-gradient-to-t from-black/75 via-black/35 to-transparent text-white">
                    <p className="text-[22px] font-bold leading-tight text-balance">{c.sentence}</p>
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-white/80">
                      <span>beat: {excuseLabel(c.excuse).toLowerCase()}</span>
                      <span className={`inline-flex items-center gap-1 tnum ${c.fireCount > 0 ? "text-white" : ""}`}>
                        <Flame className="w-3.5 h-3.5" /> {c.fireCount}
                      </span>
                    </div>
                  </div>
                  {isTop && dx > 40 && (
                    <div className="absolute top-14 left-5 rotate-[-12deg] rounded-xl border-4 border-fire text-fire font-extrabold text-2xl px-3 py-1 bg-white/80">FIRE</div>
                  )}
                  {isTop && dx < -40 && (
                    <div className="absolute top-14 right-5 rotate-[12deg] rounded-xl border-4 border-white text-white font-extrabold text-2xl px-3 py-1 bg-black/40">NEXT</div>
                  )}
                  {c.firedByMe && (
                    <div className="absolute top-14 right-4 w-10 h-10 rounded-full bg-fire text-white grid place-items-center shadow-float">
                      <Flame className="w-5 h-5" />
                    </div>
                  )}
                </div>
              );
            })
            .reverse()}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 pt-2">
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={skip}
            disabled={!top}
            aria-label="Next"
            className="w-14 h-14 rounded-full bg-surface border border-line text-ink-2 grid place-items-center shadow-card hover:border-ink-3 active:scale-95 disabled:opacity-40 transition"
          >
            <Cross className="w-6 h-6" />
          </button>
          <button
            onClick={fire}
            disabled={!top || top.firedByMe || top.isMine}
            aria-label="Give fire"
            className={`w-[72px] h-[72px] rounded-full bg-fire text-white grid place-items-center shadow-float hover:brightness-105 active:scale-95 disabled:opacity-40 transition ${popping ? "pop" : ""}`}
          >
            <Flame className="w-8 h-8" />
          </button>
        </div>
        <p className="text-center text-xs text-ink-3 mt-3 tnum min-h-[1.2em]">
          {error ? <span className="text-fire font-semibold">{error}</span> : top?.isMine ? "That's your card." : `${visible.length} left · swipe or tap`}
        </p>
      </div>
    </div>
  );
}
