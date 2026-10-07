import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EXCUSES } from "../../convex/excuses";
import { useLog } from "../lib/log";
import { Flame } from "./Icons";

type Props = { userId: Id<"users">; excuse: string; onPost: () => void };

export function PingBanner({ userId, excuse, onPost }: Props) {
  const { log } = useLog();
  const ping = useQuery(api.pings.current, { userId });
  const acknowledge = useMutation(api.pings.acknowledge);

  useEffect(() => {
    if (ping) log("scheduled", "internal.pings.fire", "landed → pings.current pushed the banner");
  }, [ping, log]);

  if (!ping) return null;
  const turn = EXCUSES.find((e) => e.key === excuse)?.turn ?? "Now it is your turn.";

  return (
    <div className="mx-4 mb-3 rounded-2xl bg-fire text-white p-4 flex items-center gap-3 shadow-float slide-down">
      <span className="w-10 h-10 rounded-full bg-white/20 grid place-items-center shrink-0">
        <Flame className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white/80">Now. Your thirty seconds.</p>
        <p className="font-bold leading-tight">{turn} Then you're the card.</p>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button onClick={onPost} className="rounded-full bg-white text-fire text-sm font-bold px-3.5 py-1.5 hover:bg-white/90 transition">
          Post
        </button>
        <button
          onClick={() => {
            log("mutation", "pings.acknowledge");
            void acknowledge({ pingId: ping._id });
          }}
          className="text-xs font-semibold text-white/80 hover:text-white"
        >
          Later
        </button>
      </div>
    </div>
  );
}
