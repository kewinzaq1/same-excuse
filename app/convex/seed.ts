import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { FIRES_PER_DAY } from "./users";

// Seed: a room full of realistic people and cards so the deck is never empty on stage.
//   npm run seed                          adds people and cards next to whatever is there
//   npm run seed -- '{"force": true}'     wipes every table first (your own sign-ins too), then seeds
// Internal, so only the CLI and the dashboard can run it.

export const PEOPLE: { name: string; city: string }[] = [
  { name: "Marta", city: "Gdańsk" },
  { name: "Tomasz", city: "Kraków" },
  { name: "Kasia", city: "Wrocław" },
  { name: "Piotr", city: "Gdynia" },
  { name: "Ola", city: "Poznań" },
  { name: "Zofia", city: "Łódź" },
  { name: "Jonas", city: "Oslo" },
  { name: "Lena", city: "Berlin" },
  { name: "Diego", city: "Lisbon" },
  { name: "Aisha", city: "Manchester" },
  { name: "Sam", city: "Oakland" },
  { name: "Yuki", city: "Osaka" },
  { name: "Ines", city: "Porto" },
  { name: "Emil", city: "Copenhagen" },
  { name: "Hana", city: "Prague" },
  { name: "Leo", city: "Turin" },
  { name: "Noah", city: "Dublin" },
  { name: "Mia", city: "Vienna" },
];

// Sentences in the voice of the cards: first person, past tense, dry, under 100 characters.
export const SENTENCES: Record<string, string[]> = {
  rain: [
    "Ran ten minutes. Rain. Almost didn't.",
    "Walked to the shop instead of ordering. Soaked. Fine.",
    "Ten push-ups by the window. Rain has no opinion about push-ups.",
    "Two minutes on the balcony. Wet. Awake now.",
    "One page. The rain read along.",
    "Took the bins out and kept walking for five minutes. Counts.",
    "Stretched on the kitchen floor while it poured.",
  ],
  tired: [
    "One sentence of the thing. Tired is not the same as done.",
    "Two squats. That is the deal on tired days. The deal holds.",
    "Sent the email I had been avoiding. Forty seconds. Slept better.",
    "Brushed, flossed, one squat. Sleep counts as the reward.",
    "Ten seconds of plank. Tired lost by ten seconds.",
    "Read three paragraphs in bed instead of scrolling. Then slept.",
    "Filled the water bottle for tomorrow. It is a start. Started.",
  ],
  time: [
    "Read one page in the elevator. The elevator was slow anyway.",
    "Stretched while the kettle boiled. Kettle took two minutes. So did I.",
    "Wrote the first line on the tram. Ugly line. It exists now.",
    "Voice memo of the idea while parking. Thirty seconds.",
    "Stairs instead of the lift. Same time. More lungs.",
    "Ten Spanish words in the queue at the post office.",
  ],
  monday: [
    "Started Thursday. Twenty seconds. Monday can watch.",
    "Opened the doc. Typed the title. That is a start.",
    "Put the shoes by the door. Ask anyone who has done it.",
    "It is Wednesday. I started. Monday is fired.",
    "Named the file. That was the wall. Wall is down.",
    "Booked the dentist. Was going to do it Monday since March.",
  ],
  episode: [
    "Paused it. Ten push-ups. Un-paused. The show did not mind.",
    "Did the dishes during the intro. The intro is ninety seconds. Enough.",
    "One sentence before pressing play. Then play. Both happened.",
    "Credits rolled, I rolled out the mat. Forty seconds.",
    "Watched it standing, doing calf raises. Both got done.",
    "Turned it off at the cliffhanger and went to bed. Still alive.",
  ],
  nobody: [
    "I noticed. Two minutes of Spanish. Nobody else has to.",
    "Nobody noticed. Fourth day anyway. I am starting to.",
    "You would notice. That is the point of showing your face.",
    "Nobody noticed. I posted it. Now you did.",
    "One message to my brother. He noticed.",
  ],
  later: [
    "Later arrived. Did it then. Later is now, apparently.",
    "Set a timer for after this. The timer won.",
    "Made the call before the coffee instead of after. Coffee tasted better.",
    "Did the two-minute version now so later has nothing to do.",
  ],
  mood: [
    "Not in the mood. Did five squats in a bad mood. Mood improved slightly.",
    "Wrote one bad sentence on purpose. The second one was better.",
    "Walked around the block without headphones. Mood irrelevant.",
    "Practised the chord change for one minute. Still not in the mood. Done anyway.",
  ],
};

// Deterministic pseudo-random so a seed run is reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export const run = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    // Idempotent by default: if the seeded people are already here, do nothing.
    const already = (await ctx.db.query("users").collect()).some((u) => u.name === "Hana" && u.city === "Prague");
    if (already && !force) {
      return { skipped: true, reason: "already seeded; pass {\"force\": true} to wipe every table and reseed" };
    }
    if (force) {
      for (const table of ["fires", "cards", "pings", "users", "simulation"] as const) {
        const rows = await ctx.db.query(table).collect();
        for (const row of rows) await ctx.db.delete(row._id);
      }
    }

    const random = rng(20260924);
    const now = Date.now();
    const userIds: Id<"users">[] = [];
    for (const p of PEOPLE) {
      userIds.push(
        await ctx.db.insert("users", {
          name: p.name,
          city: p.city,
          firesLeft: FIRES_PER_DAY,
          windowStart: 17 + Math.floor(random() * 3),
          windowEnd: 21 + Math.floor(random() * 2),
          createdAt: now - Math.floor(random() * 20) * 86_400_000,
          seeded: true,
        }),
      );
    }

    // Cards: every sentence once, spread over the last twelve hours, a few in the last minutes.
    const cardIds: { id: Id<"cards">; userId: Id<"users"> }[] = [];
    for (const [excuse, lines] of Object.entries(SENTENCES)) {
      for (const sentence of lines) {
        const userId = userIds[Math.floor(random() * userIds.length)];
        const recent = random() < 0.25;
        const ageMs = recent ? Math.floor(random() * 15) * 60_000 : Math.floor(random() * 12 * 60) * 60_000;
        const id = await ctx.db.insert("cards", {
          userId,
          excuse,
          sentence,
          fireCount: 0,
          createdAt: now - ageMs,
        });
        cardIds.push({ id, userId });
      }
    }

    // Fires: each person gives up to three, never to themselves, never twice to one card.
    let fires = 0;
    for (const giver of userIds) {
      const given = new Set<string>();
      const n = Math.floor(random() * 4);
      let spent = 0;
      for (let attempt = 0; attempt < 12 && spent < n; attempt++) {
        const card = cardIds[Math.floor(random() * cardIds.length)];
        if (card.userId === giver || given.has(card.id)) continue;
        given.add(card.id);
        await ctx.db.insert("fires", { cardId: card.id, userId: giver, createdAt: now - Math.floor(random() * 60) * 60_000 });
        const doc = await ctx.db.get(card.id);
        if (doc) await ctx.db.patch(card.id, { fireCount: doc.fireCount + 1 });
        spent += 1;
        fires += 1;
      }
      if (spent > 0) await ctx.db.patch(giver, { firesLeft: FIRES_PER_DAY - spent });
    }

    return { skipped: false, users: userIds.length, cards: cardIds.length, fires };
  },
});
