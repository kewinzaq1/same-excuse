import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isExcuseKey, EXCUSE_KEYS } from "./excuses";

const MAX_SENTENCE = 140;

// Query: the deck for one excuse, newest first, with the poster and the selfie URL joined in.
// Every browser subscribed to this query re-renders the moment a card is posted or fired.
export const list = query({
  args: {
    excuse: v.string(),
    viewerId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { excuse, viewerId, limit }) => {
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_excuse", (q) => q.eq("excuse", excuse))
      .order("desc")
      .take(limit ?? 30);

    return await Promise.all(
      cards.map(async (card) => {
        const user = await ctx.db.get(card.userId);
        const imageUrl = card.imageId ? await ctx.storage.getUrl(card.imageId) : null;
        const firedByMe = viewerId
          ? (await ctx.db
              .query("fires")
              .withIndex("by_card_user", (q) => q.eq("cardId", card._id).eq("userId", viewerId))
              .unique()) !== null
          : false;
        return {
          _id: card._id,
          excuse: card.excuse,
          sentence: card.sentence,
          fireCount: card.fireCount,
          createdAt: card.createdAt,
          imageUrl,
          firedByMe,
          isMine: viewerId === card.userId,
          who: user?.name ?? "Someone",
          where: user?.city ?? "",
        };
      }),
    );
  },
});

// Query: my own cards, newest first, for the Me tab.
export const mine = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return await Promise.all(
      cards.map(async (card) => ({
        _id: card._id,
        excuse: card.excuse,
        sentence: card.sentence,
        fireCount: card.fireCount,
        createdAt: card.createdAt,
        imageUrl: card.imageId ? await ctx.storage.getUrl(card.imageId) : null,
      })),
    );
  },
});

// Query: how many people beat each excuse today. Drives the counts on the picker, live.
export const countsToday = query({
  args: {},
  handler: async (ctx) => {
    const dayStart = new Date().setUTCHours(0, 0, 0, 0);
    const counts: Record<string, number> = {};
    for (const key of EXCUSE_KEYS) {
      const rows = await ctx.db
        .query("cards")
        .withIndex("by_excuse", (q) => q.eq("excuse", key).gte("createdAt", dayStart))
        .collect();
      counts[key] = rows.length;
    }
    return counts;
  },
});

// Mutation: ask Convex file storage for a one-time upload URL. The browser PUTs the photo there.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Mutation: post a card. Runs as a transaction: validation, insert, done, or nothing.
export const post = mutation({
  args: {
    userId: v.id("users"),
    excuse: v.string(),
    sentence: v.string(),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Unknown user.");
    if (!isExcuseKey(args.excuse)) throw new Error("Unknown excuse.");
    const sentence = args.sentence.trim();
    if (sentence.length < 3) throw new Error("Say what you did, in a few words.");
    if (sentence.length > MAX_SENTENCE) throw new Error(`Keep it under ${MAX_SENTENCE} characters.`);

    const cardId = await ctx.db.insert("cards", {
      userId: args.userId,
      excuse: args.excuse,
      sentence,
      imageId: args.imageId,
      fireCount: 0,
      createdAt: Date.now(),
    });

    // Posting acknowledges any open ping: you did your thirty seconds.
    const open = await ctx.db
      .query("pings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    if (open && open.acknowledgedAt === undefined) {
      await ctx.db.patch(open._id, { acknowledgedAt: Date.now() });
    }

    return cardId;
  },
});
