import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const PING_LIFETIME_MS = 2 * 60 * 60 * 1000; // a ping is live for two hours

// Query: is there an open ping for this person right now? Drives the banner, live.
export const current = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const latest = await ctx.db
      .query("pings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!latest) return null;
    if (latest.acknowledgedAt !== undefined) return null;
    if (Date.now() - latest.firedAt > PING_LIFETIME_MS) return null;
    return latest;
  },
});

// Internal mutation: the scheduled function itself. Writes the ping row; every
// subscribed browser sees it within a moment. Only the scheduler calls this.
export const fire = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return;
    await ctx.db.insert("pings", { userId, firedAt: Date.now() });
  },
});

// Internal mutation run by the hourly cron: for everyone whose window opens this
// hour, schedule a single ping at a random moment inside their window.
export const scheduleWindow = internalMutation({
  args: {},
  handler: async (ctx) => {
    const hour = new Date().getUTCHours();
    const users = await ctx.db.query("users").collect();
    let scheduled = 0;
    for (const user of users) {
      if (user.windowStart !== hour) continue;
      const windowMs = (user.windowEnd - user.windowStart) * 60 * 60 * 1000;
      const delay = Math.floor(Math.random() * windowMs);
      await ctx.scheduler.runAfter(delay, internal.pings.fire, { userId: user._id });
      scheduled += 1;
    }
    return scheduled;
  },
});

// Mutation for the stage: "ping me in N seconds". Same scheduler, same internal
// function, so the audience watches a scheduled function land in real time.
export const demoPing = mutation({
  args: { userId: v.id("users"), inSeconds: v.number() },
  // Explicit return type: this file schedules its own `internal.pings.fire`, and TypeScript
  // needs the annotation to break the circular inference.
  handler: async (ctx, { userId, inSeconds }): Promise<{ jobId: Id<"_scheduled_functions">; at: number }> => {
    const delay = Math.max(0, Math.min(inSeconds, 600)) * 1000;
    const jobId = await ctx.scheduler.runAfter(delay, internal.pings.fire, { userId });
    return { jobId, at: Date.now() + delay };
  },
});

// Mutation: dismiss the banner without posting.
export const acknowledge = mutation({
  args: { pingId: v.id("pings") },
  handler: async (ctx, { pingId }) => {
    await ctx.db.patch(pingId, { acknowledgedAt: Date.now() });
  },
});
