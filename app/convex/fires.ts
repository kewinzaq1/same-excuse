import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Mutation: give one of your five daily fires to a card.
// Three reads, three writes, one transaction. If any check fails nothing is written,
// and because Convex mutations are serializable two people cannot both take the last fire.
export const give = mutation({
  args: { userId: v.id("users"), cardId: v.id("cards") },
  handler: async (ctx, { userId, cardId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Unknown user.");
    const card = await ctx.db.get(cardId);
    if (!card) throw new Error("That card is gone.");
    if (card.userId === userId) throw new Error("You cannot fire your own card.");
    if (user.firesLeft <= 0) throw new Error("No fires left today. They come back at midnight.");

    const already = await ctx.db
      .query("fires")
      .withIndex("by_card_user", (q) => q.eq("cardId", cardId).eq("userId", userId))
      .unique();
    if (already) throw new Error("You already gave this one a fire.");

    await ctx.db.insert("fires", { cardId, userId, createdAt: Date.now() });
    await ctx.db.patch(cardId, { fireCount: card.fireCount + 1 });
    await ctx.db.patch(userId, { firesLeft: user.firesLeft - 1 });

    return { firesLeft: user.firesLeft - 1, fireCount: card.fireCount + 1 };
  },
});
