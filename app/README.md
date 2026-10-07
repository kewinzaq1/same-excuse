# Same Excuse, on Convex

A working slice of Same Excuse built to show how Convex works: pick the excuse that is talking to you, watch strangers who beat it minutes ago, give them fire, post your own thirty seconds. Every piece of the page maps to one Convex primitive, and the panel on the right narrates which one is running.

## Run it

```bash
npm install
npx convex dev --start "vite"
```

The first `npx convex dev` asks you to pick a team and project (or to run a local deployment) and writes `.env.local`. The app is on http://localhost:5173.

For the "Polish with Claude" button, set the key on the deployment, never in the browser:

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

Fill the deck with a room of realistic people and cards (18 people, 45 cards across every excuse, some fires already given). Safe to run next to your own sign-ins; add `-- '{"force": true}'` to wipe every table first:

```bash
npm run seed
```

Tests run the real functions against an in-memory Convex:

```bash
npm test
```

## Ship it: Cloudflare Workers + Convex cloud

The frontend is a static Vite build served by a Worker (static assets, no server code). The backend is your Convex production deployment; its URL is baked into the build. One command does both, in order:

```bash
npm run deploy
```

That runs `convex deploy --cmd "npm run build"`, which pushes `convex/` to production and builds the frontend with `VITE_CONVEX_URL` pointing at it, then `wrangler deploy`, which uploads `dist/` and prints the workers.dev URL. Before the first deploy:

```bash
npx wrangler login                                        # once, opens the browser
npx convex env set ANTHROPIC_API_KEY sk-ant-... --prod    # the Claude button on production
npx convex run seed:run --prod                            # a room of people on production
```

Production is a real cloud deployment: the crons run there, and "Start the room" keeps posting until someone stops it. Stop it after the talk. There is no auth, so anyone with the URL can sign in with any name and post.

## What maps to what

| On the page | Convex primitive | File |
| --- | --- | --- |
| The deck, the counts on the excuse chips, your fires-left | Queries (`useQuery`): cached, subscribed, pushed on change | `convex/cards.ts`, `convex/users.ts` |
| Give fire, post a card, sign up | Mutations: transactions, serializable | `convex/fires.ts`, `convex/cards.ts`, `convex/users.ts` |
| The fire count moving before the server answers | Optimistic update on `useMutation` | `src/components/Deck.tsx` |
| The selfie on a card | File storage: upload URL, storage id, served URL | `convex/cards.ts`, `src/components/PostCard.tsx` |
| Polish with Claude | Action in the Node runtime calling the Anthropic API | `convex/coach.ts` |
| "Ping me in 10 s" and the banner | Scheduler (`ctx.scheduler.runAfter`) running an internal mutation | `convex/pings.ts` |
| "Start the room": seeded people posting live | A self-rescheduling internal mutation, switched from one row, cancelled with `scheduler.cancel` | `convex/simulation.ts` |
| Fires reset at midnight, pings scheduled hourly | Crons declared in code | `convex/crons.ts` |
| The schema and its indexes | `defineSchema`, `defineTable`, `.index()` | `convex/schema.ts` |

## Demo script, about nine minutes

Open the app in two browser windows side by side. Sign in as two different people. Keep the Convex dashboard in a third tab.

1. **The schema.** Open `convex/schema.ts`. Four tables, four indexes. Point out that `npx convex dev` turned this into the types the frontend imports. Change a field name, watch the typecheck fail in the editor.
2. **Live queries.** In window A, pick "It's raining." Post a card from window B. It lands in A's deck without a refresh, and the count on the chip ticks up. Open `cards.list` in `convex/cards.ts`: it is an ordinary async function that reads through an index. Convex tracks what it read and re-runs it when that changes.
3. **Mutations are transactions.** Give fire from A. Open `convex/fires.ts`: three reads, three writes, one function. Say the sentence out loud: two people cannot both take the last fire. Give five fires, try a sixth, read the error. Nothing was written.
4. **Optimistic updates.** Throttle the network in devtools. Give fire. The count and fires-left move instantly, then reconcile. Show the six lines in `Deck.tsx` that do it.
5. **File storage.** Post a card with a photo from B. Three steps: the mutation hands out a one-time upload URL, the browser posts the file, the card stores the id. The query turns the id back into a URL. No S3 config, no signed-URL code.
6. **Actions.** Type a rough note, hit "Polish with Claude". Open `convex/coach.ts`: `"use node"` on line one, an SDK call, a returned sentence. Actions are where the outside world is allowed in. The key lives on the deployment.
7. **The room.** Hit "Start the room" in the panel. Seeded people begin posting every few seconds and giving fires; cards slide into the deck and counts tick on every open window. Open `convex/simulation.ts`: one internal mutation that posts, then schedules itself again. Stop it from a different window to show the switch is one shared row. This also carries the demo if the audience is shy.
8. **The scheduler.** Hit "Ping me in 10 s". Watch the countdown in the panel and the banner appear on top. Open `convex/pings.ts`: `ctx.scheduler.runAfter` queues `internal.pings.fire`, which no client can call directly. Show the scheduled function in the dashboard.
9. **Crons.** Open `convex/crons.ts`. Two lines. Show them in the dashboard's cron tab with their run history.

Close on the dashboard's data tab with the tables filling up as the room posts cards.

## Things to know before the stage

- Hours in the ping window are UTC. The hourly cron only schedules a ping for people whose window opens in the current hour, so the live demo uses the "Ping me in 10 s" button instead.
- Fires reset at 00:00 UTC. To reset them during rehearsal, run `internal.users.resetFires` from the dashboard's functions tab.
- Run `npm run seed` before the talk so every deck has cards, then use "Start the room" so the seeded people keep posting on their own. Stop it after the talk: it keeps rescheduling itself until you do.
- Nothing here has auth. It is a demo. The user id in localStorage is trusted by the backend.
