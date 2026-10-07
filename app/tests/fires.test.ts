import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

// convex-test runs the real functions against an in-memory backend, schema included.
const modules = import.meta.glob("../convex/**/*.ts");

async function seed(t: ReturnType<typeof convexTest>) {
  const poster = await t.mutation(api.users.create, { name: "Marta", city: "Gdańsk", windowStart: 18, windowEnd: 22 });
  const viewer = await t.mutation(api.users.create, { name: "Jonas", city: "Oslo", windowStart: 18, windowEnd: 22 });
  const cardId = await t.mutation(api.cards.post, { userId: poster, excuse: "rain", sentence: "Ran ten minutes. Rain." });
  return { poster, viewer, cardId };
}

test("a fire moves the count and the viewer's fires-left in one transaction", async () => {
  const t = convexTest(schema, modules);
  const { viewer, cardId } = await seed(t);

  const result = await t.mutation(api.fires.give, { userId: viewer, cardId });
  expect(result).toEqual({ firesLeft: 4, fireCount: 1 });

  const deck = await t.query(api.cards.list, { excuse: "rain", viewerId: viewer });
  expect(deck[0].fireCount).toBe(1);
  expect(deck[0].firedByMe).toBe(true);
});

test("the same card cannot be fired twice by one person", async () => {
  const t = convexTest(schema, modules);
  const { viewer, cardId } = await seed(t);
  await t.mutation(api.fires.give, { userId: viewer, cardId });
  await expect(t.mutation(api.fires.give, { userId: viewer, cardId })).rejects.toThrow("already gave");
});

test("you cannot fire your own card", async () => {
  const t = convexTest(schema, modules);
  const { poster, cardId } = await seed(t);
  await expect(t.mutation(api.fires.give, { userId: poster, cardId })).rejects.toThrow("your own card");
});

test("fires run out at five and nothing is written on the sixth", async () => {
  const t = convexTest(schema, modules);
  const { poster, viewer } = await seed(t);
  const cards: Id<"cards">[] = [];
  for (let i = 0; i < 6; i++) {
    cards.push(await t.mutation(api.cards.post, { userId: poster, excuse: "tired", sentence: `Two squats, take ${i}.` }));
  }
  for (let i = 0; i < 5; i++) {
    await t.mutation(api.fires.give, { userId: viewer, cardId: cards[i] });
  }
  await expect(t.mutation(api.fires.give, { userId: viewer, cardId: cards[5] })).rejects.toThrow("No fires left");

  const me = await t.query(api.users.get, { userId: viewer });
  expect(me?.firesLeft).toBe(0);
  const deck = await t.query(api.cards.list, { excuse: "tired", viewerId: viewer });
  const untouched = deck.find((c) => c._id === cards[5]);
  expect(untouched?.fireCount).toBe(0);
});

test("posting a card acknowledges the open ping", async () => {
  const t = convexTest(schema, modules);
  const { poster } = await seed(t);
  await t.mutation(api.pings.demoPing, { userId: poster, inSeconds: 0 });
  await t.finishAllScheduledFunctions(() => {});
  expect(await t.query(api.pings.current, { userId: poster })).not.toBeNull();

  await t.mutation(api.cards.post, { userId: poster, excuse: "tired", sentence: "One sentence of the thing." });
  expect(await t.query(api.pings.current, { userId: poster })).toBeNull();
});
