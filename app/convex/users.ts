import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const FIRES_PER_DAY = 5;

// Mutation: anonymous sign-up. The browser stores the returned id.
export const create = mutation({
  args: {
    name: v.string(),
    city: v.string(),
    windowStart: v.number(),
    windowEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 24);
    const city = args.city.trim().slice(0, 32);
    if (!name) throw new Error("A name is required.");
    if (args.windowStart < 0 || args.windowEnd > 23 || args.windowStart >= args.windowEnd) {
      throw new Error("The ping window must be a range of hours inside one day.");
    }
    return await ctx.db.insert("users", {
      name,
      city,
      firesLeft: FIRES_PER_DAY,
      windowStart: args.windowStart,
      windowEnd: args.windowEnd,
      createdAt: Date.now(),
    });
  },
});

// Query: the signed-in person. Live, so `firesLeft` updates the instant a fire is given.
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

// Internal mutation run by the daily cron in crons.ts. Not callable from the client.
export const resetFires = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.firesLeft !== FIRES_PER_DAY) {
        await ctx.db.patch(user._id, { firesLeft: FIRES_PER_DAY });
      }
    }
    return users.length;
  },
});
