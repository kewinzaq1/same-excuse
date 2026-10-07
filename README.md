# Same Excuse

An app full of people beating the excuse you are about to use.

**Pick your excuse. Watch people beat it. Then beat it yourself.**

## The idea

Everyone has the same handful of excuses: it's raining, I'm too tired, no time today, I'll start Monday, one more episode, nobody would notice. An excuse works because it sounds reasonable. It stops working the moment you see a stranger who beat the exact same one ten minutes ago.

So the app is organised around the excuse. You open it by tapping the one talking to you right now. The deck is people who beat that one today: a face, one line, thirty seconds of a real thing. You give out five fires a day, not more, so one means something. Then you do your thirty seconds and you are the next card.

What it deliberately is not: a feed to scroll, a points economy, a meditation app, or a guru. Lurkers are welcome. Streaks freeze, they never break.

## What is here

- `app/` — a working slice of the product on Vite, React and Convex, built as a demo of how Convex works. Live deck, optimistic fires, photo upload to file storage, an action that tidies your line with Claude, a scheduled daily ping, crons, a seeded room that posts on its own, and tests. See [app/README.md](app/README.md) for how to run, seed, demo and deploy it.
- `landing/same-excuse.html` — the story-first landing page. Night on the couch, the excuse arrives, you tap it, you meet the strangers who beat it, dawn, morning. Static HTML, open it in a browser.
- `landing/caveman-v0.1.html` — the first landing page from before the idea pivoted, kept for history: a creature that grows from tiny verified actions.

## Design notes

- Global supply, not friends only. A deck capped by your friend count empties fast.
- The card is a face, the excuse beaten, and the action. Scarce fires are the reaction.
- One random ping a day inside a window you chose. Thirty seconds is small enough to do on the couch.
- Swipe free, post to be seen. Most people never post anywhere; they still count.
- Participants pay for it. No attention economy.

## Not decided

- Platform beyond the web demo.
- What exactly participants pay for.
- The name. "Same Excuse" is a working title.
