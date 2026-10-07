import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Convex schema: tables, their fields, and the indexes queries read through.
// Every field is validated on write, and `npx convex dev` turns this file into
// the types the rest of the app imports from ./_generated.
export default defineSchema({
  // Anonymous people. A browser keeps its own userId in localStorage.
  users: defineTable({
    name: v.string(),
    city: v.string(),
    firesLeft: v.number(), // scarce: 5 a day, reset by the daily cron
    windowStart: v.number(), // hour of day (0-23) the ping can arrive from
    windowEnd: v.number(), // hour of day the ping must arrive by
    createdAt: v.number(),
    seeded: v.optional(v.boolean()), // created by seed.ts; the simulation posts as these people
  }),

  // One row. Whether the seeded room is posting on its own, and the loop that does it.
  simulation: defineTable({
    running: v.boolean(),
    intervalSeconds: v.number(),
    jobId: v.optional(v.id("_scheduled_functions")),
    posted: v.number(),
    fired: v.number(),
    startedAt: v.optional(v.number()),
  }),

  // One card = one person who beat one excuse, thirty seconds ago.
  cards: defineTable({
    userId: v.id("users"),
    excuse: v.string(), // key from excuses.ts
    sentence: v.string(),
    imageId: v.optional(v.id("_storage")), // selfie in Convex file storage
    fireCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_excuse", ["excuse", "createdAt"])
    .index("by_user", ["userId", "createdAt"]),

  // A fire given by one person to one card. The index makes "already fired?" one lookup.
  fires: defineTable({
    cardId: v.id("cards"),
    userId: v.id("users"),
    createdAt: v.number(),
  }).index("by_card_user", ["cardId", "userId"]),

  // "Now: your thirty seconds." Written by a scheduled function, read live by the UI.
  pings: defineTable({
    userId: v.id("users"),
    firedAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
  }).index("by_user", ["userId", "firedAt"]),
});
