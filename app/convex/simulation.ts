import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { EXCUSE_KEYS } from "./excuses";
import { PEOPLE, SENTENCES } from "./seed";

// The room, alive: a function that posts a card as a seeded person, then schedules
// itself again. One row in `simulation` holds the switch and the job id, so any
// window can start or stop it and every window sees the same state.

async function getState(ctx: QueryCtx | MutationCtx): Promise<Doc<"simulation"> | null> {
  return await ctx.db.query("simulation").first();
}

// Seeded people: flagged by seed.ts, or matching its list (rows seeded before the flag existed).
function isSeeded(u: Doc<"users">): boolean {
  return u.seeded === true || PEOPLE.some((p) => p.name === u.name && p.city === u.city);
}

// Query: the switch, live. The panel renders from this.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const state = await getState(ctx);
    const seededCount = (await ctx.db.query("users").collect()).filter(isSeeded).length;
    return {
      running: state?.running ?? false,
      intervalSeconds: state?.intervalSeconds ?? 6,
      posted: state?.posted ?? 0,
      fired: state?.fired ?? 0,
      startedAt: state?.startedAt ?? null,
      seededCount,
    };
  },
});

// Mutation: flip the switch. Starting schedules the first tick; stopping cancels the pending one.
export const setRunning = mutation({
  args: { running: v.boolean(), intervalSeconds: v.optional(v.number()) },
  handler: async (ctx, { running, intervalSeconds }): Promise<{ running: boolean; intervalSeconds: number }> => {
    const interval = Math.max(2, Math.min(intervalSeconds ?? 6, 60));
    let state = await getState(ctx);
    if (!state) {
      const id = await ctx.db.insert("simulation", { running: false, intervalSeconds: interval, posted: 0, fired: 0 });
      state = (await ctx.db.get(id))!;
    }

    if (state.jobId) {
      // Cancelling a job that already ran is harmless.
      await ctx.scheduler.cancel(state.jobId);
    }

    if (running) {
      const jobId = await ctx.scheduler.runAfter(500, internal.simulation.tick, {});
      await ctx.db.patch(state._id, {
        running: true,
        intervalSeconds: interval,
        jobId,
        startedAt: state.running ? state.startedAt : Date.now(),
        posted: state.running ? state.posted : 0,
        fired: state.running ? state.fired : 0,
      });
    } else {
      await ctx.db.patch(state._id, { running: false, intervalSeconds: interval, jobId: undefined });
    }
    return { running, intervalSeconds: interval };
  },
});

// Internal mutation: one beat of the room. Post a card, sometimes give a fire, reschedule.
// Explicit return type because this file schedules its own function.
export const tick = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const state = await getState(ctx);
    if (!state || !state.running) return;

    const people = (await ctx.db.query("users").collect()).filter(isSeeded);
    if (people.length === 0) {
      await ctx.db.patch(state._id, { running: false, jobId: undefined });
      return;
    }

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const poster = pick(people);
    const excuse = pick(EXCUSE_KEYS);
    const sentence = pick(SENTENCES[excuse] ?? ["Did the thirty seconds. That is all."]);
    await ctx.db.insert("cards", {
      userId: poster._id,
      excuse,
      sentence,
      fireCount: 0,
      createdAt: Date.now(),
    });
    let fired = state.fired;

    // Half the time, someone in the room gives a fire to a recent card that is not theirs.
    if (Math.random() < 0.5) {
      const giver = pick(people);
      const recent = await ctx.db.query("cards").order("desc").take(12);
      const target = recent.find((c) => c.userId !== giver._id);
      if (target && giver.firesLeft > 0) {
        const already = await ctx.db
          .query("fires")
          .withIndex("by_card_user", (q) => q.eq("cardId", target._id).eq("userId", giver._id))
          .unique();
        if (!already) {
          await ctx.db.insert("fires", { cardId: target._id, userId: giver._id, createdAt: Date.now() });
          await ctx.db.patch(target._id, { fireCount: target.fireCount + 1 });
          await ctx.db.patch(giver._id, { firesLeft: giver.firesLeft - 1 });
          fired += 1;
        }
      }
    }

    // A little jitter so it feels like people, not a metronome.
    const base = state.intervalSeconds * 1000;
    const delay = Math.round(base * (0.6 + Math.random() * 0.8));
    const jobId: Id<"_scheduled_functions"> = await ctx.scheduler.runAfter(delay, internal.simulation.tick, {});
    await ctx.db.patch(state._id, { posted: state.posted + 1, fired, jobId });
  },
});
