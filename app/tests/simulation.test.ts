import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

test("the room does nothing without seeded people, and posts once seeded", async () => {
  const t = convexTest(schema, modules);

  const before = await t.query(api.simulation.get, {});
  expect(before).toMatchObject({ running: false, seededCount: 0 });

  await t.mutation(api.simulation.setRunning, { running: true, intervalSeconds: 3 });
  await t.mutation(internal.simulation.tick, {});
  // No seeded people: the tick switches itself off and posts nothing.
  expect((await t.query(api.simulation.get, {})).running).toBe(false);
  expect(await t.query(api.cards.list, { excuse: "rain" })).toHaveLength(0);

  await t.mutation(internal.seed.run, {});
  const seeded = await t.query(api.simulation.get, {});
  expect(seeded.seededCount).toBe(18);

  await t.mutation(api.simulation.setRunning, { running: true, intervalSeconds: 3 });
  const cardsBefore = (await t.run(async (ctx) => ctx.db.query("cards").collect())).length;
  await t.mutation(internal.simulation.tick, {});
  await t.mutation(internal.simulation.tick, {});
  const cardsAfter = (await t.run(async (ctx) => ctx.db.query("cards").collect())).length;
  expect(cardsAfter).toBe(cardsBefore + 2);

  const state = await t.query(api.simulation.get, {});
  expect(state.running).toBe(true);
  expect(state.posted).toBe(2);

  await t.mutation(api.simulation.setRunning, { running: false });
  expect((await t.query(api.simulation.get, {})).running).toBe(false);
  // A tick after stop is a no-op.
  await t.mutation(internal.simulation.tick, {});
  expect((await t.run(async (ctx) => ctx.db.query("cards").collect())).length).toBe(cardsAfter);
});
